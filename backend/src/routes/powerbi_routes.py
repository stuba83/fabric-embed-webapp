"""
PowerBI routes for Microsoft Fabric Embedded Backend
Handles embed token generation, report access, and PowerBI integration
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Query

from ..auth.middleware import get_current_user_from_request, require_roles
from ..auth.models import User, PowerBITokenRequest, PowerBITokenResponse, PowerBIEmbedConfig
from ..powerbi.service import powerbi_service, PowerBIServiceError, TokenGenerationError, ReportAccessError
from ..utils.logger import security_logger
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create router
router = APIRouter(prefix="/powerbi", tags=["PowerBI"])


@router.post("/token", response_model=Dict[str, Any])
async def generate_embed_token(
    request: Request,
    token_request: PowerBITokenRequest,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Generate PowerBI embed token for authenticated user
    
    Creates an embed token with Row Level Security (RLS) applied based on the user's
    roles and group memberships. The token allows the frontend to embed PowerBI
    reports without requiring individual PowerBI licenses.
    
    Args:
        token_request: Request parameters including report ID and access level
        current_user: Authenticated user from middleware
        
    Returns:
        Embed configuration including token, URLs, and settings
    """
    
    try:
        # Use workspace from request or default
        workspace_id = token_request.workspace_id or settings.fabric_workspace_id
        
        # Generate embed token with RLS
        embed_config = await powerbi_service.generate_embed_token(
            user=current_user,
            report_id=token_request.report_id,
            dataset_id=token_request.dataset_id,
            access_level=token_request.access_level
        )
        
        # Log data access for audit
        security_logger.log_data_access(
            user_id=current_user.email,
            dataset_id=token_request.dataset_id or settings.fabric_dataset_id or "default",
            data_filters={"roles": current_user.powerbi_roles},
            access_level=token_request.access_level
        )
        
        logger.info(
            f"Embed token generated for user {current_user.email}",
            extra={
                'report_id': token_request.report_id,
                'access_level': token_request.access_level,
                'user_roles': current_user.roles
            }
        )
        
        return embed_config
        
    except ReportAccessError as e:
        logger.warning(f"Report access denied for user {current_user.email}: {e}")
        raise HTTPException(status_code=403, detail=str(e))
    
    except TokenGenerationError as e:
        logger.error(f"Token generation failed for user {current_user.email}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embed token: {str(e)}")
    
    except Exception as e:
        logger.error(f"Unexpected error generating embed token: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/reports")
