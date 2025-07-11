/**
 * Authentication Service for Microsoft Fabric Embedded Frontend
 * Handles Entra ID (Azure AD) authentication using MSAL
 */

import { LogLevel } from '@azure/msal-browser'

// Environment variables
const ENTRA_CLIENT_ID = import.meta.env.VITE_ENTRA_CLIENT_ID
const ENTRA_AUTHORITY = import.meta.env.VITE_ENTRA_AUTHORITY
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Validate required environment variables
if (!ENTRA_CLIENT_ID) {
  throw new Error('VITE_ENTRA_CLIENT_ID is required')
}

if (!ENTRA_AUTHORITY) {
  throw new Error('VITE_ENTRA_AUTHORITY is required')
}

// MSAL Configuration
export const msalConfig = {
  auth: {
    clientId: ENTRA_CLIENT_ID,
    authority: ENTRA_AUTHORITY,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: false
  },
  cache: {
    cacheLocation: 'sessionStorage', // Use sessionStorage for better security
    storeAuthStateInCookie: false, // Set to true for IE11 or older browsers
    secureCookies: window.location.protocol === 'https:'
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return
        
        switch (level) {
          case LogLevel.Error:
            console.error(`[MSAL Error] ${message}`)
            break
          case LogLevel.Warning:
            console.warn(`[MSAL Warning] ${message}`)
            break
          case LogLevel.Info:
            if (import.meta.env.DEV) {
              console.info(`[MSAL Info] ${message}`)
            }
            break
          case LogLevel.Verbose:
            if (import.meta.env.DEV) {
              console.debug(`[MSAL Verbose] ${message}`)
            }
            break
        }
      },
      logLevel: import.meta.env.DEV ? LogLevel.Verbose : LogLevel.Warning,
      piiLoggingEnabled: false
    },
    allowNativeBroker: false, // Disable WAM Broker for web apps
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0
  }
}

// Login request configuration
export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'Group.Read.All'
  ],
  prompt: 'select_account',
  extraScopesToConsent: [
    'https://analysis.windows.net/powerbi/api/Report.Read.All',
    'https://analysis.windows.net/powerbi/api/Dataset.Read.All'
  ]
}

// Silent token request configuration  
export const tokenRequest = {
  scopes: [
    'openid',
    'profile', 
    'email',
    'User.Read'
  ],
  forceRefresh: false
}

// PowerBI token request configuration
export const powerBITokenRequest = {
  scopes: [
    'https://analysis.windows.net/powerbi/api/.default'
  ],
  forceRefresh: false
}

// Graph API token request
export const graphTokenRequest = {
  scopes: [
    'https://graph.microsoft.com/.default'
  ],
  forceRefresh: false
}

/**
 * Authentication Service Class
 */
export class AuthService {
  constructor(msalInstance) {
    this.msalInstance = msalInstance
    this.account = null
    this.isInitialized = false
  }

