"""
main.py - Punto de entrada principal para la aplicación FastAPI
Microsoft Fabric Embedded Backend
"""

from fastapi import FastAPI, Middleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
import logging
import os
from datetime import datetime

# Imports locales
from src.config import get_settings
from src.auth.middleware import AuthMiddleware
from src.routes import auth_routes, powerbi_routes, admin_routes
from src.utils.logger import setup_logging

# Configurar logging
setup_logging()
logger = logging.getLogger(__name__)

# Configuración de la aplicación
settings = get_settings()

# Lifecycle events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manejo del ciclo de vida de la aplicación"""
    # Startup
    logger.info("🚀 Starting Microsoft Fabric Embedded Backend")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug mode: {settings.debug}")
    
    # Validar configuración crítica
    try:
        # Verificar variables de entorno críticas
        required_vars = [
            "ENTRA_TENANT_ID",
            "ENTRA_CLIENT_ID", 
            "KEY_VAULT_URL"
        ]
        
        missing_vars = [var for var in required_vars if not getattr(settings, var.lower(), None)]
        if missing_vars:
            logger.error(f"Missing required environment variables: {missing_vars}")
            raise ValueError(f"Missing required environment variables: {missing_vars}")
        
        logger.info("✅ Configuration validation passed")
        
    except Exception as e:
        logger.error(f"❌ Startup validation failed: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Microsoft Fabric Embedded Backend")

# Crear instancia de FastAPI
app = FastAPI(
    title="Microsoft Fabric Embedded API",
    description="Backend API for Microsoft Fabric Embedded application with Entra ID authentication",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Middleware de seguridad
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.allowed_hosts
)

# Middleware de autenticación personalizado
app.add_middleware(AuthMiddleware)

# Incluir routers
app.include_router(
    auth_routes.router,
    prefix="/api/auth",
    tags=["Authentication"]
)

app.include_router(
    powerbi_routes.router,
    prefix="/api/powerbi",
    tags=["PowerBI"]
)

app.include_router(
    admin_routes.router,
    prefix="/api/admin",
    tags=["Administration"]
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "environment": settings.environment
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Microsoft Fabric Embedded API",
        "version": "1.0.0",
        "docs": "/docs" if settings.debug else "Documentation disabled in production",
        "health": "/health"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# Startup message
@app.on_event("startup")
async def startup_message():
    """Log startup message"""
    logger.info("🌟 Microsoft Fabric Embedded Backend is ready!")
    logger.info(f"📍 Running on: {settings.host}:{settings.port}")
    logger.info(f"🔧 Environment: {settings.environment}")

if __name__ == "__main__":
    # Para desarrollo local
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info" if settings.debug else "warning"
    )