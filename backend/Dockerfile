# Microsoft Fabric Embedded Backend - Multi-stage Dockerfile
# Optimized for production deployment on Azure App Service

# ============================================================================
# Base Python Image
# ============================================================================
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=100

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# ============================================================================
# Dependencies Stage
# ============================================================================
FROM base as dependencies

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# ============================================================================
# Development Stage
# ============================================================================
FROM dependencies as development

# Install development dependencies
RUN pip install \
    pytest \
    pytest-asyncio \
    pytest-cov \
    black \
    isort \
    flake8 \
    mypy \
    pre-commit

# Copy source code
COPY . .

# Change ownership to app user
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Development command with hot reload
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--log-level", "debug"]

# ============================================================================
# Testing Stage
# ============================================================================
FROM development as testing

# Run tests
RUN python -m pytest tests/ -v --cov=src --cov-report=html --cov-report=term

# ============================================================================
# Production Build Stage
# ============================================================================
FROM dependencies as production-build

# Copy source code
COPY . .

# Remove development files
RUN rm -rf tests/ docs/ *.md .git* .pytest_cache/ __pycache__/ \
    && find . -type f -name "*.pyc" -delete \
    && find . -type d -name "__pycache__" -delete

# ============================================================================
# Production Stage
# ============================================================================
FROM base as production

# Install production dependencies only
COPY requirements.txt .
RUN pip install --no-deps -r requirements.txt && \
    pip install gunicorn && \
    rm requirements.txt

# Copy application code from build stage
COPY --from=production-build /app /app

# Create necessary directories
RUN mkdir -p /app/logs /app/tmp && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production command with Gunicorn
CMD ["gunicorn", "main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keep-alive", "2", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100", \
     "--preload", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]

# ============================================================================
# Azure App Service Stage (specific optimizations for Azure)
# ============================================================================
FROM production as azure

# Azure App Service specific configurations
ENV PORT=8000 \
    WEBSITES_PORT=8000 \
    WEBSITES_CONTAINER_START_TIME_LIMIT=1800

# Azure App Service expects app to run on port specified by PORT env var
CMD ["sh", "-c", "gunicorn main:app --worker-class uvicorn.workers.UvicornWorker --workers 2 --bind 0.0.0.0:${PORT:-8000} --timeout 120 --keep-alive 2 --access-logfile - --error-logfile - --log-level info"]

# ============================================================================
# Build Arguments & Labels
# ============================================================================
ARG BUILD_DATE
ARG BUILD_VERSION
ARG VCS_REF

LABEL maintainer="your-team@company.com" \
      org.label-schema.build-date=$BUILD_DATE \
      org.label-schema.name="Microsoft Fabric Embedded Backend" \
      org.label-schema.description="FastAPI backend for Microsoft Fabric embedded application" \
      org.label-schema.version=$BUILD_VERSION \
      org.label-schema.vcs-ref=$VCS_REF \
      org.label-schema.vcs-url="https://github.com/your-org/fabric-embedded-app" \
      org.label-schema.schema-version="1.0"

# ============================================================================
# Docker Compose Override for Local Development
# ============================================================================
# Usage examples:
#
# Development:
# docker build --target development -t fabric-backend:dev .
# docker run -p 8000:8000 fabric-backend:dev
#
# Production:
# docker build --target production -t fabric-backend:prod .
# docker run -p 8000:8000 fabric-backend:prod
#
# Azure deployment:
# docker build --target azure -t fabric-backend:azure .
#
# Testing:
# docker build --target testing -t fabric-backend:test .
# docker run fabric-backend:test
#
# ============================================================================