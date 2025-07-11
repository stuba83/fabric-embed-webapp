"""
FastAPI Application Factory for Microsoft Fabric Embedded Backend
Configures and creates the FastAPI application with all middleware and routes
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi

from .config import get_settings
from .utils.logger import setup_logging, get_logger, security_logger
from .auth.middleware import AuthMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware
from .routes import auth_router, powerbi_router, admin_router

# Setup logging first
setup_logging()
logger = get_logger(__name__)

# Get settings
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    
    # Startup
    logger.info("🚀 Starting Microsoft Fabric Embedded Backend")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info(f"Version: {settings.version}")
    
    # Validate critical configuration
    try:
        required_config = [
            ("ENTRA_TENANT_ID", settings.entra_tenant_id),
            ("ENTRA_CLIENT_ID", settings.entra_client_id),
            ("FABRIC_WORKSPACE_ID", settings.fabric_workspace_id)
        ]
        
        missing_config = [name for name, value in required_config if not value]
        if missing_config:
            raise ValueError(f"Missing required configuration: {missing_config}")
        
        logger.info("✅ Configuration validation passed")
        
        # Test external dependencies
        await _test_dependencies()
        
    except Exception as e:
        logger.error(f"❌ Startup validation failed: {e}")
        raise
    
    logger.info("🌟 Application startup completed successfully")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Microsoft Fabric Embedded Backend")
    logger.info("💾 Performing cleanup tasks...")
    
    # Cleanup tasks
    try:
        # Clear any caches
        from .powerbi.embed_service import embed_service
        if hasattr(embed_service, '_token_cache'):
            token_count = len(embed_service._token_cache)
            embed_service._token_cache.clear()
            logger.info(f"Cleared {token_count} cached embed tokens")
        
        logger.info("✅ Cleanup completed successfully")
        
    except Exception as e:
        logger.warning(f"⚠️ Cleanup warnings: {e}")
    
    logger.info("👋 Application shutdown completed")


async def _test_dependencies():
    """Test external dependencies during startup"""
    
    try:
        # Test Entra ID configuration
        from .auth.entra_auth import entra_auth_service
        
        # Test MSAL app initialization
        msal_app = entra_auth_service.msal_app
        if msal_app:
            logger.info("✅ Entra ID MSAL client initialized")
        else:
            logger.warning("⚠️ Entra ID MSAL client not initialized")
        
        # Test Key Vault access if configured
        if settings.key_vault_url:
            from .config import get_keyvault_settings
            kv_settings = get_keyvault_settings()
            if kv_settings.client:
                logger.info("✅ Azure Key Vault connection established")
            else:
                logger.warning("⚠️ Azure Key Vault connection not available")
        
        # Test PowerBI API access (optional - don't fail startup)
        try:
            from .powerbi.service import powerbi_service
            powerbi_token = await powerbi_service._get_powerbi_access_token()
            if powerbi_token:
                logger.info("✅ PowerBI API connection successful")
            else:
                logger.warning("⚠️ PowerBI API connection failed")
        except Exception as e:
            logger.warning(f"⚠️ PowerBI API test failed (non-critical): {e}")
        
    except Exception as e:
        logger.error(f"❌ Dependency test failed: {e}")
        # Don't fail startup for dependency issues


def create_app() -> FastAPI:
    """
    Create and configure FastAPI application
    
    Returns:
        Configured FastAPI application
    """
    
    # Create FastAPI app
    app = FastAPI(
        title="Microsoft Fabric Embedded API",
        description="""
        Backend API for Microsoft Fabric Embedded application with Entra ID authentication.
        
        This API provides:
        - 🔐 Entra ID authentication and authorization
        - 📊 PowerBI embed token generation with RLS
        - 👥 User and role management
        - 🛡️ Security audit logging
        - ⚙️ Administrative functions
        
        ## Authentication
        All endpoints (except health checks) require a valid Entra ID JWT token.
        Include the token in the Authorization header: `Bearer <token>`
        
        ## Row Level Security (RLS)
        Data access is controlled through PowerBI RLS based on user roles:
        - **Admin**: Full access to all data
        - **RolA**: Access to Role A specific data
        - **RolB**: Access to Role B specific data
        - **Public**: Limited public data access
        
        ## Rate Limiting
        API requests are rate limited to prevent abuse.
        Default limit: 60 requests per minute per user.
        """,
        version=settings.version,
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url="/redoc" if settings.enable_docs else None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
        lifespan=lifespan,
        # Custom OpenAPI tags
        openapi_tags=[
            {
                "name": "Authentication",
                "description": "User authentication and session management"
            },
            {
                "name": "PowerBI",
                "description": "PowerBI embed tokens and report access"
            },
            {
                "name": "Administration",
                "description": "Administrative functions (Admin only)"
            }
        ]
    )
    
    # Configure middleware (order matters!)
    _configure_middleware(app)
    
    # Configure routes
    _configure_routes(app)
    
    # Configure exception handlers
    _configure_exception_handlers(app)
    
    # Configure custom OpenAPI
    if settings.enable_docs:
        _configure_openapi(app)
    
    return app


def _configure_middleware(app: FastAPI) -> None:
    """Configure middleware stack"""
    
    # Security headers (first)
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Rate limiting
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_minute=settings.rate_limit_requests_per_minute
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"]
    )
    
    # Trusted host middleware
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.allowed_hosts
    )
    
    # Authentication middleware (last, so it runs first)
    app.add_middleware(AuthMiddleware)
    
    logger.info("✅ Middleware stack configured")


def _configure_routes(app: FastAPI) -> None:
    """Configure API routes"""
    
    # Include route modules
    app.include_router(auth_router, prefix="/api")
    app.include_router(powerbi_router, prefix="/api")
    app.include_router(admin_router, prefix="/api")
    
    # Root endpoints
    @app.get("/", tags=["Root"])
    async def root():
        """Root endpoint with API information"""
        return {
            "message": "Microsoft Fabric Embedded API",
            "version": settings.version,
            "environment": settings.environment,
            "docs": "/docs" if settings.enable_docs else "Documentation disabled",
            "health": "/health",
            "timestamp": "2025-01-10T10:00:00Z"  # Would use actual timestamp
        }
    
    @app.get("/health", tags=["Health"])
    async def health_check():
        """Application health check"""
        
        health_status = {
            "status": "healthy",
            "timestamp": "2025-01-10T10:00:00Z",  # Would use actual timestamp
            "version": settings.version,
            "environment": settings.environment,
            "components": {
                "api": "healthy",
                "authentication": "healthy",
                "powerbi": "unknown"  # Would test actual status
            }
        }
        
        # Test critical components
        try:
            # Test auth service
            from .auth.entra_auth import entra_auth_service
            if entra_auth_service.msal_app:
                health_status["components"]["authentication"] = "healthy"
            else:
                health_status["components"]["authentication"] = "degraded"
                health_status["status"] = "degraded"
        except Exception:
            health_status["components"]["authentication"] = "unhealthy"
            health_status["status"] = "unhealthy"
        
        return health_status
    
    logger.info("✅ Routes configured")


def _configure_exception_handlers(app: FastAPI) -> None:
    """Configure global exception handlers"""
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle validation errors"""
        
        logger.warning(f"Validation error on {request.url}: {exc.errors()}")
        
        return JSONResponse(
            status_code=422,
            content={
                "error": "ValidationError",
                "message": "Request validation failed",
                "details": exc.errors(),
                "timestamp": "2025-01-10T10:00:00Z"  # Would use actual timestamp
            }
        )
    
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Handle unexpected errors"""
        
        logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
        
        # Log security event for unexpected errors
        security_logger.log_security_violation(
            user_id=getattr(request.state, 'user', {}).get('email', 'unknown'),
            violation_type="unhandled_exception",
            details={
                "url": str(request.url),
                "method": request.method,
                "error": str(exc)
            },
            severity="MEDIUM"
        )
        
        # Don't expose internal error details in production
        if settings.environment == "production":
            error_detail = "Internal server error"
        else:
            error_detail = str(exc)
        
        return JSONResponse(
            status_code=500,
            content={
                "error": "InternalServerError",
                "message": error_detail,
                "timestamp": "2025-01-10T10:00:00Z"  # Would use actual timestamp
            }
        )
    
    logger.info("✅ Exception handlers configured")


def _configure_openapi(app: FastAPI) -> None:
    """Configure custom OpenAPI documentation"""
    
    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        
        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
            tags=app.openapi_tags
        )
        
        # Add custom security scheme
        openapi_schema["components"]["securitySchemes"] = {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
                "description": "Entra ID JWT token"
            }
        }
        
        # Add security requirement to all paths
        for path in openapi_schema["paths"].values():
            for operation in path.values():
                if isinstance(operation, dict) and "tags" in operation:
                    # Skip health and root endpoints
                    if not any(tag in ["Health", "Root"] for tag in operation["tags"]):
                        operation["security"] = [{"BearerAuth": []}]
        
        # Add custom info
        openapi_schema["info"]["contact"] = {
            "name": "Microsoft Fabric Embedded Team",
            "email": "support@yourcompany.com"
        }
        
        openapi_schema["info"]["license"] = {
            "name": "MIT",
            "url": "https://opensource.org/licenses/MIT"
        }
        
        openapi_schema["servers"] = [
            {
                "url": "/",
                "description": "Current server"
            }
        ]
        
        app.openapi_schema = openapi_schema
        return app.openapi_schema
    
    app.openapi = custom_openapi
    
    # Custom docs endpoint with authentication info
    @app.get("/docs", include_in_schema=False)
    async def custom_swagger_ui_html():
        return get_swagger_ui_html(
            openapi_url=app.openapi_url,
            title=app.title + " - Documentation",
            swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
            swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
            swagger_ui_parameters={
                "persistAuthorization": True,
                "displayRequestDuration": True,
                "filter": True,
                "showExtensions": True,
                "showCommonExtensions": True
            }
        )
    
    logger.info("✅ OpenAPI documentation configured")


# Create the application instance
app = create_app()

# Export for use in main.py
__all__ = ["app", "create_app"]