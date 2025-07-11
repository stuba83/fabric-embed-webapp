/**
 * Constants for Microsoft Fabric Embedded Frontend Application
 */

// Application Configuration
export const APP_CONFIG = {
  name: 'Microsoft Fabric Embedded App',
  version: '1.0.0',
  description: 'Aplicación web para embedar contenido de PowerBI con Microsoft Fabric',
  defaultLocale: 'es-ES',
  defaultTheme: 'light'
}

// API Configuration
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
}

// Entra ID (Azure AD) Configuration
export const ENTRA_CONFIG = {
  clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
  authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
  redirectUri: import.meta.env.VITE_ENTRA_REDIRECT_URI || window.location.origin,
  postLogoutRedirectUri: import.meta.env.VITE_ENTRA_POST_LOGOUT_URI || window.location.origin,
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'GroupMember.Read.All'
  ],
  cacheLocation: 'sessionStorage',
  storeAuthStateInCookie: false
}

// PowerBI Configuration
export const POWERBI_CONFIG = {
  workspaceId: import.meta.env.VITE_POWERBI_WORKSPACE_ID,
  embedBaseUrl: 'https://app.powerbi.com',
  fabricBaseUrl: 'https://app.fabric.microsoft.com',
  tokenRefreshBuffer: 5 * 60 * 1000, // 5 minutes in milliseconds
  defaultHeight: '600px',
  defaultSettings: {
    filterPaneEnabled: false,
    navContentPaneEnabled: true,
    background: 'transparent',
    localeSettings: {
      language: 'es-ES',
      formatLocale: 'es-ES'
    }
  }
}

// User Roles and Permissions
export const USER_ROLES = {
  ADMIN: 'Admin',
  ROL_A: 'RolA',
  ROL_B: 'RolB'
}

export const PERMISSIONS = {
  VIEW_ALL_REPORTS: 'view_all_reports',
  VIEW_ROLA_REPORTS: 'view_rola_reports',
  VIEW_ROLB_REPORTS: 'view_rolb_reports',
  EXPORT_REPORTS: 'export_reports',
  MANAGE_USERS: 'manage_users',
  MANAGE_SYSTEM: 'manage_system',
  VIEW_ANALYTICS: 'view_analytics',
  CONFIGURE_REPORTS: 'configure_reports',
  ACCESS_ADMIN_PANEL: 'access_admin_panel'
}

// Route Configuration
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  REPORTS: '/reports',
  ADMIN: '/admin',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  NOT_FOUND: '/404',
  UNAUTHORIZED: '/unauthorized'
}

// Theme Configuration
export const THEME_CONFIG = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a'
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827'
    }
  },
  breakpoints: {
    xs: '475px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
}

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Error de conexión. Verifica tu conexión a internet.',
  AUTH_FAILED: 'Error de autenticación. Por favor, inicia sesión nuevamente.',
  UNAUTHORIZED: 'No tienes permisos para acceder a este recurso.',
  NOT_FOUND: 'El recurso solicitado no fue encontrado.',
  VALIDATION_ERROR: 'Error de validación. Verifica los datos ingresados.',
  SERVER_ERROR: 'Error interno del servidor. Intenta nuevamente más tarde.',
  TOKEN_EXPIRED: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
  POWERBI_EMBED_ERROR: 'Error al cargar el reporte de PowerBI.',
  FABRIC_CONNECTION_ERROR: 'Error de conexión con Microsoft Fabric.',
  REPORT_NOT_FOUND: 'El reporte solicitado no fue encontrado.',
  INSUFFICIENT_PERMISSIONS: 'No tienes permisos suficientes para realizar esta acción.'
}

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  LOGOUT_SUCCESS: 'Sesión cerrada correctamente',
  DATA_SAVED: 'Datos guardados correctamente',
  REPORT_EXPORTED: 'Reporte exportado exitosamente',
  SETTINGS_UPDATED: 'Configuración actualizada',
  PASSWORD_CHANGED: 'Contraseña cambiada exitosamente',
  EMAIL_SENT: 'Correo electrónico enviado',
  REPORT_REFRESHED: 'Reporte actualizado correctamente'
}

// Loading Messages
export const LOADING_MESSAGES = {
  AUTHENTICATING: 'Autenticando usuario...',
  LOADING_REPORTS: 'Cargando reportes disponibles...',
  LOADING_DATA: 'Cargando datos...',
  SAVING: 'Guardando...',
  PROCESSING: 'Procesando...',
  EXPORTING: 'Exportando reporte...',
  REFRESHING: 'Actualizando datos...',
  CONNECTING_FABRIC: 'Conectando con Microsoft Fabric...'
}

