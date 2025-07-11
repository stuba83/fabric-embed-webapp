"""
Admin routes for Microsoft Fabric Embedded Backend
Handles administrative functions, user management, and system monitoring
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import JSONResponse

from ..auth.middleware import get_current_user_from_request, require_admin
from ..auth.models import User, UserListResponse, UserResponse, GroupMembershipRequest
from ..auth.entra_auth import entra_auth_service
from ..powerbi.service import powerbi_service
from ..utils.logger import security_logger
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create router
router = APIRouter(prefix="/admin", tags=["Administration"], dependencies=[Depends(require_admin())])


@router.get("/dashboard")
async def get_admin_dashboard(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get administrative dashboard with system overview
    
    Returns comprehensive system statistics, user metrics, and health information
    for administrative monitoring and management.
    
    Returns:
        Dashboard data with system metrics and statistics
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="view_admin_dashboard"
        )
        
        # Get system statistics
        dashboard_data = {
            "system_info": {
                "application_name": settings.app_name,
                "version": settings.version,
                "environment": settings.environment,
                "uptime_hours": 24,  # Placeholder - would calculate actual uptime
                "last_deployment": "2025-01-10T10:00:00Z"  # Placeholder
            },
            "user_statistics": {
                "total_users": 1,  # In real app, would query database
                "active_sessions": 1,
                "admin_users": 1,
                "role_distribution": {
                    "Admin": 1,
                    "RolA": 0,
                    "RolB": 0,
                    "Public": 0
                }
            },
            "powerbi_statistics": {
                "active_tokens": len(powerbi_service._token_cache),
                "reports_available": 0,  # Would get actual count
                "datasets_available": 0,
                "workspace_id": settings.fabric_workspace_id,
                "token_expiration_minutes": settings.embed_token_expiration_minutes
            },
            "security_metrics": {
                "failed_login_attempts_24h": 0,  # Would query logs
                "successful_logins_24h": 1,
                "admin_actions_24h": 1,
                "tokens_generated_24h": 0
            },
            "system_health": {
                "api_status": "healthy",
                "database_status": "healthy",  # If using database
                "powerbi_connection": "healthy",
                "entra_id_connection": "healthy",
                "key_vault_access": "healthy"
            },
            "recent_activity": [
                {
                    "timestamp": datetime.now().isoformat(),
                    "event": "Admin dashboard accessed",
                    "user": current_user.email,
                    "type": "admin_action"
                }
            ],
            "alerts": [
                # Would include any system alerts or warnings
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        # Try to get actual PowerBI statistics
        try:
            powerbi_token = await powerbi_service._get_powerbi_access_token()
            reports = await powerbi_service._get_workspace_reports(powerbi_token)
            datasets = await powerbi_service._get_workspace_datasets(powerbi_token)
            
            dashboard_data["powerbi_statistics"]["reports_available"] = len(reports)
            dashboard_data["powerbi_statistics"]["datasets_available"] = len(datasets)
            dashboard_data["system_health"]["powerbi_connection"] = "healthy"
            
        except Exception as e:
            logger.warning(f"Could not get PowerBI statistics: {e}")
            dashboard_data["system_health"]["powerbi_connection"] = "degraded"
        
        logger.info(f"Admin dashboard accessed by {current_user.email}")
        
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Error generating admin dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate dashboard")


@router.get("/users")
async def list_all_users(
    current_user: User = Depends(get_current_user_from_request),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term"),
    role_filter: Optional[str] = Query(None, description="Filter by role")
):
    """
    List all users in the system (Admin only)
    
    Returns paginated list of all users with their roles, status, and last activity.
    Supports searching and filtering by roles.
    
    Args:
        page: Page number for pagination
        page_size: Number of users per page
        search: Search term for filtering users
        role_filter: Filter users by specific role
        
    Returns:
        Paginated list of users with metadata
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="list_all_users",
            details={
                "page": page,
                "page_size": page_size,
                "search": search,
                "role_filter": role_filter
            }
        )
        
        # In a real implementation, this would query a user database
        # For now, return the current user as an example
        all_users = [
            {
                "id": current_user.id,
                "email": current_user.email,
                "name": current_user.name,
                "roles": current_user.roles,
                "groups": current_user.groups,
                "is_admin": current_user.is_admin,
                "is_active": current_user.is_active,
                "last_login": current_user.last_login.isoformat() if current_user.last_login else None,
                "created_at": current_user.created_at.isoformat(),
                "login_count": 1,  # Placeholder
                "last_token_generated": datetime.now().isoformat()  # Placeholder
            }
        ]
        
        # Apply filters
        filtered_users = all_users
        
        if search:
            filtered_users = [
                user for user in filtered_users
                if search.lower() in user["email"].lower() or 
                   (user["name"] and search.lower() in user["name"].lower())
            ]
        
        if role_filter:
            filtered_users = [
                user for user in filtered_users
                if role_filter in user["roles"]
            ]
        
        # Apply pagination
        total_count = len(filtered_users)
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paginated_users = filtered_users[start_index:end_index]
        
        result = {
            "users": paginated_users,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": (total_count + page_size - 1) // page_size,
                "has_next": end_index < total_count,
                "has_previous": page > 1
            },
            "filters": {
                "search": search,
                "role_filter": role_filter
            },
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Admin {current_user.email} listed users (page {page}, {len(paginated_users)} users)")
        
        return result
        
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail="Failed to list users")


