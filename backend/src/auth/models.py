"""
Data models for authentication and authorization
Defines User, Token, and related models using Pydantic
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr, validator
from enum import Enum


class UserRole(str, Enum):
    """Enumeration of user roles in the system"""
    ADMIN = "Admin"
    ROLE_A = "RolA"
    ROLE_B = "RolB" 
    PUBLIC = "Public"


class PowerBIRole(str, Enum):
    """PowerBI-specific roles for RLS"""
    ADMIN = "Admin"
    ROLE_A = "RolA"
    ROLE_B = "RolB"
    PUBLIC = "Public"


class TokenInfo(BaseModel):
    """Information extracted from validated JWT token"""
    
    user_id: str = Field(..., description="User's unique identifier (OID)")
    email: EmailStr = Field(..., description="User's email address")
    name: Optional[str] = Field(None, description="User's display name")
    tenant_id: str = Field(..., description="Azure AD tenant ID")
    audience: str = Field(..., description="Token audience (client ID)")
    issuer: str = Field(..., description="Token issuer")
    issued_at: datetime = Field(..., description="Token issue timestamp")
    expires_at: datetime = Field(..., description="Token expiration timestamp")
    scopes: List[str] = Field(default_factory=list, description="Token scopes")
    
    @validator('expires_at')
    def validate_expiration(cls, v, values):
        """Ensure token hasn't expired"""
        if v < datetime.now():
            raise ValueError("Token has expired")
        return v
    
    @property
    def is_expired(self) -> bool:
        """Check if token is expired"""
        return datetime.now() >= self.expires_at
    
    @property
    def time_until_expiry(self) -> int:
        """Get seconds until token expires"""
        if self.is_expired:
            return 0
        return int((self.expires_at - datetime.now()).total_seconds())
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class User(BaseModel):
    """User model with authentication and authorization information"""
    
    id: str = Field(..., description="User's unique identifier")
    email: EmailStr = Field(..., description="User's email address")
    name: Optional[str] = Field(None, description="User's display name")
    tenant_id: str = Field(..., description="Azure AD tenant ID")
    groups: List[str] = Field(default_factory=list, description="Entra ID groups")
    roles: List[str] = Field(default_factory=list, description="PowerBI roles")
    is_admin: bool = Field(default=False, description="Whether user is an admin")
    is_active: bool = Field(default=True, description="Whether user account is active")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")
    created_at: datetime = Field(default_factory=datetime.now, description="Account creation timestamp")
    
    @validator('roles')
    def validate_roles(cls, v):
        """Validate that roles are from allowed values"""
        allowed_roles = [role.value for role in UserRole]
        for role in v:
            if role not in allowed_roles:
                raise ValueError(f"Invalid role: {role}. Allowed roles: {allowed_roles}")
        return v
    
    @property
    def powerbi_roles(self) -> List[str]:
        """Get PowerBI-specific roles for RLS"""
        # Map system roles to PowerBI roles
        role_mapping = {
            UserRole.ADMIN: PowerBIRole.ADMIN,
            UserRole.ROLE_A: PowerBIRole.ROLE_A,
            UserRole.ROLE_B: PowerBIRole.ROLE_B,
            UserRole.PUBLIC: PowerBIRole.PUBLIC
        }
        
        return [role_mapping.get(role, PowerBIRole.PUBLIC).value for role in self.roles]
    
    @property
    def display_name(self) -> str:
        """Get user's display name or email if name not available"""
        return self.name or self.email
    
    def has_role(self, role: str) -> bool:
        """Check if user has a specific role"""
        return role in self.roles
    
    def has_any_role(self, roles: List[str]) -> bool:
        """Check if user has any of the specified roles"""
        return any(role in self.roles for role in roles)
    
    def has_admin_access(self) -> bool:
        """Check if user has admin access"""
        return self.is_admin or self.has_role(UserRole.ADMIN)
    
    def can_access_report(self, report_roles: List[str]) -> bool:
        """Check if user can access a report based on required roles"""
        if self.has_admin_access():
            return True
        return self.has_any_role(report_roles)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class UserCreate(BaseModel):
    """Model for creating new users (if needed)"""
    
    email: EmailStr = Field(..., description="User's email address")
    name: Optional[str] = Field(None, description="User's display name")
    groups: List[str] = Field(default_factory=list, description="Initial groups")
    is_admin: bool = Field(default=False, description="Whether user should be admin")


class UserUpdate(BaseModel):
    """Model for updating user information"""
    
    name: Optional[str] = Field(None, description="User's display name")
    groups: Optional[List[str]] = Field(None, description="Updated groups")
    is_admin: Optional[bool] = Field(None, description="Updated admin status")
    is_active: Optional[bool] = Field(None, description="Updated active status")