  /**
   * Initialize the authentication service
   */
  async initialize() {
    try {
      await this.msalInstance.initialize()
      
      // Handle redirect promise
      const response = await this.msalInstance.handleRedirectPromise()
      if (response) {
        this.account = response.account
        console.log('Authentication redirect handled successfully')
      } else {
        // Get account from cache
        const accounts = this.msalInstance.getAllAccounts()
        if (accounts.length > 0) {
          this.account = accounts[0]
        }
      }
      
      this.isInitialized = true
      console.log('AuthService initialized successfully')
      
    } catch (error) {
      console.error('Failed to initialize AuthService:', error)
      throw error
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.account !== null && this.msalInstance.getAllAccounts().length > 0
  }

  /**
   * Get current user account
   */
  getAccount() {
    if (this.account) {
      return this.account
    }
    
    const accounts = this.msalInstance.getAllAccounts()
    if (accounts.length > 0) {
      this.account = accounts[0]
      return this.account
    }
    
    return null
  }

  /**
   * Login with popup
   */
  async loginPopup() {
    try {
      const response = await this.msalInstance.loginPopup(loginRequest)
      this.account = response.account
      
      console.log('Login successful:', response)
      return response
      
    } catch (error) {
      console.error('Login failed:', error)
      throw this.handleAuthError(error)
    }
  }

  /**
   * Login with redirect
   */
  async loginRedirect() {
    try {
      await this.msalInstance.loginRedirect(loginRequest)
      // Note: This will cause a page redirect, so no return value
      
    } catch (error) {
      console.error('Login redirect failed:', error)
      throw this.handleAuthError(error)
    }
  }

  /**
   * Logout
   */
  async logout() {
    try {
      const account = this.getAccount()
      
      if (account) {
        await this.msalInstance.logoutPopup({
          account: account,
          postLogoutRedirectUri: window.location.origin
        })
      } else {
        await this.msalInstance.logoutPopup()
      }
      
      this.account = null
      console.log('Logout successful')
      
    } catch (error) {
      console.error('Logout failed:', error)
      
      // Force logout by clearing cache
      this.msalInstance.clearCache()
      this.account = null
      window.location.reload()
    }
  }

  /**
   * Get access token silently
   */
  async getAccessToken(scopes = tokenRequest.scopes) {
    try {
      const account = this.getAccount()
      if (!account) {
        throw new Error('No account found')
      }

      const request = {
        ...tokenRequest,
        scopes: scopes,
        account: account
      }

      const response = await this.msalInstance.acquireTokenSilent(request)
      return response.accessToken
      
    } catch (error) {
      console.warn('Silent token acquisition failed:', error)
      
      // If silent request fails, try interactive request
      if (error.name === 'InteractionRequiredAuthError') {
        return await this.getAccessTokenInteractive(scopes)
      }
      
      throw this.handleAuthError(error)
    }
  }

  /**
   * Get access token with interaction
   */
  async getAccessTokenInteractive(scopes = tokenRequest.scopes) {
    try {
      const account = this.getAccount()
      
      const request = {
        scopes: scopes,
        account: account,
        prompt: 'none'
      }

      const response = await this.msalInstance.acquireTokenPopup(request)
      return response.accessToken
      
    } catch (error) {
      console.error('Interactive token acquisition failed:', error)
      throw this.handleAuthError(error)
    }
  }

  /**
   * Get PowerBI access token
   */
  async getPowerBIToken() {
    return await this.getAccessToken(powerBITokenRequest.scopes)
  }

  /**
   * Get Graph API access token
   */
  async getGraphToken() {
    return await this.getAccessToken(graphTokenRequest.scopes)
  }

  /**
   * Get user information
   */
  async getUserInfo() {
    try {
      const account = this.getAccount()
      if (!account) {
        throw new Error('No account found')
      }

      // Get additional user info from Graph API if needed
      const token = await this.getGraphToken()
      
      return {
        id: account.localAccountId,
        email: account.username,
        name: account.name,
        tenantId: account.tenantId,
        homeAccountId: account.homeAccountId,
        environment: account.environment,
        idTokenClaims: account.idTokenClaims
      }
      
    } catch (error) {
      console.error('Failed to get user info:', error)
      throw error
    }
  }

  /**
   * Validate token with backend
   */
  async validateTokenWithBackend() {
    try {
      const token = await this.getAccessToken()
      
      const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token })
      })

      if (!response.ok) {
        throw new Error(`Backend validation failed: ${response.statusText}`)
      }

      const data = await response.json()
      return data
      
    } catch (error) {
      console.error('Backend token validation failed:', error)
      throw error
    }
  }

  /**
   * Handle authentication errors
   */
  handleAuthError(error) {
    const errorMap = {
      'user_cancelled': 'User cancelled the authentication',
      'consent_required': 'Additional consent required',
      'interaction_required': 'User interaction required',
      'login_required': 'User must login again',
      'no_account_in_silent_request': 'No account found for silent request',
      'multiple_matching_tokens': 'Multiple matching tokens found',
      'multiple_matching_accounts': 'Multiple matching accounts found',
      'token_renewal_error': 'Token renewal failed',
      'invalid_grant': 'Invalid grant - user may need to login again',
      'server_error': 'Server error occurred',
      'temporarily_unavailable': 'Service temporarily unavailable'
    }

    const userFriendlyMessage = errorMap[error.errorCode] || error.message || 'Authentication error occurred'
    
    return {
      ...error,
      userFriendlyMessage,
      isAuthError: true
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    if (!token) return true
    
    try {
      // Decode JWT token (simple check)
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      
      return payload.exp < currentTime
      
    } catch (error) {
      console.warn('Failed to decode token:', error)
      return true
    }
  }

  /**
   * Add event callback
   */
  addEventCallback(callback) {
    return this.msalInstance.addEventCallback(callback)
  }

  /**
   * Remove event callback
   */
  removeEventCallback(callbackId) {
    return this.msalInstance.removeEventCallback(callbackId)
  }
}

// Export singleton instance (will be created in main.jsx)
export let authService = null

export const createAuthService = (msalInstance) => {
  authService = new AuthService(msalInstance)
  return authService
}

// Helper functions
export const getAuthHeaders = async () => {
  if (!authService) {
    throw new Error('AuthService not initialized')
  }
  
  const token = await authService.getAccessToken()
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export const getAuthToken = async () => {
  if (!authService) {
    throw new Error('AuthService not initialized')
  }
  
  return await authService.getAccessToken()
}

// Role and permission helpers
export const USER_ROLES = {
  ADMIN: 'Admin',
  ROLE_A: 'RolA', 
  ROLE_B: 'RolB',
  PUBLIC: 'Public'
}

export const PERMISSIONS = {
  VIEW_REPORTS: 'can_view_reports',
  ACCESS_ADMIN: 'can_access_admin',
  MANAGE_USERS: 'can_manage_users',
  VIEW_ROLE_A_DATA: 'can_view_role_a_data',
  VIEW_ROLE_B_DATA: 'can_view_role_b_data'
}