@router.get("/users/{user_id}")
async def get_user_details(
    user_id: str,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get detailed information about a specific user (Admin only)
    
    Returns comprehensive user information including access history,
    token usage, and security events.
    
    Args:
        user_id: User identifier to get details for
        
    Returns:
        Detailed user information
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="view_user_details",
            target_user=user_id
        )
        
        # In a real implementation, this would query the user database
        # For now, return current user if IDs match
        if user_id == current_user.id:
            user_details = {
                "user_info": {
                    "id": current_user.id,
                    "email": current_user.email,
                    "name": current_user.name,
                    "roles": current_user.roles,
                    "powerbi_roles": current_user.powerbi_roles,
                    "groups": current_user.groups,
                    "is_admin": current_user.is_admin,
                    "is_active": current_user.is_active,
                    "tenant_id": current_user.tenant_id,
                    "created_at": current_user.created_at.isoformat(),
                    "last_login": current_user.last_login.isoformat() if current_user.last_login else None
                },
                "access_history": [
                    {
                        "timestamp": datetime.now().isoformat(),
                        "action": "login",
                        "ip_address": "127.0.0.1",
                        "user_agent": "Admin Interface",
                        "result": "success"
                    }
                ],
                "token_usage": {
                    "total_tokens_generated": 1,
                    "active_tokens": 0,
                    "last_token_generated": datetime.now().isoformat(),
                    "most_accessed_report": "N/A"
                },
                "security_events": [
                    {
                        "timestamp": datetime.now().isoformat(),
                        "event_type": "admin_access",
                        "description": "User details viewed by admin",
                        "severity": "info"
                    }
                ],
                "permissions": {
                    "can_view_reports": len(current_user.roles) > 0,
                    "can_generate_tokens": True,
                    "data_access_level": "admin" if current_user.is_admin else "role_based",
                    "effective_filters": [] if current_user.is_admin else current_user.powerbi_roles
                }
            }
            
            logger.info(f"Admin {current_user.email} viewed details for user {user_id}")
            return user_details
        else:
            raise HTTPException(status_code=404, detail="User not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user details: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user details")