// Local Storage Keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'fabric_app_user_preferences',
  THEME: 'fabric_app_theme',
  LANGUAGE: 'fabric_app_language',
  LAYOUT_PREFERENCES: 'fabric_app_layout',
  REPORT_SETTINGS: 'fabric_app_report_settings',
  LAST_VISITED: 'fabric_app_last_visited'
}

// Query Keys for React Query
export const QUERY_KEYS = {
  USER_PROFILE: 'user_profile',
  USER_ROLES: 'user_roles',
  POWERBI_REPORTS: 'powerbi_reports',
  POWERBI_WORKSPACE: 'powerbi_workspace',
  EMBED_TOKEN: 'embed_token',
  SYSTEM_HEALTH: 'system_health',
  ADMIN_USERS: 'admin_users'
}

// Event Names for Analytics
export const ANALYTICS_EVENTS = {
  LOGIN: 'user_login',
  LOGOUT: 'user_logout',
  REPORT_VIEW: 'report_view',
  REPORT_EXPORT: 'report_export',
  ERROR_OCCURRED: 'error_occurred',
  PAGE_VIEW: 'page_view',
  FEATURE_USED: 'feature_used'
}

// Date/Time Formats
export const DATE_FORMATS = {
  SHORT: 'dd/MM/yyyy',
  LONG: 'dd/MM/yyyy HH:mm',
  TIME: 'HH:mm',
  ISO: 'yyyy-MM-dd',
  DISPLAY: 'dd de MMMM, yyyy',
  TIMESTAMP: 'dd/MM/yyyy HH:mm:ss'
}

// File Export Configuration
export const EXPORT_CONFIG = {
  formats: ['pdf', 'excel', 'powerpoint', 'image'],
  maxFileSize: 50 * 1024 * 1024, // 50MB
  timeout: 60000, // 60 seconds
  defaultFilename: 'fabric_report'
}

// Validation Rules
export const VALIDATION_RULES = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: 'Ingresa un email válido'
  },
  password: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo'
  },
  required: {
    message: 'Este campo es requerido'
  }
}

// Feature Flags
export const FEATURES = {
  ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
  ENABLE_DEBUG: import.meta.env.VITE_ENABLE_DEBUG === 'true',
  ENABLE_EXPORT: import.meta.env.VITE_ENABLE_EXPORT !== 'false',
  ENABLE_FULLSCREEN: import.meta.env.VITE_ENABLE_FULLSCREEN !== 'false',
  ENABLE_AUTO_REFRESH: import.meta.env.VITE_ENABLE_AUTO_REFRESH === 'true',
  ENABLE_DARK_MODE: import.meta.env.VITE_ENABLE_DARK_MODE === 'true'
}

// Environment Configuration
export const ENV_CONFIG = {
  isDevelopment: import.meta.env.MODE === 'development',
  isProduction: import.meta.env.MODE === 'production',
  isTest: import.meta.env.MODE === 'test',
  apiUrl: import.meta.env.VITE_API_BASE_URL,
  appUrl: import.meta.env.VITE_APP_URL || window.location.origin
}

// Default Component Props
export const DEFAULT_PROPS = {
  powerbiEmbed: {
    height: '600px',
    showToolbar: true,
    allowExport: true,
    allowFullscreen: true,
    autoRefresh: false,
    refreshInterval: 300000 // 5 minutes
  },
  loadingSpinner: {
    size: 'md',
    variant: 'default',
    color: 'blue'
  },
  errorBoundary: {
    showDetails: false,
    showRetry: true,
    showReload: true,
    showHome: true,
    variant: 'default'
  }
}

export default {
  APP_CONFIG,
  API_CONFIG,
  ENTRA_CONFIG,
  POWERBI_CONFIG,
  USER_ROLES,
  PERMISSIONS,
  ROUTES,
  THEME_CONFIG,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOADING_MESSAGES,
  STORAGE_KEYS,
  QUERY_KEYS,
  ANALYTICS_EVENTS,
  DATE_FORMATS,
  EXPORT_CONFIG,
  VALIDATION_RULES,
  FEATURES,
  ENV_CONFIG,
  DEFAULT_PROPS
}