class UserResponse(BaseModel):
    """Public user information for API responses"""
    
    id: str
    email: str
    name: Optional[str]
    roles: List[str]
    is_admin: bool
    last_login: Optional[datetime]
    
    @classmethod
    def from_user(cls, user: User) -> "UserResponse":
        """Create UserResponse from User model"""
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            roles=user.roles,
            is_admin=user.is_admin,
            last_login=user.last_login
        )


class AuthenticationRequest(BaseModel):
    """Request model for authentication"""
    
    token: str = Field(..., description="JWT access token from Entra ID")
    
    @validator('token')
    def validate_token_format(cls, v):
        """Basic token format validation"""
        if not v or len(v) < 10:
            raise ValueError("Invalid token format")
        
        # Remove Bearer prefix if present
        if v.startswith('Bearer '):
            v = v[7:]
        
        # Basic JWT format check (should have 3 parts separated by dots)
        parts = v.split('.')
        if len(parts) != 3:
            raise ValueError("Invalid JWT format")
        
        return v


class AuthenticationResponse(BaseModel):
    """Response model for authentication"""
    
    user: UserResponse
    token_info: Dict[str, Any] = Field(..., description="Token metadata")
    expires_at: datetime = Field(..., description="Token expiration time")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class PowerBITokenRequest(BaseModel):
    """Request model for PowerBI embed token"""
    
    report_id: Optional[str] = Field(None, description="Specific report ID")
    dataset_id: Optional[str] = Field(None, description="Dataset ID") 
    workspace_id: Optional[str] = Field(None, description="Workspace ID (uses default if not provided)")
    access_level: str = Field(default="View", description="Access level for the token")
    
    @validator('access_level')
    def validate_access_level(cls, v):
        """Validate access level"""
        allowed_levels = ['View', 'Edit', 'Create']
        if v not in allowed_levels:
            raise ValueError(f"Invalid access level. Allowed: {allowed_levels}")
        return v


class PowerBITokenResponse(BaseModel):
    """Response model for PowerBI embed token"""
    
    token: str = Field(..., description="PowerBI embed token")
    token_id: str = Field(..., description="Unique token identifier")
    expiration: datetime = Field(..., description="Token expiration time")
    report_id: Optional[str] = Field(None, description="Report ID")
    embed_url: Optional[str] = Field(None, description="Embed URL for the report")
    roles: List[str] = Field(..., description="Applied RLS roles")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class PowerBIEmbedConfig(BaseModel):
    """Configuration for PowerBI embed"""
    
    type: str = Field(default="report", description="Type of content to embed")
    id: str = Field(..., description="Report/Dashboard ID")
    embed_url: str = Field(..., description="Embed URL")
    access_token: str = Field(..., description="Access token")
    token_type: str = Field(default="Embed", description="Token type")
    settings: Dict[str, Any] = Field(default_factory=dict, description="Embed settings")
    
    @validator('type')
    def validate_embed_type(cls, v):
        """Validate embed type"""
        allowed_types = ['report', 'dashboard', 'tile', 'qna', 'visual']
        if v not in allowed_types:
            raise ValueError(f"Invalid embed type. Allowed: {allowed_types}")
        return v


class SessionInfo(BaseModel):
    """User session information"""
    
    session_id: str = Field(..., description="Unique session identifier")
    user_id: str = Field(..., description="User identifier")
    created_at: datetime = Field(default_factory=datetime.now, description="Session creation time")
    last_activity: datetime = Field(default_factory=datetime.now, description="Last activity time")
    ip_address: Optional[str] = Field(None, description="User's IP address")
    user_agent: Optional[str] = Field(None, description="User's browser/agent")
    is_active: bool = Field(default=True, description="Whether session is active")
    
    @property
    def duration(self) -> int:
        """Get session duration in seconds"""
        return int((self.last_activity - self.created_at).total_seconds())
    
    @property
    def idle_time(self) -> int:
        """Get idle time in seconds"""
        return int((datetime.now() - self.last_activity).total_seconds())
    
    def update_activity(self) -> None:
        """Update last activity timestamp"""
        self.last_activity = datetime.now()
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class RolePermission(BaseModel):
    """Role-based permission model"""
    
    role: str = Field(..., description="Role name")
    permissions: List[str] = Field(..., description="List of permissions")
    description: Optional[str] = Field(None, description="Role description")
    
    @validator('role')
    def validate_role_name(cls, v):
        """Validate role name format"""
        if not v or len(v) < 2:
            raise ValueError("Role name must be at least 2 characters")
        return v


