"""
Logging configuration for Microsoft Fabric Embedded Backend
Provides structured logging with Azure Application Insights integration
"""

import logging
import logging.config
import sys
import json
from typing import Dict, Any, Optional
from datetime import datetime
import structlog
from pythonjsonlogger import jsonlogger

from ..config import get_settings

# Get settings
settings = get_settings()


class CustomJSONFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter for structured logging"""
    
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        super().add_fields(log_record, record, message_dict)
        
        # Add custom fields
        log_record['timestamp'] = datetime.utcnow().isoformat() + 'Z'
        log_record['level'] = record.levelname
        log_record['logger_name'] = record.name
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        
        # Add application context
        log_record['app_name'] = settings.app_name
        log_record['app_version'] = settings.version
        log_record['environment'] = settings.environment
        
        # Add process information
        log_record['process_id'] = record.process
        log_record['thread_id'] = record.thread


class SecurityEventFilter(logging.Filter):
    """Filter for security-related events"""
    
    SECURITY_EVENTS = {
        'USER_LOGIN',
        'USER_LOGIN_FAILED', 
        'TOKEN_GENERATED',
        'UNAUTHORIZED_ACCESS',
        'ADMIN_ACTION',
        'DATA_ACCESS',
        'PERMISSION_CHANGE',
        'SECURITY_VIOLATION'
    }
    
    def filter(self, record: logging.LogRecord) -> bool:
        """Filter security events for special handling"""
        return hasattr(record, 'event_type') and record.event_type in self.SECURITY_EVENTS


def setup_structlog() -> None:
    """Configure structlog for structured logging"""
    
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]
    
    if settings.log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())
    
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def get_logging_config() -> Dict[str, Any]:
    """Get logging configuration dictionary"""
    
    config = {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'json': {
                '()': CustomJSONFormatter,
                'format': '%(timestamp)s %(level)s %(logger_name)s %(message)s'
            },
            'standard': {
                'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
            },
            'detailed': {
                'format': '%(asctime)s [%(levelname)s] %(name)s.%(funcName)s:%(lineno)d: %(message)s'
            }
        },
        'filters': {
            'security_filter': {
                '()': SecurityEventFilter,
            }
        },
        'handlers': {
            'console': {
                'class': 'logging.StreamHandler',
                'level': 'DEBUG',
                'formatter': 'json' if settings.log_format == 'json' else 'standard',
                'stream': sys.stdout
            },
            'security': {
                'class': 'logging.StreamHandler', 
                'level': 'INFO',
                'formatter': 'json',
                'stream': sys.stdout,
                'filters': ['security_filter']
            },
            'file': {
                'class': 'logging.handlers.RotatingFileHandler',
                'level': 'INFO',
                'formatter': 'json',
                'filename': '/app/logs/app.log',
                'maxBytes': 10485760,  # 10MB
                'backupCount': 5
            }
        },
        'loggers': {
            '': {  # Root logger
                'handlers': ['console'],
                'level': settings.log_level,
                'propagate': False
            },
            'security': {
                'handlers': ['security', 'file'],
                'level': 'INFO',
                'propagate': False
            },
            'uvicorn': {
                'handlers': ['console'],
                'level': 'INFO',
                'propagate': False
            },
            'uvicorn.access': {
                'handlers': ['console'],
                'level': 'INFO',
                'propagate': False
            },
            'azure': {
                'handlers': ['console'],
                'level': 'WARNING',
                'propagate': False
            },
            'msal': {
                'handlers': ['console'],
                'level': 'WARNING',
                'propagate': False
            }
        }
    }
    
    # Add Application Insights handler if configured
    if settings.applicationinsights_connection_string:
        try:
            from opencensus.ext.azure.log_exporter import AzureLogHandler
            
            config['handlers']['azure_insights'] = {
                'class': 'opencensus.ext.azure.log_exporter.AzureLogHandler',
                'level': 'INFO',
                'formatter': 'json',
                'connection_string': settings.applicationinsights_connection_string
            }
            
            # Add Azure handler to root logger
            config['loggers']['']['handlers'].append('azure_insights')
            config['loggers']['security']['handlers'].append('azure_insights')
            
        except ImportError:
            logging.warning("Azure Application Insights logging not available - install opencensus-ext-azure")
    
    return config


def setup_logging() -> None:
    """Initialize logging configuration"""
    
    # Ensure log directory exists
    import os
    os.makedirs('/app/logs', exist_ok=True)
    
    # Apply logging configuration
    config = get_logging_config()
    logging.config.dictConfig(config)
    
    # Setup structlog
    setup_structlog()
    
    # Get logger for this module
    logger = logging.getLogger(__name__)
    logger.info("Logging configuration initialized", extra={
        'log_level': settings.log_level,
        'log_format': settings.log_format,
        'environment': settings.environment
    })


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance with the given name"""
    return logging.getLogger(name)