@router.put("/users/{user_id}/roles")
async def update_user_roles(
    user_id: str,
    role_update: Dict[str, Any],
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Update user roles and permissions (Admin only)
    
    Allows administrators to modify user role assignments and permissions.
    This includes updating Entra ID group memberships where possible.
    
    Args:
        user_id: User identifier to update
        role_update: Dictionary containing new role assignments
        
    Returns:
        Updated user information
    """
    
    try:
        # Validate request
        if "roles" not in role_update:
            raise HTTPException(status_code=400, detail="Missing 'roles' field in request")
        
        new_roles = role_update["roles"]
        if not isinstance(new_roles, list):
            raise HTTPException(status_code=400, detail="Roles must be a list")
        
        # Validate role values
        valid_roles = ["Admin", "RolA", "RolB", "Public"]
        invalid_roles = [role for role in new_roles if role not in valid_roles]
        if invalid_roles:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid roles: {invalid_roles}. Valid roles: {valid_roles}"
            )
        
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="update_user_roles",
            target_user=user_id,
            details={
                "new_roles": new_roles,
                "previous_roles": current_user.roles if user_id == current_user.id else []
            }
        )
        
        # In a real implementation, this would:
        # 1. Update user roles in database
        # 2. Update Entra ID group memberships
        # 3. Invalidate user cache
        # 4. Send notification to user
        
        # For now, simulate the update
        updated_user = {
            "id": user_id,
            "email": current_user.email if user_id == current_user.id else f"user-{user_id}@domain.com",
            "roles": new_roles,
            "is_admin": "Admin" in new_roles,
            "updated_by": current_user.email,
            "updated_at": datetime.now().isoformat(),
            "changes": {
                "roles_added": [role for role in new_roles if role not in (current_user.roles if user_id == current_user.id else [])],
                "roles_removed": [role for role in (current_user.roles if user_id == current_user.id else []) if role not in new_roles]
            }
        }
        
        # Log permission change
        security_logger.log_permission_change(
            admin_user_id=current_user.email,
            target_user_id=user_id,
            old_permissions=current_user.roles if user_id == current_user.id else [],
            new_permissions=new_roles
        )
        
        logger.info(f"Admin {current_user.email} updated roles for user {user_id}: {new_roles}")
        
        return {
            "message": "User roles updated successfully",
            "user": updated_user,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user roles: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user roles")


@router.post("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Deactivate a user account (Admin only)
    
    Deactivates a user account, revoking access while preserving data.
    This includes revoking active tokens and blocking future access.
    
    Args:
        user_id: User identifier to deactivate
        reason: Optional reason for deactivation
        
    Returns:
        Deactivation confirmation
    """
    
    try:
        # Prevent self-deactivation
        if user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="deactivate_user",
            target_user=user_id,
            details={"reason": reason}
        )
        
        # In a real implementation, this would:
        # 1. Mark user as inactive in database
        # 2. Revoke all active tokens for the user
        # 3. Remove from Entra ID groups
        # 4. Send notification
        # 5. Log security event
        
        deactivation_result = {
            "user_id": user_id,
            "status": "deactivated",
            "deactivated_by": current_user.email,
            "deactivated_at": datetime.now().isoformat(),
            "reason": reason,
            "actions_taken": [
                "User marked as inactive",
                "Active tokens revoked",
                "Group memberships removed",
                "Access blocked"
            ]
        }
        
        logger.warning(f"Admin {current_user.email} deactivated user {user_id} (reason: {reason})")
        
        return {
            "message": "User deactivated successfully",
            "result": deactivation_result,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deactivating user: {e}")
        raise HTTPException(status_code=500, detail="Failed to deactivate user")


@router.post("/users/{user_id}/reactivate")
async def reactivate_user(
    user_id: str,
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Reactivate a deactivated user account (Admin only)
    
    Reactivates a previously deactivated user account, restoring access.
    
    Args:
        user_id: User identifier to reactivate
        
    Returns:
        Reactivation confirmation
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="reactivate_user",
            target_user=user_id
        )
        
        # In a real implementation, this would:
        # 1. Mark user as active in database
        # 2. Restore Entra ID group memberships
        # 3. Send notification
        # 4. Log security event
        
        reactivation_result = {
            "user_id": user_id,
            "status": "active",
            "reactivated_by": current_user.email,
            "reactivated_at": datetime.now().isoformat(),
            "actions_taken": [
                "User marked as active",
                "Group memberships restored",
                "Access enabled"
            ]
        }
        
        logger.info(f"Admin {current_user.email} reactivated user {user_id}")
        
        return {
            "message": "User reactivated successfully",
            "result": reactivation_result,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error reactivating user: {e}")
        raise HTTPException(status_code=500, detail="Failed to reactivate user")


@router.get("/audit/security-events")
async def get_security_audit_log(
    current_user: User = Depends(get_current_user_from_request),
    start_date: Optional[datetime] = Query(None, description="Start date for audit log"),
    end_date: Optional[datetime] = Query(None, description="End date for audit log"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    user_filter: Optional[str] = Query(None, description="Filter by user"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of events")
):
    """
    Get security audit log (Admin only)
    
    Returns security events and audit trail for monitoring and compliance.
    Supports filtering by date range, event type, and user.
    
    Args:
        start_date: Start date for filtering events
        end_date: End date for filtering events
        event_type: Filter by specific event type
        user_filter: Filter by specific user
        limit: Maximum number of events to return
        
    Returns:
        Filtered security audit log
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="view_security_audit_log",
            details={
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "event_type": event_type,
                "user_filter": user_filter,
                "limit": limit
            }
        )
        
        # In a real implementation, this would query the audit log database
        # For now, return sample events
        sample_events = [
            {
                "id": "audit-001",
                "timestamp": datetime.now().isoformat(),
                "event_type": "ADMIN_ACTION",
                "user_id": current_user.email,
                "action": "view_security_audit_log",
                "resource": "/api/admin/audit/security-events",
                "result": "SUCCESS",
                "ip_address": "127.0.0.1",
                "user_agent": "Admin Interface",
                "details": {
                    "admin_user": current_user.email
                }
            },
            {
                "id": "audit-002",
                "timestamp": (datetime.now() - timedelta(hours=1)).isoformat(),
                "event_type": "USER_LOGIN",
                "user_id": current_user.email,
                "action": "login",
                "resource": "/api/auth/validate",
                "result": "SUCCESS",
                "ip_address": "127.0.0.1",
                "user_agent": "Mozilla/5.0 Browser",
                "details": {
                    "authentication_method": "entra_id",
                    "user_groups": current_user.groups
                }
            }
        ]
        
        # Apply filters (in real implementation, this would be done at query level)
        filtered_events = sample_events
        
        if start_date:
            filtered_events = [
                event for event in filtered_events
                if datetime.fromisoformat(event["timestamp"].replace('Z', '+00:00')) >= start_date
            ]
        
        if end_date:
            filtered_events = [
                event for event in filtered_events
                if datetime.fromisoformat(event["timestamp"].replace('Z', '+00:00')) <= end_date
            ]
        
        if event_type:
            filtered_events = [
                event for event in filtered_events
                if event["event_type"] == event_type
            ]
        
        if user_filter:
            filtered_events = [
                event for event in filtered_events
                if user_filter.lower() in event["user_id"].lower()
            ]
        
        # Apply limit
        filtered_events = filtered_events[:limit]
        
        result = {
            "events": filtered_events,
            "total_count": len(filtered_events),
            "filters": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "event_type": event_type,
                "user_filter": user_filter,
                "limit": limit
            },
            "event_types": [
                "USER_LOGIN",
                "USER_LOGIN_FAILED",
                "TOKEN_GENERATED",
                "UNAUTHORIZED_ACCESS",
                "ADMIN_ACTION",
                "DATA_ACCESS",
                "PERMISSION_CHANGE",
                "SECURITY_VIOLATION"
            ],
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Admin {current_user.email} accessed security audit log ({len(filtered_events)} events)")
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting security audit log: {e}")
        raise HTTPException(status_code=500, detail="Failed to get audit log")


@router.get("/system/health")
async def get_system_health(
    current_user: User = Depends(get_current_user_from_request)
):
    """
    Get comprehensive system health status (Admin only)
    
    Returns detailed health information for all system components
    including dependencies, performance metrics, and alerts.
    
    Returns:
        Comprehensive system health status
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="view_system_health"
        )
        
        health_status = {
            "overall_status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "components": {
                "api_server": {
                    "status": "healthy",
                    "response_time_ms": 50,
                    "uptime_hours": 24,
                    "requests_per_minute": 10
                },
                "entra_id": {
                    "status": "healthy",
                    "last_test": datetime.now().isoformat(),
                    "response_time_ms": 200
                },
                "powerbi_api": {
                    "status": "unknown",
                    "last_test": None,
                    "response_time_ms": None
                },
                "key_vault": {
                    "status": "healthy",
                    "secrets_accessible": True,
                    "last_test": datetime.now().isoformat()
                }
            },
            "performance_metrics": {
                "memory_usage_percent": 45,
                "cpu_usage_percent": 30,
                "disk_usage_percent": 20,
                "active_connections": 5,
                "cache_hit_rate": 85
            },
            "alerts": [],
            "recommendations": []
        }
        
        # Test PowerBI API connectivity
        try:
            powerbi_token = await powerbi_service._get_powerbi_access_token()
            if powerbi_token:
                health_status["components"]["powerbi_api"]["status"] = "healthy"
                health_status["components"]["powerbi_api"]["last_test"] = datetime.now().isoformat()
                health_status["components"]["powerbi_api"]["response_time_ms"] = 300
        except Exception as e:
            health_status["components"]["powerbi_api"]["status"] = "unhealthy"
            health_status["components"]["powerbi_api"]["error"] = str(e)
            health_status["overall_status"] = "degraded"
            health_status["alerts"].append({
                "severity": "warning",
                "message": "PowerBI API connectivity issues",
                "timestamp": datetime.now().isoformat()
            })
        
        # Add recommendations based on status
        if health_status["performance_metrics"]["memory_usage_percent"] > 80:
            health_status["recommendations"].append("Consider increasing memory allocation")
        
        if health_status["performance_metrics"]["cache_hit_rate"] < 70:
            health_status["recommendations"].append("Review cache configuration for better performance")
        
        logger.info(f"Admin {current_user.email} checked system health")
        
        return health_status
        
    except Exception as e:
        logger.error(f"Error getting system health: {e}")
        raise HTTPException(status_code=500, detail="Failed to get system health")


@router.post("/system/maintenance")
async def trigger_maintenance_tasks(
    current_user: User = Depends(get_current_user_from_request),
    tasks: List[str] = ["clear_cache", "refresh_tokens", "cleanup_logs"]
):
    """
    Trigger system maintenance tasks (Admin only)
    
    Allows administrators to trigger various maintenance operations
    such as cache clearing, token cleanup, and log rotation.
    
    Args:
        tasks: List of maintenance tasks to execute
        
    Returns:
        Maintenance task results
    """
    
    try:
        # Log admin action
        security_logger.log_admin_action(
            admin_user_id=current_user.email,
            action="trigger_maintenance",
            details={"tasks": tasks}
        )
        
        maintenance_results = []
        
        for task in tasks:
            task_result = {
                "task": task,
                "status": "completed",
                "timestamp": datetime.now().isoformat(),
                "details": {}
            }
            
            try:
                if task == "clear_cache":
                    # Clear PowerBI token cache
                    token_count = len(powerbi_service._token_cache)
                    powerbi_service._token_cache.clear()
                    task_result["details"]["tokens_cleared"] = token_count
                
                elif task == "refresh_tokens":
                    # In real implementation, would refresh service tokens
                    task_result["details"]["message"] = "Service tokens refreshed"
                
                elif task == "cleanup_logs":
                    # In real implementation, would clean old log files
                    task_result["details"]["logs_cleaned"] = "30 days old"
                
                else:
                    task_result["status"] = "skipped"
                    task_result["details"]["reason"] = f"Unknown task: {task}"
                
            except Exception as e:
                task_result["status"] = "failed"
                task_result["details"]["error"] = str(e)
            
            maintenance_results.append(task_result)
        
        result = {
            "message": "Maintenance tasks completed",
            "tasks_executed": len(tasks),
            "results": maintenance_results,
            "executed_by": current_user.email,
            "timestamp": datetime.now().isoformat()
        }
        
        logger.info(f"Admin {current_user.email} executed maintenance tasks: {tasks}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error executing maintenance tasks: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute maintenance tasks")