class SecurityEvent(BaseModel):
    """Security event model for logging"""
    
    event_type: str = Field(..., description="Type of security event")
    user_id: str = Field(..., description="User involved in the event")
    timestamp: datetime = Field(default_factory=datetime.now, description="Event timestamp")
    resource: Optional[str] = Field(None, description="Resource involved")
    action: Optional[str] = Field(None, description="Action performed")
    result: str = Field(..., description="Event result (SUCCESS/FAILURE)")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional event details")
    ip_address: Optional[str] = Field(None, description="Source IP address")
    user_agent: Optional[str] = Field(None, description="User agent string")
    
    @validator('result')
    def validate_result(cls, v):
        """Validate event result"""
        allowed_results = ['SUCCESS', 'FAILURE', 'WARNING']
        if v not in allowed_results:
            raise ValueError(f"Invalid result. Allowed: {allowed_results}")
        return v
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class APIError(BaseModel):
    """Standard API error response model"""
    
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Human-readable error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.now, description="Error timestamp")
    request_id: Optional[str] = Field(None, description="Request identifier for tracking")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class HealthCheck(BaseModel):
    """Health check response model"""
    
    status: str = Field(..., description="Service status")
    timestamp: datetime = Field(default_factory=datetime.now, description="Check timestamp")
    version: str = Field(..., description="Application version")
    environment: str = Field(..., description="Environment name")
    services: Dict[str, str] = Field(default_factory=dict, description="Dependent service statuses")
    
    @validator('status')
    def validate_status(cls, v):
        """Validate health status"""
        allowed_statuses = ['healthy', 'degraded', 'unhealthy']
        if v not in allowed_statuses:
            raise ValueError(f"Invalid status. Allowed: {allowed_statuses}")
        return v
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


# Request/Response models for specific endpoints

class GroupMembershipRequest(BaseModel):
    """Request to add/remove user from groups"""
    
    user_id: str = Field(..., description="User identifier")
    groups: List[str] = Field(..., description="Groups to add/remove")
    action: str = Field(..., description="Action to perform")
    
    @validator('action')
    def validate_action(cls, v):
        """Validate action type"""
        allowed_actions = ['add', 'remove', 'replace']
        if v not in allowed_actions:
            raise ValueError(f"Invalid action. Allowed: {allowed_actions}")
        return v


class UserListResponse(BaseModel):
    """Response model for user list endpoints"""
    
    users: List[UserResponse] = Field(..., description="List of users")
    total_count: int = Field(..., description="Total number of users")
    page: int = Field(default=1, description="Current page number")
    page_size: int = Field(default=50, description="Number of users per page")
    has_next: bool = Field(..., description="Whether there are more pages")


class ReportAccessRequest(BaseModel):
    """Request model for checking report access"""
    
    report_id: str = Field(..., description="Report identifier")
    user_id: Optional[str] = Field(None, description="User to check (defaults to current user)")


class ReportAccessResponse(BaseModel):
    """Response model for report access check"""
    
    report_id: str = Field(..., description="Report identifier")
    has_access: bool = Field(..., description="Whether user has access")
    roles: List[str] = Field(..., description="User's applicable roles")
    access_level: str = Field(..., description="Level of access granted")
    restrictions: List[str] = Field(default_factory=list, description="Any access restrictions")


# Utility models

class PaginationParams(BaseModel):
    """Standard pagination parameters"""
    
    page: int = Field(default=1, ge=1, description="Page number (1-based)")
    page_size: int = Field(default=50, ge=1, le=100, description="Items per page")
    
    @property
    def offset(self) -> int:
        """Calculate offset for database queries"""
        return (self.page - 1) * self.page_size


class SortParams(BaseModel):
    """Standard sorting parameters"""
    
    sort_by: str = Field(default="created_at", description="Field to sort by")
    sort_order: str = Field(default="desc", description="Sort order")
    
    @validator('sort_order')
    def validate_sort_order(cls, v):
        """Validate sort order"""
        allowed_orders = ['asc', 'desc']
        if v.lower() not in allowed_orders:
            raise ValueError(f"Invalid sort order. Allowed: {allowed_orders}")
        return v.lower()


class FilterParams(BaseModel):
    """Standard filtering parameters"""
    
    search: Optional[str] = Field(None, description="Search term")
    roles: Optional[List[str]] = Field(None, description="Filter by roles")
    is_admin: Optional[bool] = Field(None, description="Filter by admin status")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    created_after: Optional[datetime] = Field(None, description="Filter by creation date")
    created_before: Optional[datetime] = Field(None, description="Filter by creation date")


# Export all models
__all__ = [
    # Enums
    'UserRole',
    'PowerBIRole',
    
    # Core models
    'TokenInfo',
    'User',
    'UserCreate',
    'UserUpdate', 
    'UserResponse',
    
    # Authentication models
    'AuthenticationRequest',
    'AuthenticationResponse',
    
    # PowerBI models
    'PowerBITokenRequest',
    'PowerBITokenResponse',
    'PowerBIEmbedConfig',
    
    # Session models
    'SessionInfo',
    
    # Permission models
    'RolePermission',
    
    # Security models
    'SecurityEvent',
    
    # API models
    'APIError',
    'HealthCheck',
    
    # Request/Response models
    'GroupMembershipRequest',
    'UserListResponse',
    'ReportAccessRequest',
    'ReportAccessResponse',
    
    # Utility models
    'PaginationParams',
    'SortParams',
    'FilterParams'
]