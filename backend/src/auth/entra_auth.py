"""
Entra ID (Azure AD) Authentication Service
Handles token validation, user information retrieval, and group membership
"""

import logging
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
import jwt
import httpx
from msal import ConfidentialClientApplication
from azure.identity import DefaultAzureCredential

from ..config import get_settings
from ..utils.logger import security_logger
from .models import User, TokenInfo

logger = logging.getLogger(__name__)
settings = get_settings()


class EntraAuthError(Exception):
    """Base exception for Entra ID authentication errors"""
    pass


class TokenValidationError(EntraAuthError):
    """Exception raised when token validation fails"""
    pass


class UserInfoError(EntraAuthError):
    """Exception raised when user information retrieval fails"""
    pass


class EntraAuthService:
    """Service for handling Entra ID authentication and authorization"""
    
    def __init__(self):
        self.tenant_id = settings.entra_tenant_id
        self.client_id = settings.entra_client_id
        self.client_secret = settings.entra_client_secret
        self.authority = settings.entra_authority
        
        # MSAL Confidential Client for server-to-server auth
        self._msal_app: Optional[ConfidentialClientApplication] = None
        
        # Cache for JWKS and user info
        self._jwks_cache: Dict[str, Any] = {}
        self._jwks_cache_expiry: Optional[datetime] = None
        self._user_cache: Dict[str, Dict[str, Any]] = {}
        
        logger.info("EntraAuthService initialized", extra={
            'tenant_id': self.tenant_id,
            'client_id': self.client_id,
            'authority': self.authority
        })
    
    @property
    def msal_app(self) -> ConfidentialClientApplication:
        """Get MSAL application instance with lazy initialization"""
        if self._msal_app is None:
            self._msal_app = ConfidentialClientApplication(
                client_id=self.client_id,
                client_credential=self.client_secret,
                authority=self.authority
            )
        return self._msal_app
    
    async def validate_token(self, token: str) -> TokenInfo:
        """
        Validate JWT token from Entra ID
        
        Args:
            token: JWT access token from frontend
            
        Returns:
            TokenInfo: Validated token information
            
        Raises:
            TokenValidationError: If token validation fails
        """
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith('Bearer '):
                token = token[7:]
            
            # Get JWKS for token validation
            jwks = await self._get_jwks()
            
            # Decode token header to get key ID
            unverified_header = jwt.get_unverified_header(token)
            key_id = unverified_header.get('kid')
            
            if not key_id:
                raise TokenValidationError("Token missing key ID in header")
            
            # Find the matching key in JWKS
            signing_key = None
            for key in jwks.get('keys', []):
                if key.get('kid') == key_id:
                    signing_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                    break
            
            if not signing_key:
                raise TokenValidationError(f"Signing key not found for key ID: {key_id}")
            
            # Validate and decode token
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=['RS256'],
                audience=self.client_id,
                issuer=f"https://sts.windows.net/{self.tenant_id}/"
            )
            
            # Extract token information
            token_info = TokenInfo(
                user_id=payload.get('oid'),
                email=payload.get('email') or payload.get('preferred_username'),
                name=payload.get('name'),
                tenant_id=payload.get('tid'),
                audience=payload.get('aud'),
                issuer=payload.get('iss'),
                issued_at=datetime.fromtimestamp(payload.get('iat', 0)),
                expires_at=datetime.fromtimestamp(payload.get('exp', 0)),
                scopes=payload.get('scp', '').split(' ') if payload.get('scp') else []
            )
            
            # Log successful validation
            security_logger.log_user_login(
                user_id=token_info.email,
                success=True,
                user_groups=None  # Will be populated later
            )
            
            logger.debug(f"Token validated successfully for user: {token_info.email}")
            return token_info
            
        except jwt.ExpiredSignatureError:
            security_logger.log_user_login(
                user_id="unknown",
                success=False
            )
            raise TokenValidationError("Token has expired")
        except jwt.InvalidTokenError as e:
            security_logger.log_user_login(
                user_id="unknown", 
                success=False
            )
            raise TokenValidationError(f"Invalid token: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error during token validation: {e}")
            raise TokenValidationError(f"Token validation failed: {str(e)}")
    
    async def get_user_info(self, token_info: TokenInfo) -> User:
        """
        Get detailed user information including group memberships
        
        Args:
            token_info: Validated token information
            
        Returns:
            User: Complete user information with groups
            
        Raises:
            UserInfoError: If user info retrieval fails
        """
        try:
            # Check cache first
            cache_key = token_info.user_id
            if cache_key in self._user_cache:
                cached_user = self._user_cache[cache_key]
                if datetime.now() < cached_user['expires_at']:
                    logger.debug(f"Returning cached user info for: {token_info.email}")
                    return User(**cached_user['data'])
            
            # Get service-to-service token for Microsoft Graph
            graph_token = await self._get_graph_token()
            
            # Get user details from Microsoft Graph
            user_details = await self._get_user_details(token_info.user_id, graph_token)
            
            # Get user group memberships
            user_groups = await self._get_user_groups(token_info.user_id, graph_token)
            
            # Create User object
            user = User(
                id=token_info.user_id,
                email=token_info.email,
                name=token_info.name,
                tenant_id=token_info.tenant_id,
                groups=user_groups,
                roles=self._map_groups_to_roles(user_groups),
                is_admin=self._is_admin_user(user_groups),
                last_login=datetime.now()
            )
            
            # Cache user info for 15 minutes
            self._user_cache[cache_key] = {
                'data': user.dict(),
                'expires_at': datetime.now() + timedelta(minutes=15)
            }
            
            # Log successful user info retrieval
            security_logger.log_user_login(
                user_id=user.email,
                success=True,
                user_groups=user_groups
            )
            
            logger.info(f"User info retrieved successfully for: {user.email}", extra={
                'user_id': user.id,
                'groups': user_groups,
                'roles': user.roles
            })
            
            return user
            
        except Exception as e:
            logger.error(f"Failed to get user info: {e}")
            raise UserInfoError(f"User information retrieval failed: {str(e)}")
    
    async def _get_jwks(self) -> Dict[str, Any]:
        """Get JWKS (JSON Web Key Set) from Entra ID"""
        
        # Check cache first
        if self._jwks_cache and self._jwks_cache_expiry and datetime.now() < self._jwks_cache_expiry:
            return self._jwks_cache
        
        try:
            jwks_url = f"https://login.microsoftonline.com/{self.tenant_id}/discovery/v2.0/keys"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(jwks_url, timeout=30)
                response.raise_for_status()
                
                jwks = response.json()
                
                # Cache for 1 hour
                self._jwks_cache = jwks
                self._jwks_cache_expiry = datetime.now() + timedelta(hours=1)
                
                logger.debug("JWKS retrieved and cached successfully")
                return jwks
                
        except Exception as e:
            logger.error(f"Failed to retrieve JWKS: {e}")
            raise EntraAuthError(f"Failed to retrieve JWKS: {str(e)}")
    
    async def _get_graph_token(self) -> str:
        """Get access token for Microsoft Graph API"""
        try:
            # Use MSAL to get token for Graph API
            result = self.msal_app.acquire_token_for_client(
                scopes=["https://graph.microsoft.com/.default"]
            )
            
            if "access_token" not in result:
                error_desc = result.get("error_description", "Unknown error")
                raise EntraAuthError(f"Failed to acquire Graph token: {error_desc}")
            
            logger.debug("Microsoft Graph token acquired successfully")
            return result["access_token"]
            
        except Exception as e:
            logger.error(f"Failed to get Graph token: {e}")
            raise EntraAuthError(f"Graph token acquisition failed: {str(e)}")
    
    async def _get_user_details(self, user_id: str, graph_token: str) -> Dict[str, Any]:
        """Get user details from Microsoft Graph"""
        try:
            graph_url = f"https://graph.microsoft.com/v1.0/users/{user_id}"
            headers = {
                "Authorization": f"Bearer {graph_token}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.get(graph_url, headers=headers, timeout=30)
                response.raise_for_status()
                
                user_details = response.json()
                logger.debug(f"User details retrieved for: {user_id}")
                return user_details
                
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise UserInfoError(f"User not found: {user_id}")
            else:
                raise UserInfoError(f"Failed to get user details: {e}")
        except Exception as e:
            logger.error(f"Failed to get user details: {e}")
            raise UserInfoError(f"User details retrieval failed: {str(e)}")
    
    async def _get_user_groups(self, user_id: str, graph_token: str) -> List[str]:
        """Get user group memberships from Microsoft Graph"""
        try:
            # Get all groups the user is a member of
            graph_url = f"https://graph.microsoft.com/v1.0/users/{user_id}/memberOf"
            headers = {
                "Authorization": f"Bearer {graph_token}",
                "Content-Type": "application/json"
            }
            
            all_groups = []
            
            async with httpx.AsyncClient() as client:
                while graph_url:
                    response = await client.get(graph_url, headers=headers, timeout=30)
                    response.raise_for_status()
                    
                    data = response.json()
                    
                    # Extract group display names
                    groups = [
                        group.get('displayName') 
                        for group in data.get('value', []) 
                        if group.get('@odata.type') == '#microsoft.graph.group'
                        and group.get('displayName')
                    ]
                    all_groups.extend(groups)
                    
                    # Check for pagination
                    graph_url = data.get('@odata.nextLink')
            
            # Filter to only PowerBI-related groups
            powerbi_groups = [
                group for group in all_groups 
                if group.startswith('PBI-') or group in settings.entra_group_mappings
            ]
            
            logger.debug(f"User groups retrieved: {powerbi_groups}")
            return powerbi_groups
            
        except Exception as e:
            logger.error(f"Failed to get user groups: {e}")
            # Return empty list rather than failing completely
            return []
    
    def _map_groups_to_roles(self, groups: List[str]) -> List[str]:
        """Map Entra ID groups to PowerBI roles"""
        roles = []
        
        for group in groups:
            if group in settings.entra_group_mappings:
                mapped_roles = settings.entra_group_mappings[group]
                if isinstance(mapped_roles, list):
                    roles.extend(mapped_roles)
                else:
                    roles.append(mapped_roles)
        
        # Remove duplicates and return
        unique_roles = list(set(roles))
        
        # If no roles found, assign default 'Public' role
        if not unique_roles:
            unique_roles = ['Public']
        
        logger.debug(f"Mapped groups {groups} to roles: {unique_roles}")
        return unique_roles
    
    def _is_admin_user(self, groups: List[str]) -> bool:
        """Check if user has admin privileges"""
        admin_groups = ['PBI-Admin']
        return any(group in admin_groups for group in groups)
    
    async def refresh_user_cache(self, user_id: str) -> None:
        """Force refresh of cached user information"""
        if user_id in self._user_cache:
            del self._user_cache[user_id]
            logger.info(f"User cache refreshed for: {user_id}")
    
    async def get_service_principal_token(self, scope: str) -> str:
        """
        Get service principal token for specific scope
        Used for PowerBI API access
        
        Args:
            scope: OAuth scope (e.g., "https://analysis.windows.net/powerbi/api/.default")
            
        Returns:
            Access token string
        """
        try:
            result = self.msal_app.acquire_token_for_client(scopes=[scope])
            
            if "access_token" not in result:
                error_desc = result.get("error_description", "Unknown error")
                raise EntraAuthError(f"Failed to acquire token for scope {scope}: {error_desc}")
            
            logger.debug(f"Service principal token acquired for scope: {scope}")
            return result["access_token"]
            
        except Exception as e:
            logger.error(f"Failed to get service principal token: {e}")
            raise EntraAuthError(f"Service principal token acquisition failed: {str(e)}")
    
    def validate_user_roles(self, user: User, required_roles: List[str]) -> bool:
        """
        Validate if user has any of the required roles
        
        Args:
            user: User object with roles
            required_roles: List of required roles
            
        Returns:
            True if user has at least one required role
        """
        if not required_roles:
            return True
        
        # Admin users have access to everything
        if user.is_admin:
            return True
        
        # Check if user has any of the required roles
        has_access = any(role in user.roles for role in required_roles)
        
        if not has_access:
            security_logger.log_unauthorized_access(
                user_id=user.email,
                resource="role_check",
                required_roles=required_roles,
                user_roles=user.roles
            )
        
        return has_access


# Global instance
entra_auth_service = EntraAuthService()


# Convenience functions
async def validate_token(token: str) -> TokenInfo:
    """Validate JWT token"""
    return await entra_auth_service.validate_token(token)


async def get_user_info(token_info: TokenInfo) -> User:
    """Get user information"""
    return await entra_auth_service.get_user_info(token_info)


async def get_current_user(token: str) -> User:
    """Get current user from token (convenience function)"""
    token_info = await validate_token(token)
    return await get_user_info(token_info)


def validate_user_roles(user: User, required_roles: List[str]) -> bool:
    """Validate user roles"""
    return entra_auth_service.validate_user_roles(user, required_roles)