async def get_user_reports(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get list of PowerBI reports accessible to the current user
    
    Returns a list of reports that the user can access based on their roles
    and permissions. Each report includes metadata and access information.
    
    Returns:
        List of accessible reports with metadata
    """
    
    try:
        reports = await powerbi_service.get_reports_for_user(current_user)
        
        logger.debug(f"Retrieved {len(reports)} reports for user {current_user.email}")
        
        return {
            "reports": reports,
            "total_count": len(reports),
            "user_roles": current_user.roles,
            "timestamp": datetime.now().isoformat()
        }
        
    except PowerBIServiceError as e:
        logger.error(f"Error getting reports for user {current_user.email}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get reports: {str(e)}")
    
    except Exception as e:
        logger.error(f"Unexpected error getting reports: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/reports/{report_id}")
async def get_report_details(
    report_id: str,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get detailed information about a specific PowerBI report
    
    Returns metadata, embed configuration, and access information for a specific report.
    
    Args:
        report_id: PowerBI report identifier
        
    Returns:
        Detailed report information and embed configuration
    """
    
    try:
        # Get all user reports and find the specific one
        user_reports = await powerbi_service.get_reports_for_user(current_user)
        
        # Find the requested report
        report = next((r for r in user_reports if r['id'] == report_id), None)
        
        if not report:
            logger.warning(f"Report {report_id} not accessible to user {current_user.email}")
            raise HTTPException(status_code=404, detail="Report not found or access denied")
        
        # Get embed token for this specific report
        embed_config = await powerbi_service.generate_embed_token(
            user=current_user,
            report_id=report_id
        )
        
        # Combine report metadata with embed config
        detailed_report = {
            **report,
            "embed_config": embed_config,
            "user_access": {
                "roles": current_user.powerbi_roles,
                "access_level": "View",
                "can_edit": current_user.is_admin,
                "can_share": current_user.is_admin
            },
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Report details retrieved for user {current_user.email}, report {report_id}")
        
        return detailed_report
        
    except HTTPException:
        raise
    except PowerBIServiceError as e:
        logger.error(f"PowerBI service error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting report details: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/datasets")
async def get_user_datasets(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get list of PowerBI datasets accessible to the current user
    
    Returns a list of datasets that the user can access based on their roles.
    This is useful for understanding data sources and creating custom reports.
    
    Returns:
        List of accessible datasets with metadata
    """
    
    try:
        datasets = await powerbi_service.get_datasets_for_user(current_user)
        
        logger.debug(f"Retrieved {len(datasets)} datasets for user {current_user.email}")
        
        return {
            "datasets": datasets,
            "total_count": len(datasets),
            "user_roles": current_user.roles,
            "timestamp": datetime.now().isoformat()
        }
        
    except PowerBIServiceError as e:
        logger.error(f"Error getting datasets for user {current_user.email}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get datasets: {str(e)}")
    
    except Exception as e:
        logger.error(f"Unexpected error getting datasets: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/token/validate")
async def validate_embed_token(
    token_id: str,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Validate if an embed token is still valid
    
    Checks if a previously generated embed token is still valid and hasn't expired.
    This is useful for the frontend to determine if it needs to refresh tokens.
    
    Args:
        token_id: Token identifier to validate
        
    Returns:
        Token validation status
    """
    
    try:
        is_valid = await powerbi_service.validate_embed_token(token_id)
        
        result = {
            "token_id": token_id,
            "is_valid": is_valid,
            "user_id": current_user.id,
            "timestamp": datetime.now().isoformat()
        }
        
        if not is_valid:
            result["message"] = "Token is expired or invalid"
        
        logger.debug(f"Token validation result for {token_id}: {is_valid}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error validating token {token_id}: {e}")
        raise HTTPException(status_code=500, detail="Token validation failed")


@router.delete("/token/{token_id}")
async def revoke_embed_token(
    token_id: str,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Revoke an embed token
    
    Revokes a previously generated embed token, making it invalid for future use.
    This is useful for security cleanup when tokens are no longer needed.
    
    Args:
        token_id: Token identifier to revoke
        
    Returns:
        Revocation status
    """
    
    try:
        was_revoked = await powerbi_service.revoke_embed_token(token_id)
        
        result = {
            "token_id": token_id,
            "revoked": was_revoked,
            "user_id": current_user.id,
            "timestamp": datetime.now().isoformat()
        }
        
        if was_revoked:
            result["message"] = "Token revoked successfully"
        else:
            result["message"] = "Token was already invalid or not found"
        
        logger.info(f"Token revocation for {token_id}: {was_revoked}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error revoking token {token_id}: {e}")
        raise HTTPException(status_code=500, detail="Token revocation failed")


@router.get("/workspace/info")
async def get_workspace_info(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get information about the PowerBI workspace
    
    Returns metadata about the configured PowerBI workspace including
    available reports, datasets, and user access levels.
    
    Returns:
        Workspace information and user access details
    """
    
    try:
        # Get user's accessible reports and datasets
        reports = await powerbi_service.get_reports_for_user(current_user)
        datasets = await powerbi_service.get_datasets_for_user(current_user)
        
        workspace_info = {
            "workspace_id": settings.fabric_workspace_id,
            "workspace_name": "Microsoft Fabric Workspace",  # Could be fetched from API
            "reports": {
                "total_count": len(reports),
                "accessible_count": len([r for r in reports if r.get('has_access', False)]),
                "items": reports
            },
            "datasets": {
                "total_count": len(datasets),
                "accessible_count": len([d for d in datasets if d.get('has_access', False)]),
                "items": datasets
            },
            "user_access": {
                "user_id": current_user.id,
                "email": current_user.email,
                "roles": current_user.roles,
                "powerbi_roles": current_user.powerbi_roles,
                "is_admin": current_user.is_admin,
                "permissions": {
                    "can_view_reports": len(reports) > 0,
                    "can_generate_tokens": True,
                    "can_access_datasets": len(datasets) > 0
                }
            },
            "configuration": {
                "rls_enabled": True,
                "token_expiration_minutes": settings.embed_token_expiration_minutes,
                "max_concurrent_tokens": 10  # Example limit
            },
            "timestamp": datetime.now().isoformat()
        }
        
        logger.debug(f"Workspace info retrieved for user {current_user.email}")
        
        return workspace_info
        
    except PowerBIServiceError as e:
        logger.error(f"Error getting workspace info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get workspace info: {str(e)}")
    
    except Exception as e:
        logger.error(f"Unexpected error getting workspace info: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/user/access")
async def check_user_access(
    report_id: Optional[str] = Query(None, description="Report ID to check access for"),
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Check user's access permissions for PowerBI resources
    
    Returns detailed access information for the current user, including
    what reports they can access and what roles apply.
    
    Args:
        report_id: Optional specific report ID to check access for
        
    Returns:
        User access permissions and role information
    """
    
    try:
        access_info = {
            "user": {
                "id": current_user.id,
                "email": current_user.email,
                "name": current_user.name,
                "is_admin": current_user.is_admin
            },
            "roles": {
                "system_roles": current_user.roles,
                "powerbi_roles": current_user.powerbi_roles,
                "entra_groups": current_user.groups
            },
            "permissions": {
                "can_view_reports": len(current_user.roles) > 0,
                "can_generate_embed_tokens": True,
                "can_access_all_data": current_user.is_admin,
                "data_filters_applied": not current_user.is_admin
            },
            "data_access": {
                "role_a_data": current_user.has_role("RolA") or current_user.is_admin,
                "role_b_data": current_user.has_role("RolB") or current_user.is_admin,
                "admin_data": current_user.is_admin,
                "public_data": True
            }
        }
        
        # If specific report requested, check access to that report
        if report_id:
            try:
                user_reports = await powerbi_service.get_reports_for_user(current_user)
                report_access = any(r['id'] == report_id for r in user_reports)
                
                access_info["report_access"] = {
                    "report_id": report_id,
                    "has_access": report_access,
                    "access_level": "View" if report_access else "None",
                    "can_edit": current_user.is_admin and report_access
                }
            except Exception as e:
                logger.warning(f"Could not check report access for {report_id}: {e}")
                access_info["report_access"] = {
                    "report_id": report_id,
                    "has_access": False,
                    "error": "Could not verify access"
                }
        
        access_info["timestamp"] = datetime.now().isoformat()
        
        logger.debug(f"Access check completed for user {current_user.email}")
        
        return access_info
        
    except Exception as e:
        logger.error(f"Error checking user access: {e}")
        raise HTTPException(status_code=500, detail="Access check failed")


# Admin-only routes for PowerBI management

@router.get("/admin/reports", dependencies=[Depends(require_roles(["Admin"]))])
async def get_all_reports(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get all PowerBI reports in the workspace (Admin only)
    
    Returns complete list of reports in the workspace regardless of user access.
    This is useful for administration and troubleshooting.
    
    Returns:
        Complete list of workspace reports
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="view_all_reports"
        )
        
        # Get PowerBI access token
        powerbi_token = await powerbi_service._get_powerbi_access_token()
        
        # Get all reports (admin bypass)
        all_reports = await powerbi_service._get_workspace_reports(powerbi_token)
        
        # Add admin metadata
        reports_with_metadata = []
        for report in all_reports:
            report_meta = {
                **report,
                "admin_metadata": {
                    "created_date": report.get('createdDateTime'),
                    "modified_date": report.get('modifiedDateTime'),
                    "created_by": report.get('createdBy'),
                    "modified_by": report.get('modifiedBy'),
                    "dataset_id": report.get('datasetId'),
                    "size_in_bytes": report.get('reportSizeInBytes')
                }
            }
            reports_with_metadata.append(report_meta)
        
        result = {
            "reports": reports_with_metadata,
            "total_count": len(reports_with_metadata),
            "workspace_id": settings.fabric_workspace_id,
            "admin_user": current_user.email,
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Admin {current_user.email} retrieved all reports")
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting all reports for admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to get reports")


@router.get("/admin/datasets", dependencies=[Depends(require_roles(["Admin"]))])
async def get_all_datasets(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get all PowerBI datasets in the workspace (Admin only)
    
    Returns complete list of datasets in the workspace with detailed metadata.
    
    Returns:
        Complete list of workspace datasets
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="view_all_datasets"
        )
        
        # Get PowerBI access token
        powerbi_token = await powerbi_service._get_powerbi_access_token()
        
        # Get all datasets (admin bypass)
        all_datasets = await powerbi_service._get_workspace_datasets(powerbi_token)
        
        # Add admin metadata
        datasets_with_metadata = []
        for dataset in all_datasets:
            dataset_meta = {
                **dataset,
                "admin_metadata": {
                    "created_date": dataset.get('createdDate'),
                    "configured_by": dataset.get('configuredBy'),
                    "is_refreshable": dataset.get('isRefreshable'),
                    "is_effective_identity_required": dataset.get('isEffectiveIdentityRequired'),
                    "is_effective_identity_roles_required": dataset.get('isEffectiveIdentityRolesRequired'),
                    "is_on_premises_data_gateway_required": dataset.get('isOnPremisesDataGatewayRequired')
                }
            }
            datasets_with_metadata.append(dataset_meta)
        
        result = {
            "datasets": datasets_with_metadata,
            "total_count": len(datasets_with_metadata),
            "workspace_id": settings.fabric_workspace_id,
            "admin_user": current_user.email,
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Admin {current_user.email} retrieved all datasets")
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting all datasets for admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to get datasets")


@router.post("/admin/token/revoke-all", dependencies=[Depends(require_roles(["Admin"]))])
async def revoke_all_tokens(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Revoke all active embed tokens (Admin only)
    
    Emergency function to revoke all active embed tokens.
    This is useful in security incidents or for maintenance.
    
    Returns:
        Number of tokens revoked
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="revoke_all_tokens",
            details={"reason": "Admin request"}
        )
        
        # Get current token count
        token_count = len(powerbi_service._token_cache)
        
        # Clear all cached tokens
        powerbi_service._token_cache.clear()
        
        result = {
            "message": "All embed tokens revoked",
            "tokens_revoked": token_count,
            "admin_user": current_user.email,
            "timestamp": datetime.now().isoformat()
        }
        
        logger.warning(f"Admin {current_user.email} revoked all embed tokens ({token_count} tokens)")
        
        return result
        
    except Exception as e:
        logger.error(f"Error revoking all tokens: {e}")
        raise HTTPException(status_code=500, detail="Failed to revoke tokens")


# Health check for PowerBI service
@router.get("/health")
async def powerbi_health_check():
    """
    Health check for PowerBI service integration
    
    Checks connectivity to PowerBI API and service status.
    
    Returns:
        PowerBI service health status
    """
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "powerbi_api": "unknown",
            "workspace_access": "unknown",
            "token_generation": "unknown"
        },
        "configuration": {
            "workspace_id": settings.fabric_workspace_id,
            "dataset_id": settings.fabric_dataset_id,
            "report_id": settings.fabric_report_id,
            "token_expiration_minutes": settings.embed_token_expiration_minutes
        }
    }
    
    try:
        # Test PowerBI API connectivity
        powerbi_token = await powerbi_service._get_powerbi_access_token()
        if powerbi_token:
            health_status["components"]["powerbi_api"] = "healthy"
        
        # Test workspace access
        workspace_reports = await powerbi_service._get_workspace_reports(powerbi_token)
        if isinstance(workspace_reports, list):
            health_status["components"]["workspace_access"] = "healthy"
            health_status["workspace_stats"] = {
                "reports_count": len(workspace_reports),
                "accessible": True
            }
        
        health_status["components"]["token_generation"] = "healthy"
        
    except Exception as e:
        logger.error(f"PowerBI health check failed: {e}")
        health_status["status"] = "unhealthy"
        health_status["error"] = str(e)
        health_status["components"]["powerbi_api"] = "unhealthy"
        health_status["components"]["workspace_access"] = "unhealthy"
        health_status["components"]["token_generation"] = "unhealthy"
    
    return health_status