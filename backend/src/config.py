"""
Configuration management for Microsoft Fabric Embedded Backend
Handles environment variables, Azure Key Vault integration, and app settings
"""

import os
from typing import List, Optional, Union
from functools import lru_cache
from pydantic import BaseSettings, Field, validator
from azure.keyvault.secrets import SecretClient
from azure.identity import DefaultAzureCredential
import logging

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings with environment variable support and Azure Key Vault integration"""
    
    # ============================================================================
    # CORE APPLICATION SETTINGS
    # ============================================================================
    app_name: str = Field(default="Microsoft Fabric Embedded API", env="APP_NAME")
    version: str = Field(default="1.0.0", env="APP_VERSION")
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=False, env="DEBUG")
    
    # Server configuration
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    reload: bool = Field(default=False, env="RELOAD")
    
    # ============================================================================
    # ENTRA ID (AZURE AD) CONFIGURATION
    # ============================================================================
    entra_tenant_id: str = Field(..., env="ENTRA_TENANT_ID")
    entra_client_id: str = Field(..., env="ENTRA_CLIENT_ID")
    entra_client_secret: Optional[str] = Field(default=None, env="ENTRA_CLIENT_SECRET")
    entra_authority: Optional[str] = Field(default=None, env="ENTRA_AUTHORITY")
    
    @validator("entra_authority", always=True)
    def set_entra_authority(cls, v, values):
        if v is None and "entra_tenant_id" in values:
            return f"https://login.microsoftonline.com/{values['entra_tenant_id']}"
        return v
    
    # ============================================================================
    # MICROSOFT FABRIC & POWERBI CONFIGURATION
    # ============================================================================
    fabric_workspace_id: str = Field(..., env="FABRIC_WORKSPACE_ID")
    fabric_dataset_id: Optional[str] = Field(default=None, env="FABRIC_DATASET_ID")
    fabric_report_id: Optional[str] = Field(default=None, env="FABRIC_REPORT_ID")
    fabric_capacity_id: Optional[str] = Field(default=None, env="FABRIC_CAPACITY_ID")
    
    # PowerBI API Configuration
    powerbi_api_url: str = Field(
        default="https://api.powerbi.com/v1.0/myorg", 
        env="POWERBI_API_URL"
    )
    fabric_api_url: str = Field(
        default="https://api.fabric.microsoft.com/v1", 
        env="FABRIC_API_URL"
    )
    
    # Token configuration
    embed_token_expiration_minutes: int = Field(default=60, env="EMBED_TOKEN_EXPIRATION_MINUTES")
    token_refresh_threshold_minutes: int = Field(default=5, env="TOKEN_REFRESH_THRESHOLD_MINUTES")
    
    # ============================================================================
    # AZURE KEY VAULT CONFIGURATION
    # ============================================================================
    key_vault_url: Optional[str] = Field(default=None, env="KEY_VAULT_URL")
    key_vault_name: Optional[str] = Field(default=None, env="KEY_VAULT_NAME")
    managed_identity_client_id: Optional[str] = Field(default=None, env="MANAGED_IDENTITY_CLIENT_ID")
    
    @validator("key_vault_url", always=True)
    def set_key_vault_url(cls, v, values):
        if v is None and "key_vault_name" in values and values["key_vault_name"]:
            return f"https://{values['key_vault_name']}.vault.azure.net/"
        return v
    
    # ============================================================================
    # SECURITY CONFIGURATION
    # ============================================================================
    # JWT Configuration
    jwt_secret_key: str = Field(default="dev-secret-key-change-in-production", env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    jwt_expiration_hours: int = Field(default=24, env="JWT_EXPIRATION_HOURS")
    
    # CORS Configuration
    allowed_origins: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "https://app.fabric.microsoft.com",
            "https://app.powerbi.com"
        ],
        env="ALLOWED_ORIGINS"
    )
    
    allowed_hosts: List[str] = Field(
        default=["localhost", "127.0.0.1", "*.azurewebsites.net"],
        env="ALLOWED_HOSTS"
    )
    
    @validator("allowed_origins", pre=True)
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("allowed_hosts", pre=True) 
    def parse_hosts(cls, v):
        if isinstance(v, str):
            return [host.strip() for host in v.split(",")]
        return v
    
    # ============================================================================
    # DATABASE CONFIGURATION (OPTIONAL)
    # ============================================================================
    database_url: Optional[str] = Field(default=None, env="DATABASE_URL")
    db_pool_size: int = Field(default=5, env="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=10, env="DB_MAX_OVERFLOW")
    
    # ============================================================================
    # CACHING CONFIGURATION
    # ============================================================================
    redis_url: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    cache_default_ttl: int = Field(default=3600, env="CACHE_DEFAULT_TTL")  # 1 hour
    cache_token_ttl: int = Field(default=900, env="CACHE_TOKEN_TTL")        # 15 minutes
    
    # ============================================================================
    # LOGGING CONFIGURATION
    # ============================================================================
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(default="json", env="LOG_FORMAT")  # json or text
    
    # Application Insights
    applicationinsights_connection_string: Optional[str] = Field(
        default=None, 
        env="APPLICATIONINSIGHTS_CONNECTION_STRING"
    )
    
    # ============================================================================
    # RATE LIMITING
    # ============================================================================
    rate_limit_requests_per_minute: int = Field(default=60, env="RATE_LIMIT_REQUESTS_PER_MINUTE")
    rate_limit_burst: int = Field(default=10, env="RATE_LIMIT_BURST")
    
    # ============================================================================
    # POWERBI ROLE MAPPING
    # ============================================================================
    entra_group_mappings: dict = Field(
        default={
            "PBI-Admin": ["Admin"],
            "PBI-RolA": ["RolA"],
            "PBI-RolB": ["RolB"]
        },
        env="ENTRA_GROUP_MAPPINGS"
    )
    
    # ============================================================================
    # MONITORING & HEALTH CHECKS
    # ============================================================================
    health_check_timeout: int = Field(default=30, env="HEALTH_CHECK_TIMEOUT")
    metrics_enabled: bool = Field(default=True, env="METRICS_ENABLED")
    
    # ============================================================================
    # DEVELOPMENT SETTINGS
    # ============================================================================
    auto_reload: bool = Field(default=False, env="AUTO_RELOAD")
    enable_docs: bool = Field(default=True, env="ENABLE_DOCS")
    
    @validator("enable_docs", always=True)
    def disable_docs_in_production(cls, v, values):
        if values.get("environment") == "production":
            return False
        return v
    
    # ============================================================================
    # PYDANTIC CONFIGURATION
    # ============================================================================
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        validate_assignment = True
        extra = "ignore"  # Ignore extra environment variables


class KeyVaultSettings:
    """Azure Key Vault integration for secure secret management"""
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self._client: Optional[SecretClient] = None
        self._secrets_cache: dict = {}
        
    @property
    def client(self) -> Optional[SecretClient]:
        """Get Key Vault client with proper authentication"""
        if self._client is None and self.settings.key_vault_url:
            try:
                # Use Managed Identity in Azure, fallback to DefaultAzureCredential
                credential = DefaultAzureCredential(
                    managed_identity_client_id=self.settings.managed_identity_client_id
                )
                self._client = SecretClient(
                    vault_url=self.settings.key_vault_url,
                    credential=credential
                )
                logger.info("Key Vault client initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize Key Vault client: {e}")
                self._client = None
        return self._client
    
    def get_secret(self, secret_name: str, default_value: Optional[str] = None) -> Optional[str]:
        """
        Retrieve secret from Key Vault with caching
        
        Args:
            secret_name: Name of the secret in Key Vault
            default_value: Default value if secret not found
            
        Returns:
            Secret value or default_value
        """
        # Check cache first
        if secret_name in self._secrets_cache:
            return self._secrets_cache[secret_name]
        
        # Try to get from Key Vault
        if self.client:
            try:
                secret = self.client.get_secret(secret_name)
                self._secrets_cache[secret_name] = secret.value
                logger.debug(f"Retrieved secret '{secret_name}' from Key Vault")
                return secret.value
            except Exception as e:
                logger.warning(f"Failed to retrieve secret '{secret_name}' from Key Vault: {e}")
        
        # Fallback to default value
        if default_value is not None:
            logger.debug(f"Using default value for secret '{secret_name}'")
            return default_value
        
        logger.error(f"Secret '{secret_name}' not found and no default provided")
        return None
    
    def update_settings_with_secrets(self, settings: Settings) -> Settings:
        """Update settings with secrets from Key Vault"""
        if not self.client:
            logger.warning("Key Vault client not available, using environment variables only")
            return settings
        
        # Map of setting attributes to Key Vault secret names
        secret_mappings = {
            "entra_client_secret": "entra-client-secret",
            "jwt_secret_key": "jwt-signing-key",
            "database_url": "database-connection-string",
        }
        
        for setting_attr, secret_name in secret_mappings.items():
            current_value = getattr(settings, setting_attr, None)
            
            # Only fetch from Key Vault if not already set via environment
            if not current_value or current_value.startswith("your-") or current_value == "dev-secret-key-change-in-production":
                secret_value = self.get_secret(secret_name)
                if secret_value:
                    setattr(settings, setting_attr, secret_value)
                    logger.debug(f"Updated {setting_attr} from Key Vault")
        
        return settings


class DevelopmentSettings(Settings):
    """Development-specific settings with overrides"""
    
    debug: bool = True
    log_level: str = "DEBUG"
    reload: bool = True
    auto_reload: bool = True
    enable_docs: bool = True
    
    # Less strict rate limiting for development
    rate_limit_requests_per_minute: int = 1000
    
    # Shorter token expiration for testing
    embed_token_expiration_minutes: int = 30
    
    # Allow all localhost origins
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "https://app.fabric.microsoft.com",
        "https://app.powerbi.com"
    ]


class ProductionSettings(Settings):
    """Production-specific settings with security hardening"""
    
    debug: bool = False
    log_level: str = "WARNING"
    reload: bool = False
    auto_reload: bool = False
    enable_docs: bool = False
    
    # Stricter rate limiting
    rate_limit_requests_per_minute: int = 30
    rate_limit_burst: int = 5
    
    # Longer token expiration in production
    embed_token_expiration_minutes: int = 60
    
    # Production JWT settings
    jwt_expiration_hours: int = 8  # Shorter session in production


class TestSettings(Settings):
    """Test-specific settings"""
    
    debug: bool = True
    log_level: str = "DEBUG"
    environment: str = "test"
    
    # Use in-memory cache for tests
    redis_url: str = "redis://localhost:6379/1"  # Different DB for tests
    
    # Mock Key Vault in tests
    key_vault_url: Optional[str] = None
    
    # Test-specific token settings
    embed_token_expiration_minutes: int = 5  # Short expiration for tests
    jwt_expiration_hours: int = 1


@lru_cache()
def get_settings() -> Settings:
    """
    Get application settings with caching
    
    Returns:
        Settings instance based on environment
    """
    environment = os.getenv("ENVIRONMENT", "development").lower()
    
    # Choose settings class based on environment
    if environment == "production":
        settings = ProductionSettings()
    elif environment == "test":
        settings = TestSettings()
    else:
        settings = DevelopmentSettings()
    
    # Initialize Key Vault and update settings with secrets
    if settings.key_vault_url:
        kv_settings = KeyVaultSettings(settings)
        settings = kv_settings.update_settings_with_secrets(settings)
    
    # Validate required settings
    _validate_required_settings(settings)
    
    logger.info(f"Settings loaded for environment: {settings.environment}")
    return settings


def _validate_required_settings(settings: Settings) -> None:
    """Validate that all required settings are present"""
    required_fields = [
        "entra_tenant_id",
        "entra_client_id", 
        "fabric_workspace_id"
    ]
    
    missing_fields = []
    for field in required_fields:
        value = getattr(settings, field, None)
        if not value or (isinstance(value, str) and value.startswith("your-")):
            missing_fields.append(field)
    
    if missing_fields:
        raise ValueError(
            f"Missing required configuration fields: {missing_fields}. "
            "Please check your environment variables or Key Vault secrets."
        )
    
    # Validate Entra ID configuration
    if not settings.entra_client_secret and settings.environment != "test":
        logger.warning(
            "Entra ID client secret not configured. "
            "This may cause authentication failures in non-test environments."
        )


def get_keyvault_settings() -> KeyVaultSettings:
    """Get Key Vault settings instance"""
    settings = get_settings()
    return KeyVaultSettings(settings)


# Environment-specific configurations
def is_development() -> bool:
    """Check if running in development mode"""
    return get_settings().environment.lower() == "development"


def is_production() -> bool:
    """Check if running in production mode"""
    return get_settings().environment.lower() == "production"


def is_testing() -> bool:
    """Check if running in test mode"""
    return get_settings().environment.lower() == "test"