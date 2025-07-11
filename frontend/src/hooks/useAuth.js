import { useState, useEffect, useCallback } from 'react'
import { useIsAuthenticated, useMsal, useAccount } from '@azure/msal-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { authService, getAuthToken } from '@/services/authService'
import { apiClient } from '@/services/apiClient'

/**
 * Authentication Hook
 * Manages user authentication state and provides auth-related functionality
 */
export const useAuth = () => {
  const isAuthenticated = useIsAuthenticated()
  const { instance: msalInstance, accounts } = useMsal()
  const account = useAccount(accounts[0] || null)
  const queryClient = useQueryClient()
  
  const [isInitialized, setIsInitialized] = useState(false)

  // Query for user information from backend
  const {
    data: user,
    isLoading,
    error,
    refetch: refetchUser
  } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      if (!isAuthenticated) {
        throw new Error('Not authenticated')
      }

      try {
        // Get token and validate with backend
        const token = await getAuthToken()
        const response = await apiClient.post('/auth/validate', { token })
        
        return response.data.user
      } catch (error) {
        console.error('Failed to get user info:', error)
        throw error
      }
    },
    enabled: isAuthenticated && isInitialized,
    retry: (failureCount, error) => {
      // Don't retry auth errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  })

  // Initialize auth service
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authService && !authService.isInitialized) {
          await authService.initialize()
        }
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize auth:', error)
        setIsInitialized(true) // Still set to true to prevent infinite loading
      }
    }

    initAuth()
  }, [])

  // Login function
  const login = useCallback(async (method = 'popup') => {
    try {
      if (method === 'popup') {
        await msalInstance.loginPopup()
      } else {
        await msalInstance.loginRedirect()
      }
      
      // Invalidate user query to refetch after login
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    }
  }, [msalInstance, queryClient])

  // Logout function
  const logout = useCallback(async () => {
    try {
      // Clear all cached data
      queryClient.clear()
      
      // Logout from MSAL
      const logoutAccount = account || accounts[0]
      if (logoutAccount) {
        await msalInstance.logoutPopup({
          account: logoutAccount,
          postLogoutRedirectUri: window.location.origin
        })
      } else {
        await msalInstance.logoutPopup()
      }
      
    } catch (error) {
      console.error('Logout failed:', error)
      
      // Force logout by clearing cache and reloading
      queryClient.clear()
      window.location.href = '/login'
    }
  }, [msalInstance, account, accounts, queryClient])

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      await refetchUser()
    } catch (error) {
      console.error('Failed to refresh user:', error)
      throw error
    }
  }, [refetchUser])

  // Get access token
  const getToken = useCallback(async (scopes) => {
    try {
      return await getAuthToken(scopes)
    } catch (error) {
      console.error('Failed to get token:', error)
      throw error
    }
  }, [])

  return {
    // Authentication state
    isAuthenticated,
    isLoading: !isInitialized || isLoading,
    isInitialized,
    
    // User data
    user,
    account,
    error,
    
    // Functions
    login,
    logout,
    refreshUser,
    getToken,
    
    // Utilities
    hasRole: useCallback((role) => {
      return user?.roles?.includes(role) || false
    }, [user]),
    
    hasAnyRole: useCallback((roles) => {
      return roles.some(role => user?.roles?.includes(role)) || false
    }, [user]),
    
    isAdmin: user?.is_admin || false
  }
}

/**
 * User Permissions Hook
 * Manages user permissions and role-based access control
 */
export const useUserPermissions = (user) => {
  const {
    data: permissions,
    isLoading,
    error
  } = useQuery({
    queryKey: ['auth', 'permissions', user?.id],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/auth/permissions')
        return response.data.permissions
      } catch (error) {
        console.error('Failed to get permissions:', error)
        throw error
      }
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 15 * 60 * 1000, // 15 minutes
  })

  // Helper functions for permission checking
  const hasPermission = useCallback((permission) => {
    return permissions?.[permission] === true
  }, [permissions])

  const hasAnyPermission = useCallback((permissionList) => {
    return permissionList.some(permission => permissions?.[permission] === true)
  }, [permissions])

  const hasAllPermissions = useCallback((permissionList) => {
    return permissionList.every(permission => permissions?.[permission] === true)
  }, [permissions])

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    
    // Shortcut permission checks
    canViewReports: permissions?.can_view_reports || false,
    canAccessAdmin: permissions?.can_access_admin || false,
    canManageUsers: permissions?.can_manage_users || false,
    canViewRoleAData: permissions?.can_view_role_a_data || false,
    canViewRoleBData: permissions?.can_view_role_b_data || false,
  }
}

/**
 * Auth Status Hook
 * Provides simple authentication status
 */
export const useAuthStatus = () => {
  const isAuthenticated = useIsAuthenticated()
  const { user, isLoading } = useAuth()
  
  return {
    isAuthenticated,
    isLoading,
    isReady: !isLoading && isAuthenticated && !!user
  }
}

/**
 * Token Hook
 * Manages access tokens with automatic refresh
 */
export const useToken = (scopes) => {
  const { getToken } = useAuth()
  
  const {
    data: token,
    isLoading,
    error,
    refetch: refreshToken
  } = useQuery({
    queryKey: ['auth', 'token', scopes],
    queryFn: () => getToken(scopes),
    enabled: false, // Manual fetch only
    staleTime: 50 * 60 * 1000, // 50 minutes (tokens usually expire in 1 hour)
    cacheTime: 55 * 60 * 1000, // 55 minutes
  })

  return {
    token,
    isLoading,
    error,
    refreshToken
  }
}

/**
 * Auth Error Hook
 * Handles authentication errors globally
 */
export const useAuthError = () => {
  const { error } = useAuth()
  const [lastError, setLastError] = useState(null)

  useEffect(() => {
    if (error && error !== lastError) {
      setLastError(error)
      
      // Handle different error types
      if (error.response?.status === 401) {
        console.warn('Authentication expired, redirecting to login...')
        // Could trigger re-authentication here
      } else if (error.response?.status === 403) {
        console.warn('Insufficient permissions')
      } else {
        console.error('Authentication error:', error)
      }
    }
  }, [error, lastError])

  const clearError = useCallback(() => {
    setLastError(null)
  }, [])

  return {
    error,
    lastError,
    clearError,
    hasError: !!error,
    isAuthError: error?.response?.status === 401,
    isPermissionError: error?.response?.status === 403
  }
}