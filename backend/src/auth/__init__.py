# backend/src/__init__.py
"""
Microsoft Fabric Embedded Backend
Main package initialization
"""

__version__ = "1.0.0"
__author__ = "Microsoft Fabric Embedded Team"
__description__ = "Backend API for Microsoft Fabric embedded application with Entra ID authentication"

# ============================================================================

# backend/src/auth/__init__.py
"""
Authentication and Authorization module
Handles Entra ID integration, JWT validation, and user management
"""

from .entra_auth import (
    entra_auth_service,
    validate_token,
    get_user_info,
    get_current_user,
    validate_user_roles
)
from .middleware import (
    AuthMiddleware,
    get_current_user_from_request,
    require_roles,
    require_admin
)
from .models import (
    User,
    TokenInfo,
    UserResponse,
    AuthenticationRequest,
    AuthenticationResponse
)

__all__ = [
    # Services
    'entra_auth_service',
    'validate_token',
    'get_user_info', 
    'get_current_user',
    'validate_user_roles',
    
    # Middleware
    'AuthMiddleware',
    'get_current_user_from_request',
    'require_roles',
    'require_admin',
    
    # Models
    'User',
    'TokenInfo',
    'UserResponse',
    'AuthenticationRequest',
    'AuthenticationResponse'
]

# ============================================================================

# backend/src/powerbi/__init__.py
"""
PowerBI and Microsoft Fabric integration module
Handles embed tokens, RLS, and report management
"""

from .service import (
    powerbi_service,
    generate_embed_token,
    get_user_reports,
    get_user_datasets
)
from .embed_service import (
    embed_service,
    embed_token_manager,
    generate_multi_report_token,
    refresh_embed_token,
    get_token_analytics
)
from .rls_service import (
    rls_service,
    get_user_rls_mapping,
    validate_rls_configuration,
    test_user_rls
)

__all__ = [
    # Main PowerBI service
    'powerbi_service',
    'generate_embed_token',
    'get_user_reports',
    'get_user_datasets',
    
    # Advanced embed service
    'embed_service',
    'embed_token_manager',
    'generate_multi_report_token',
    'refresh_embed_token',
    'get_token_analytics',
    
    # RLS service
    'rls_service',
    'get_user_rls_mapping',
    'validate_rls_configuration',
    'test_user_rls'
]

# ============================================================================

# backend/src/models/__init__.py
"""
Data models module
Contains all Pydantic models for request/response validation
"""

from ..auth.models import (
    User,
    TokenInfo,
    UserResponse,
    UserRole,
    PowerBIRole,
    AuthenticationRequest,
    AuthenticationResponse,
    PowerBITokenRequest,
    PowerBITokenResponse,
    PowerBIEmbedConfig,
    APIError,
    HealthCheck
)

__all__ = [
    # User models
    'User',
    'TokenInfo', 
    'UserResponse',
    'UserRole',
    'PowerBIRole',
    
    # Request/Response models
    'AuthenticationRequest',
    'AuthenticationResponse',
    'PowerBITokenRequest',
    'PowerBITokenResponse',
    'PowerBIEmbedConfig',
    
    # Utility models
    'APIError',
    'HealthCheck'
]

# ============================================================================

# backend/src/routes/__init__.py
"""
API routes module
Contains all FastAPI route definitions
"""

from .auth_routes import router as auth_router
from .powerbi_routes import router as powerbi_router  
from .admin_routes import router as admin_router

__all__ = [
    'auth_router',
    'powerbi_router',
    'admin_router'
]

# ============================================================================

# backend/src/utils/__init__.py
"""
Utilities module
Contains logging, helpers, and utility functions
"""

from .logger import (
    setup_logging,
    get_logger,
    get_security_logger,
    security_logger,
    SecurityLogger
)

__all__ = [
    'setup_logging',
    'get_logger',
    'get_security_logger', 
    'security_logger',
    'SecurityLogger'
]

# ============================================================================

# backend/tests/__init__.py
"""
Tests module
Contains all test files and fixtures
"""

# Test configuration and shared fixtures would go here