"""
Authentication routes for Microsoft Fabric Embedded Backend
Handles user authentication, token validation, and session management
"""

import logging
from typing import Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer

from ..auth.entra_auth import entra_auth_service, TokenValidationError, UserInfoError
from ..auth.middleware import get_current_user_from_request, require_roles, require_admin
from ..auth.models import (
    AuthenticationRequest, 
    AuthenticationResponse, 
    UserResponse,
    User,
    APIError
)
from ..utils.logger import security_logger
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
security = HTTPBearer()

# Create router
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/validate", response_model=AuthenticationResponse)
async def validate_token(
    request: Request,
    auth_request: AuthenticationRequest
):
    """
    Validate JWT token and return user information
    
    This endpoint validates an Entra ID JWT token and returns the authenticated
    user's information including roles and permissions.
    """
    
    try:
        # Validate token
        token_info = await entra_auth_service.validate_token(auth_request.token)
        
        # Get user information
        user = await entra_auth_service.get_user_info(token_info)
        
        # Create response
        response = AuthenticationResponse(
            user=UserResponse.from_user(user),
            token_info={
                "tenant_id": token_info.tenant_id,
                "scopes": token_info.scopes,
                "issued_at": token_info.issued_at.isoformat(),
                "expires_at": token_info.expires_at.isoformat()
            },
            expires_at=token_info.expires_at
        )
        
        logger.info(f"Token validated successfully for user: {user.email}")
        return response
        
    except TokenValidationError as e:
        logger.warning(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail=str(e))
    
    except UserInfoError as e:
        logger.warning(f"User info retrieval failed: {e}")
        raise HTTPException(status_code=401, detail="Unable to retrieve user information")
    
    except Exception as e:
        logger.error(f"Unexpected error during authentication: {e}")
        raise HTTPException(status_code=500, detail="Authentication service error")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get current authenticated user's information
    
    Returns detailed information about the currently authenticated user,
    including roles, groups, and last login time.
    """
    
    logger.debug(f"Returning user info for: {current_user.email}")
    return UserResponse.from_user(current_user)


@router.post("/refresh")
async def refresh_user_info(
    request: Request,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Refresh user information from Entra ID
    
    Forces a refresh of the user's group memberships and role assignments
    from Microsoft Graph API.
    """
    
    try:
        # Clear user cache to force refresh
        await entra_auth_service.refresh_user_cache(current_user.id)
        
        # Get fresh user info (this will fetch from Graph API)
        # First we need to get a fresh token info - in practice this would
        # come from the frontend with a fresh token
        
        logger.info(f"User info refresh requested for: {current_user.email}")
        
        return {
            "message": "User information will be refreshed on next request",
            "user_id": current_user.id,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to refresh user info: {e}")
        raise HTTPException(status_code=500, detail="Failed to refresh user information")


@router.get("/permissions")
async def get_user_permissions(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get current user's permissions and role mappings
    
    Returns detailed information about what the user can access,
    including PowerBI roles and system permissions.
    """
    
    permissions = {
        "user_id": current_user.id,
        "email": current_user.email,
        "roles": current_user.roles,
        "powerbi_roles": current_user.powerbi_roles,
        "groups": current_user.groups,
        "is_admin": current_user.is_admin,
        "permissions": {
            "can_view_reports": len(current_user.roles) > 0,
            "can_access_admin": current_user.is_admin,
            "can_view_role_a_data": current_user.has_role("RolA") or current_user.is_admin,
            "can_view_role_b_data": current_user.has_role("RolB") or current_user.is_admin,
            "can_manage_users": current_user.is_admin,
            "can_generate_tokens": True  # All authenticated users can generate embed tokens
        },
        "access_matrix": {
            "reports": {
                "financial_report": current_user.has_any_role(["Admin", "RolA"]),
                "operational_report": current_user.has_any_role(["Admin", "RolB"]),
                "executive_dashboard": current_user.is_admin
            }
        }
    }
    
    logger.debug(f"Returning permissions for user: {current_user.email}")
    return permissions


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Logout current user
    
    Clears user session and logs the logout event.
    Note: JWT tokens cannot be invalidated server-side, so this primarily
    serves as a logging mechanism.
    """
    
    try:
        # Log logout event
        security_logger.log_user_login(
            user_id=current_user.email,
            success=True,  # Successful logout
            user_groups=current_user.groups,
            source_ip=request.client.host if request.client else "unknown",
            user_agent=request.headers.get("user-agent")
        )
        
        # Clear any server-side session data if applicable
        await entra_auth_service.refresh_user_cache(current_user.id)
        
        logger.info(f"User logged out: {current_user.email}")
        
        return {
            "message": "Logout successful",
            "user_id": current_user.id,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        # Don't fail logout for errors
        return {
            "message": "Logout completed with warnings",
            "timestamp": datetime.now().isoformat()
        }


@router.get("/roles")
async def get_available_roles():
    """
    Get list of available roles in the system
    
    Returns information about all available roles and their descriptions.
    Public endpoint for role discovery.
    """
    
    roles = {
        "system_roles": [
            {
                "name": "Admin",
                "description": "Full administrative access to all features and data",
                "powerbi_role": "Admin",
                "entra_group": "PBI-Admin"
            },
            {
                "name": "RolA", 
                "description": "Access to Role A specific data and reports",
                "powerbi_role": "RolA",
                "entra_group": "PBI-RolA"
            },
            {
                "name": "RolB",
                "description": "Access to Role B specific data and reports", 
                "powerbi_role": "RolB",
                "entra_group": "PBI-RolB"
            },
            {
                "name": "Public",
                "description": "Default role with limited access",
                "powerbi_role": "Public",
                "entra_group": None
            }
        ],
        "role_mappings": settings.entra_group_mappings,
        "description": "Role-based access control system for Microsoft Fabric Embedded App"
    }
    
    return roles


@router.get("/status")
async def get_auth_status(
    request: Request,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get authentication status and session information
    
    Returns current authentication status, token expiration info,
    and session details.
    """
    
    # Calculate session info (simplified)
    session_duration = (datetime.now() - current_user.last_login).total_seconds() if current_user.last_login else 0
    
    status = {
        "authenticated": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "is_admin": current_user.is_admin
        },
        "session": {
            "duration_seconds": int(session_duration),
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
            "request_id": getattr(request.state, 'request_id', None)
        },
        "security": {
            "source_ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent"),
            "secure_connection": request.url.scheme == "https"
        },
        "timestamp": datetime.now().isoformat()
    }
    
    return status


# Admin-only routes

@router.get("/users", dependencies=[Depends(require_admin())])
async def list_users(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    List all users (Admin only)
    
    Returns a list of all users in the system with their roles and status.
    This is a placeholder - in a real system, this would query a user database.
    """
    
    # Log admin action
    security_logger.log_admin_action(
        admin_user_id=current_user.email,
        action="list_users"
    )
    
    # In a real implementation, this would query a database
    # For now, return current user as example
    users = [
        {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "roles": current_user.roles,
            "groups": current_user.groups,
            "is_admin": current_user.is_admin,
            "is_active": current_user.is_active,
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None
        }
    ]
    
    logger.info(f"Admin {current_user.email} requested user list")
    
    return {
        "users": users,
        "total_count": len(users),
        "timestamp": datetime.now().isoformat()
    }


@router.post("/users/{user_id}/roles", dependencies=[Depends(require_admin())])
async def update_user_roles(
    user_id: str,
    roles_update: Dict[str, Any],
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Update user roles (Admin only)
    
    Allows administrators to modify user role assignments.
    This is a placeholder for role management functionality.
    """
    
    # Validate request
    if "roles" not in roles_update:
        raise HTTPException(status_code=400, detail="Missing 'roles' field")
    
    new_roles = roles_update["roles"]
    if not isinstance(new_roles, list):
        raise HTTPException(status_code=400, detail="Roles must be a list")
    
    # Log admin action
    security_logger.log_admin_action(
        admin_user_id=current_user.email,
        action="update_user_roles",
        target_user=user_id,
        details={"new_roles": new_roles}
    )
    
    # In a real implementation, this would update the user in the database
    # and potentially sync with Entra ID groups
    
    logger.info(f"Admin {current_user.email} updated roles for user {user_id}")
    
    return {
        "message": "User roles updated successfully",
        "user_id": user_id,
        "new_roles": new_roles,
        "updated_by": current_user.email,
        "timestamp": datetime.now().isoformat()
    }


@router.get("/audit", dependencies=[Depends(require_admin())])
async def get_audit_log(
    current_user: User = Depends(get_current_user_from_request),
    limit: int = 100
):
    """
    Get authentication audit log (Admin only)
    
    Returns recent authentication and authorization events for security monitoring.
    """
    
    # Log admin action
    security_logger.log_admin_action(
        admin_user_id=current_user.email,
        action="view_audit_log"
    )
    
    # In a real implementation, this would query audit logs from database/logging system
    # For now, return a placeholder response
    
    audit_events = [
        {
            "timestamp": datetime.now().isoformat(),
            "event_type": "USER_LOGIN",
            "user_id": current_user.email,
            "result": "SUCCESS",
            "details": "Admin accessed audit log"
        }
    ]
    
    logger.info(f"Admin {current_user.email} accessed audit log")
    
    return {
        "events": audit_events,
        "total_count": len(audit_events),
        "limit": limit,
        "timestamp": datetime.now().isoformat()
    }


# Health check for auth service
@router.get("/health")
async def auth_health_check():
    """
    Health check for authentication service
    
    Returns status of authentication dependencies and configuration.
    """
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "entra_id": "healthy",  # In real impl, would test Entra ID connectivity
            "token_validation": "healthy",
            "user_info_service": "healthy"
        },
        "configuration": {
            "tenant_id": settings.entra_tenant_id,
            "client_id": settings.entra_client_id,
            "authority": settings.entra_authority,
            "group_mappings_configured": bool(settings.entra_group_mappings)
        }
    }
    
    # Test basic functionality
    try:
        # Test MSAL app initialization
        app = entra_auth_service.msal_app
        if app:
            health_status["components"]["msal_client"] = "healthy"
        else:
            health_status["components"]["msal_client"] = "degraded"
            health_status["status"] = "degraded"
            
    except Exception as e:
        logger.error(f"Auth health check failed: {e}")
        health_status["status"] = "unhealthy"
        health_status["error"] = str(e)
    
    return health_status


# Error handlers
@router.exception_handler(HTTPException)
async def auth_http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions in auth routes"""
    
    error = APIError(
        error="AuthenticationError",
        message=exc.detail,
        request_id=getattr(request.state, 'request_id', None)
    )
    
    return error.dict()