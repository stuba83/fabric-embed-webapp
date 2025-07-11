"""
PowerBI Service for Microsoft Fabric Embedded Backend
Handles PowerBI API integration, embed token generation, and report management
"""

import logging
import json
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import httpx
from dataclasses import dataclass

from ..auth.entra_auth import entra_auth_service
from ..auth.models import User
from ..config import get_settings
from ..utils.logger import security_logger

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ReportInfo:
    """Information about a PowerBI report"""
    id: str
    name: str
    embed_url: str
    dataset_id: str
    workspace_id: str


@dataclass
class EmbedToken:
    """PowerBI embed token information"""
    token: str
    token_id: str
    expiration: datetime
    reports: List[str]
    datasets: List[str]
    target_workspaces: List[str]


class PowerBIServiceError(Exception):
    """Base exception for PowerBI service errors"""
    pass


class TokenGenerationError(PowerBIServiceError):
    """Exception raised when embed token generation fails"""
    pass


class ReportAccessError(PowerBIServiceError):
    """Exception raised when report access is denied"""
    pass


class PowerBIService:
    """Service for PowerBI API operations and embed token management"""
    
    def __init__(self):
        self.base_url = settings.powerbi_api_url
        self.workspace_id = settings.fabric_workspace_id
        self.dataset_id = settings.fabric_dataset_id
        self.report_id = settings.fabric_report_id
        
        # Cache for tokens and metadata
        self._token_cache: Dict[str, EmbedToken] = {}
        self._report_cache: Dict[str, ReportInfo] = {}
        self._workspace_cache: Dict[str, Dict[str, Any]] = {}
        
        logger.info("PowerBIService initialized", extra={
            'workspace_id': self.workspace_id,
            'base_url': self.base_url
        })
    
    async def generate_embed_token(
        self, 
        user: User, 
        report_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        access_level: str = "View"
    ) -> Dict[str, Any]:
        """
        Generate PowerBI embed token for user with RLS
        
        Args:
            user: Authenticated user
            report_id: Specific report ID (optional, uses default if not provided)
            dataset_id: Dataset ID (optional, uses default if not provided)
            access_level: Access level for the token (View, Edit, Create)
            
        Returns:
            Dictionary containing embed token and configuration
            
        Raises:
            TokenGenerationError: If token generation fails
            ReportAccessError: If user doesn't have access to the report
        """
        
        try:
            # Use provided IDs or defaults
            target_report_id = report_id or self.report_id
            target_dataset_id = dataset_id or self.dataset_id
            
            if not target_report_id:
                raise TokenGenerationError("No report ID specified and no default configured")
            
            # Get PowerBI access token
            powerbi_token = await self._get_powerbi_access_token()
            
            # Get report information
            report_info = await self._get_report_info(target_report_id, powerbi_token)
            
            # Validate user access to report
            if not self._validate_user_access(user, report_info):
                raise ReportAccessError(f"User {user.email} does not have access to report {target_report_id}")
            
            # Generate embed token with RLS
            embed_token = await self._generate_embed_token_with_rls(
                user=user,
                report_info=report_info,
                dataset_id=target_dataset_id,
                access_level=access_level,
                powerbi_token=powerbi_token
            )
            
            # Create embed configuration
            embed_config = self._create_embed_config(
                report_info=report_info,
                embed_token=embed_token,
                user=user
            )
            
            # Log token generation
            security_logger.log_token_generated(
                user_id=user.email,
                report_id=target_report_id,
                roles_applied=user.powerbi_roles,
                token_expiration=embed_token.expiration
            )
            
            logger.info(f"Embed token generated for user {user.email}, report {target_report_id}")
            
            return embed_config
            
        except (TokenGenerationError, ReportAccessError):
            raise
        except Exception as e:
            logger.error(f"Unexpected error generating embed token: {e}")
            raise TokenGenerationError(f"Token generation failed: {str(e)}")
    
    async def get_reports_for_user(self, user: User) -> List[Dict[str, Any]]:
        """
        Get list of reports accessible to the user
        
        Args:
            user: Authenticated user
            
        Returns:
            List of report information that user can access
        """
        
        try:
            # Get PowerBI access token
            powerbi_token = await self._get_powerbi_access_token()
            
            # Get all reports in workspace
            reports = await self._get_workspace_reports(powerbi_token)
            
            # Filter reports based on user access
            accessible_reports = []
            for report in reports:
                if self._validate_user_access(user, report):
                    accessible_reports.append({
                        'id': report['id'],
                        'name': report['name'],
                        'embed_url': report['embedUrl'],
                        'dataset_id': report.get('datasetId'),
                        'has_access': True,
                        'user_roles': user.powerbi_roles
                    })
            
            logger.debug(f"Found {len(accessible_reports)} accessible reports for user {user.email}")
            return accessible_reports
            
        except Exception as e:
            logger.error(f"Error getting reports for user: {e}")
            raise PowerBIServiceError(f"Failed to get reports: {str(e)}")
    
    async def get_datasets_for_user(self, user: User) -> List[Dict[str, Any]]:
        """
        Get list of datasets accessible to the user
        
        Args:
            user: Authenticated user
            
        Returns:
            List of dataset information that user can access
        """
        
        try:
            # Get PowerBI access token
            powerbi_token = await self._get_powerbi_access_token()
            
            # Get all datasets in workspace
            datasets = await self._get_workspace_datasets(powerbi_token)
            
            # For simplicity, assume user can access datasets if they can access reports
            # In a real implementation, you might have dataset-specific permissions
            accessible_datasets = []
            for dataset in datasets:
                accessible_datasets.append({
                    'id': dataset['id'],
                    'name': dataset['name'],
                    'configured_by': dataset.get('configuredBy'),
                    'has_access': True,
                    'user_roles': user.powerbi_roles
                })
            
            logger.debug(f"Found {len(accessible_datasets)} accessible datasets for user {user.email}")
            return accessible_datasets
            
        except Exception as e:
            logger.error(f"Error getting datasets for user: {e}")
            raise PowerBIServiceError(f"Failed to get datasets: {str(e)}")
    
    async def validate_embed_token(self, token_id: str) -> bool:
        """
        Validate if an embed token is still valid
        
        Args:
            token_id: Token identifier to validate
            
        Returns:
            True if token is valid, False otherwise
        """
        
        # Check cache first
        if token_id in self._token_cache:
            cached_token = self._token_cache[token_id]
            if datetime.now() < cached_token.expiration:
                return True
            else:
                # Remove expired token from cache
                del self._token_cache[token_id]
        
        return False
    
    async def revoke_embed_token(self, token_id: str) -> bool:
        """
        Revoke an embed token
        
        Args:
            token_id: Token identifier to revoke
            
        Returns:
            True if token was revoked, False if not found
        """
        
        if token_id in self._token_cache:
            del self._token_cache[token_id]
            logger.info(f"Embed token revoked: {token_id}")
            return True
        
        return False
    
    async def _get_powerbi_access_token(self) -> str:
        """Get access token for PowerBI API"""
        
        try:
            # Use service principal to get PowerBI token
            scope = "https://analysis.windows.net/powerbi/api/.default"
            token = await entra_auth_service.get_service_principal_token(scope)
            
            logger.debug("PowerBI access token acquired")
            return token
            
        except Exception as e:
            logger.error(f"Failed to get PowerBI access token: {e}")
            raise TokenGenerationError(f"Failed to acquire PowerBI access token: {str(e)}")
    
    async def _get_report_info(self, report_id: str, powerbi_token: str) -> ReportInfo:
        """Get report information from PowerBI API"""
        
        # Check cache first
        if report_id in self._report_cache:
            return self._report_cache[report_id]
        
        try:
            url = f"{self.base_url}/groups/{self.workspace_id}/reports/{report_id}"
            headers = {
                "Authorization": f"Bearer {powerbi_token}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                
                report_data = response.json()
                
                report_info = ReportInfo(
                    id=report_data['id'],
                    name=report_data['name'],
                    embed_url=report_data['embedUrl'],
                    dataset_id=report_data.get('datasetId', ''),
                    workspace_id=self.workspace_id
                )
                
                # Cache report info
                self._report_cache[report_id] = report_info
                
                logger.debug(f"Retrieved report info for: {report_id}")
                return report_info
                
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise PowerBIServiceError(f"Report not found: {report_id}")
            elif e.response.status_code == 403:
                raise PowerBIServiceError(f"Access denied to report: {report_id}")
            else:
                raise PowerBIServiceError(f"Failed to get report info: {e}")
        except Exception as e:
            logger.error(f"Error getting report info: {e}")
            raise PowerBIServiceError(f"Failed to get report info: {str(e)}")
    
    async def _generate_embed_token_with_rls(
        self,
        user: User,
        report_info: ReportInfo,
        dataset_id: Optional[str],
        access_level: str,
        powerbi_token: str
    ) -> EmbedToken:
        """Generate embed token with Row Level Security"""
        
        try:
            url = f"{self.base_url}/groups/{self.workspace_id}/reports/{report_info.id}/GenerateToken"
            headers = {
                "Authorization": f"Bearer {powerbi_token}",
                "Content-Type": "application/json"
            }
            
            # Prepare RLS identity
            rls_identities = []
            
            # Map user's PowerBI roles to RLS
            effective_roles = user.powerbi_roles
            if effective_roles and not user.is_admin:  # Admin sees all data without RLS
                rls_identities.append({
                    "username": user.email,
                    "roles": effective_roles,
                    "datasets": [dataset_id or report_info.dataset_id]
                })
            
            # Prepare token request
            token_request = {
                "accessLevel": access_level,
                "datasetId": dataset_id or report_info.dataset_id,
                "allowSaveAs": False,  # Disable save as for security
                "identities": rls_identities
            }
            
            # Add lifetime (optional)
            token_lifetime = settings.embed_token_expiration_minutes
            if token_lifetime:
                token_request["lifetimeInMinutes"] = token_lifetime
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, 
                    headers=headers, 
                    json=token_request, 
                    timeout=30
                )
                response.raise_for_status()
                
                token_data = response.json()
                
                # Calculate expiration time
                expiration = datetime.now() + timedelta(minutes=token_lifetime or 60)
                
                embed_token = EmbedToken(
                    token=token_data['token'],
                    token_id=token_data.get('tokenId', f"token_{datetime.now().timestamp()}"),
                    expiration=expiration,
                    reports=[report_info.id],
                    datasets=[dataset_id or report_info.dataset_id],
                    target_workspaces=[self.workspace_id]
                )
                
                # Cache token
                self._token_cache[embed_token.token_id] = embed_token
                
                logger.debug(f"Generated embed token with RLS for user {user.email}")
                return embed_token
                
        except httpx.HTTPStatusError as e:
            error_detail = "Unknown error"
            try:
                error_response = e.response.json()
                error_detail = error_response.get('error', {}).get('message', str(e))
            except:
                error_detail = str(e)
            
            logger.error(f"PowerBI API error generating token: {error_detail}")
            raise TokenGenerationError(f"PowerBI API error: {error_detail}")
            
        except Exception as e:
            logger.error(f"Error generating embed token: {e}")
            raise TokenGenerationError(f"Token generation failed: {str(e)}")
    
    async def _get_workspace_reports(self, powerbi_token: str) -> List[Dict[str, Any]]:
        """Get all reports in the workspace"""
        
        try:
            url = f"{self.base_url}/groups/{self.workspace_id}/reports"
            headers = {
                "Authorization": f"Bearer {powerbi_token}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                reports = data.get('value', [])
                
                logger.debug(f"Retrieved {len(reports)} reports from workspace")
                return reports
                
        except Exception as e:
            logger.error(f"Error getting workspace reports: {e}")
            raise PowerBIServiceError(f"Failed to get workspace reports: {str(e)}")
    
    async def _get_workspace_datasets(self, powerbi_token: str) -> List[Dict[str, Any]]:
        """Get all datasets in the workspace"""
        
        try:
            url = f"{self.base_url}/groups/{self.workspace_id}/datasets"
            headers = {
                "Authorization": f"Bearer {powerbi_token}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                datasets = data.get('value', [])
                
                logger.debug(f"Retrieved {len(datasets)} datasets from workspace")
                return datasets
                
        except Exception as e:
            logger.error(f"Error getting workspace datasets: {e}")
            raise PowerBIServiceError(f"Failed to get workspace datasets: {str(e)}")
    
    def _validate_user_access(self, user: User, report_info: Any) -> bool:
        """
        Validate if user has access to a report
        
        This is a simplified access control - in a real system you might have
        more complex rules based on report metadata, user attributes, etc.
        """
        
        # Admin users have access to everything
        if user.is_admin:
            return True
        
        # Users with roles have access (RLS will filter the data)
        if user.roles and any(role != "Public" for role in user.roles):
            return True
        
        # Public users have no access
        return False
    
    def _create_embed_config(
        self, 
        report_info: ReportInfo, 
        embed_token: EmbedToken, 
        user: User
    ) -> Dict[str, Any]:
        """Create embed configuration for frontend"""
        
        return {
            "type": "report",
            "id": report_info.id,
            "embedUrl": report_info.embed_url,
            "accessToken": embed_token.token,
            "tokenType": "Embed",
            "permissions": "View",  # Could be dynamic based on user
            "settings": {
                "filterPaneEnabled": False,  # Disable filter pane for security
                "navContentPaneEnabled": True,
                "background": "transparent",
                "visualSettings": {
                    "visualHeaders": {
                        "settings": {
                            "visible": True
                        }
                    }
                }
            },
            "datasetBinding": {
                "datasetId": report_info.dataset_id
            },
            "tokenInfo": {
                "tokenId": embed_token.token_id,
                "expiration": embed_token.expiration.isoformat(),
                "appliedRoles": user.powerbi_roles,
                "userId": user.email
            }
        }


# Global service instance
powerbi_service = PowerBIService()


# Convenience functions
async def generate_embed_token(user: User, report_id: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """Generate embed token for user"""
    return await powerbi_service.generate_embed_token(user, report_id, **kwargs)


async def get_user_reports(user: User) -> List[Dict[str, Any]]:
    """Get reports accessible to user"""
    return await powerbi_service.get_reports_for_user(user)


async def get_user_datasets(user: User) -> List[Dict[str, Any]]:
    """Get datasets accessible to user"""
    return await powerbi_service.get_datasets_for_user(user)