def get_security_logger() -> logging.Logger:
    """Get the security events logger"""
    return logging.getLogger('security')


class SecurityLogger:
    """Helper class for logging security events"""
    
    def __init__(self):
        self.logger = get_security_logger()
    
    def log_user_login(self, user_id: str, success: bool, user_groups: Optional[list] = None, 
                      source_ip: Optional[str] = None, user_agent: Optional[str] = None) -> None:
        """Log user login attempt"""
        event_type = "USER_LOGIN" if success else "USER_LOGIN_FAILED"
        
        self.logger.info(
            f"User login {'successful' if success else 'failed'}",
            extra={
                'event_type': event_type,
                'user_id': user_id,
                'user_groups': user_groups or [],
                'source_ip': source_ip,
                'user_agent': user_agent,
                'success': success
            }
        )
    
    def log_token_generated(self, user_id: str, report_id: str, roles_applied: list,
                           token_expiration: Optional[datetime] = None) -> None:
        """Log PowerBI embed token generation"""
        self.logger.info(
            "PowerBI embed token generated",
            extra={
                'event_type': 'TOKEN_GENERATED',
                'user_id': user_id,
                'report_id': report_id,
                'roles_applied': roles_applied,
                'token_expiration': token_expiration.isoformat() if token_expiration else None
            }
        )
    
    def log_unauthorized_access(self, user_id: str, resource: str, required_roles: list,
                               user_roles: list, source_ip: Optional[str] = None) -> None:
        """Log unauthorized access attempt"""
        self.logger.warning(
            "Unauthorized access attempt",
            extra={
                'event_type': 'UNAUTHORIZED_ACCESS',
                'user_id': user_id,
                'resource': resource,
                'required_roles': required_roles,
                'user_roles': user_roles,
                'source_ip': source_ip
            }
        )
    
    def log_admin_action(self, admin_user_id: str, action: str, target_user: Optional[str] = None,
                        details: Optional[Dict[str, Any]] = None) -> None:
        """Log administrative action"""
        self.logger.info(
            f"Administrative action: {action}",
            extra={
                'event_type': 'ADMIN_ACTION',
                'admin_user_id': admin_user_id,
                'action': action,
                'target_user': target_user,
                'details': details or {}
            }
        )
    
    def log_data_access(self, user_id: str, dataset_id: str, data_filters: Dict[str, Any],
                       access_level: str) -> None:
        """Log sensitive data access"""
        self.logger.info(
            "Sensitive data accessed",
            extra={
                'event_type': 'DATA_ACCESS',
                'user_id': user_id,
                'dataset_id': dataset_id,
                'data_filters': data_filters,
                'access_level': access_level
            }
        )
    
    def log_permission_change(self, admin_user_id: str, target_user_id: str, 
                             old_permissions: list, new_permissions: list) -> None:
        """Log permission changes"""
        self.logger.info(
            "User permissions modified",
            extra={
                'event_type': 'PERMISSION_CHANGE',
                'admin_user_id': admin_user_id,
                'target_user_id': target_user_id,
                'old_permissions': old_permissions,
                'new_permissions': new_permissions
            }
        )
    
    def log_security_violation(self, user_id: str, violation_type: str, details: Dict[str, Any],
                              severity: str = "HIGH") -> None:
        """Log security violation"""
        log_method = self.logger.critical if severity == "CRITICAL" else self.logger.error
        
        log_method(
            f"Security violation: {violation_type}",
            extra={
                'event_type': 'SECURITY_VIOLATION',
                'user_id': user_id,
                'violation_type': violation_type,
                'severity': severity,
                'details': details
            }
        )


# Global security logger instance
security_logger = SecurityLogger()


def get_request_logger(request_id: str) -> structlog.BoundLogger:
    """Get a logger bound to a specific request ID"""
    logger = structlog.get_logger()
    return logger.bind(request_id=request_id)


class LoggingMiddleware:
    """FastAPI middleware for request/response logging"""
    
    def __init__(self, app):
        self.app = app
        self.logger = get_logger(__name__)
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Generate request ID
            import uuid
            request_id = str(uuid.uuid4())
            
            # Add request ID to scope
            scope["request_id"] = request_id
            
            # Log request
            self.logger.info(
                "HTTP request started",
                extra={
                    'request_id': request_id,
                    'method': scope['method'],
                    'path': scope['path'],
                    'query_string': scope.get('query_string', b'').decode(),
                    'client_ip': scope.get('client', ['unknown', None])[0] if scope.get('client') else 'unknown'
                }
            )
        
        await self.app(scope, receive, send)


# Export commonly used functions
__all__ = [
    'setup_logging',
    'get_logger',
    'get_security_logger',
    'SecurityLogger',
    'security_logger',
    'get_request_logger',
    'LoggingMiddleware'
]