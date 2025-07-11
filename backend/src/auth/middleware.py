"""
Authentication and Authorization Middleware for FastAPI
Handles JWT token validation, user context, and role-based access control
"""

import logging
import uuid
from typing import List, Optional, Callable, Any
from fastapi import Request, Response, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from .entra_auth import entra_auth_service, TokenValidationError, UserInfoError
from .models import User, APIError
from ..utils.logger import security_logger, get_request_logger
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Security scheme for FastAPI docs
security_scheme = HTTPBearer(auto_error=False)


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle authentication for all requests
    Adds user context to request state and handles auth errors
    """
    
    # Paths that don't require authentication
    PUBLIC_PATHS = {
        "/health",
        "/docs",
        "/redoc", 
        "/openapi.json",
        "/favicon.ico"
    }
    
    def __init__(self, app):
        super().__init__(app)
        self.logger = logging.getLogger(__name__)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request through authentication middleware"""
        
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Get request logger
        req_logger = get_request_logger(request_id)
        
        # Log incoming request
        req_logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            query_params=str(request.query_params),
            user_agent=request.headers.get("user-agent"),
            client_ip=self._get_client_ip(request)
        )
        
        # Skip authentication for public paths
        if self._is_public_path(request.url.path):
            response = await call_next(request)
            return response
        
        # Extract and validate token
        try:
            token = self._extract_token(request)
            if token:
                # Validate token and get user info
                user = await self._authenticate_user(token, request)
                request.state.user = user
                request.state.authenticated = True
                
                req_logger.info(
                    "User authenticated",
                    user_id=user.email,
                    user_roles=user.roles,
                    is_admin=user.is_admin
                )
            else:
                # No token provided
                request.state.user = None
                request.state.authenticated = False
                
                # Check if authentication is required for this path
                if self._requires_auth(request.url.path):
                    return self._create_auth_error_response(
                        "Authentication required",
                        request_id
                    )
        
        except TokenValidationError as e:
            self.logger.warning(f"Token validation failed: {e}")
            return self._create_auth_error_response(str(e), request_id)
        
        except UserInfoError as e:
            self.logger.warning(f"User info retrieval failed: {e}")
            return self._create_auth_error_response(
                "Unable to retrieve user information",
                request_id
            )
        
        except Exception as e:
            self.logger.error(f"Unexpected authentication error: {e}")
            return self._create_auth_error_response(
                "Authentication service unavailable",
                request_id
            )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Log successful response
            req_logger.info(
                "Request completed",
                status_code=response.status_code,
                authenticated=getattr(request.state, 'authenticated', False)
            )
            
            return response
            
        except Exception as e:
            self.logger.error(f"Request processing error: {e}")
            raise
    
    def _is_public_path(self, path: str) -> bool:
        """Check if path is public (doesn't require auth)"""
        # Exact match
        if path in self.PUBLIC_PATHS:
            return True
        
        # Pattern matching for API docs
        if path.startswith(('/docs', '/redoc', '/openapi')):
            return True
        
        return False
    
    def _requires_auth(self, path: str) -> bool:
        """Check if path requires authentication"""
        # All API paths require auth except health checks
        if path.startswith('/api/'):
            return path not in ['/api/health']
        
        return False
    
    def _extract_token(self, request: Request) -> Optional[str]:
        """Extract JWT token from request headers"""
        
        # Check Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]  # Remove "Bearer " prefix
        
        # Check for token in query parameters (fallback)
        token = request.query_params.get("token")
        if token:
            self.logger.warning("Token provided in query params - not recommended")
            return token
        
        return None
    
    async def _authenticate_user(self, token: str, request: Request) -> User:
        """Authenticate user and return user object"""
        
        # Validate token
        token_info = await entra_auth_service.validate_token(token)
        
        # Get user information
        user = await entra_auth_service.get_user_info(token_info)
        
        # Log successful authentication
        security_logger.log_user_login(
            user_id=user.email,
            success=True,
            user_groups=user.groups,
            source_ip=self._get_client_ip(request),
            user_agent=request.headers.get("user-agent")
        )
        
        return user
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request"""
        
        # Check X-Forwarded-For header (from load balancers)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client address
        if hasattr(request, "client") and request.client:
            return request.client.host
        
        return "unknown"
    
    def _create_auth_error_response(self, message: str, request_id: str) -> JSONResponse:
        """Create standardized authentication error response"""
        
        error = APIError(
            error="AuthenticationError",
            message=message,
            request_id=request_id
        )
        
        return JSONResponse(
            status_code=401,
            content=error.dict(),
            headers={"WWW-Authenticate": "Bearer"}
        )


# Dependency functions for FastAPI route protection

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> User:
    """
    FastAPI dependency to get current authenticated user
    
    Raises:
        HTTPException: If user not authenticated
    """
    
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    try:
        # Get user from middleware (should already be validated)
        # This is a fallback in case middleware didn't run
        user = await entra_auth_service.get_current_user(credentials.credentials)
        return user
        
    except (TokenValidationError, UserInfoError) as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"}
        )


async def get_current_user_from_request(request: Request) -> User:
    """
    Get current user from request state (set by middleware)
    
    Args:
        request: FastAPI request object
        
    Returns:
        User: Current authenticated user
        
    Raises:
        HTTPException: If user not authenticated
    """
    
    if not hasattr(request.state, 'authenticated') or not request.state.authenticated:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    if not hasattr(request.state, 'user') or not request.state.user:
        raise HTTPException(
            status_code=401,
            detail="User information not available"
        )
    
    return request.state.user


def require_roles(allowed_roles: List[str]):
    """
    Decorator factory for role-based access control
    
    Args:
        allowed_roles: List of roles that can access the endpoint
        
    Returns:
        Dependency function for FastAPI
    """
    
    async def check_roles(
        request: Request,
        current_user: User = Depends(get_current_user_from_request)
    ) -> User:
        """Check if user has required roles"""
        
        # Admin users can access everything
        if current_user.is_admin:
            return current_user
        
        # Check if user has any of the required roles
        if not entra_auth_service.validate_user_roles(current_user, allowed_roles):
            # Log unauthorized access attempt
            security_logger.log_unauthorized_access(
                user_id=current_user.email,
                resource=request.url.path,
                required_roles=allowed_roles,
                user_roles=current_user.roles,
                source_ip=request.client.host if request.client else "unknown"
            )
            
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required roles: {allowed_roles}"
            )
        
        return current_user
    
    return check_roles


def require_admin():
    """
    Decorator for admin-only endpoints
    
    Returns:
        Dependency function for FastAPI
    """
    
    async def check_admin(
        request: Request,
        current_user: User = Depends(get_current_user_from_request)
    ) -> User:
        """Check if user is admin"""
        
        if not current_user.is_admin:
            # Log unauthorized admin access attempt
            security_logger.log_unauthorized_access(
                user_id=current_user.email,
                resource=request.url.path,
                required_roles=["Admin"],
                user_roles=current_user.roles,
                source_ip=request.client.host if request.client else "unknown"
            )
            
            raise HTTPException(
                status_code=403,
                detail="Admin access required"
            )
        
        return current_user
    
    return check_admin


# Rate limiting middleware
class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware"""
    
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts = {}  # In production, use Redis
        self.logger = logging.getLogger(__name__)
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Apply rate limiting"""
        
        # Get client identifier
        client_id = self._get_client_identifier(request)
        
        # Check rate limit
        if await self._is_rate_limited(client_id):
            self.logger.warning(f"Rate limit exceeded for client: {client_id}")
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "RateLimitExceeded",
                    "message": f"Rate limit exceeded: {self.requests_per_minute} requests per minute"
                },
                headers={"Retry-After": "60"}
            )
        
        # Process request
        response = await call_next(request)
        return response
    
    def _get_client_identifier(self, request: Request) -> str:
        """Get unique identifier for client"""
        
        # Use user ID if authenticated
        if hasattr(request.state, 'user') and request.state.user:
            return f"user:{request.state.user.id}"
        
        # Fallback to IP address
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"
    
    async def _is_rate_limited(self, client_id: str) -> bool:
        """Check if client is rate limited"""
        # This is a simple in-memory implementation
        # In production, use Redis with sliding window
        
        import time
        current_time = time.time()
        
        # Clean old entries (older than 1 minute)
        cutoff_time = current_time - 60
        
        if client_id not in self.request_counts:
            self.request_counts[client_id] = []
        
        # Remove old requests
        self.request_counts[client_id] = [
            timestamp for timestamp in self.request_counts[client_id]
            if timestamp > cutoff_time
        ]
        
        # Check if limit exceeded
        if len(self.request_counts[client_id]) >= self.requests_per_minute:
            return True
        
        # Add current request
        self.request_counts[client_id].append(current_time)
        return False


# CORS middleware configuration
def configure_cors_middleware(app):
    """Configure CORS middleware for the application"""
    from fastapi.middleware.cors import CORSMiddleware
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"]
    )


# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add security headers"""
        
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Add request ID header
        if hasattr(request.state, 'request_id'):
            response.headers["X-Request-ID"] = request.state.request_id
        
        # HSTS in production
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        return response


# Export middleware classes and dependencies
__all__ = [
    'AuthMiddleware',
    'RateLimitMiddleware', 
    'SecurityHeadersMiddleware',
    'get_current_user',
    'get_current_user_from_request',
    'require_roles',
    'require_admin',
    'configure_cors_middleware'
]