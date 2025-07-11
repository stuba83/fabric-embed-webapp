import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useIsAuthenticated } from '@azure/msal-react'
import { AlertTriangle, Lock, ShieldX } from 'lucide-react'

import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useAuth } from '@/hooks/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/utils/cn'

/**
 * ProtectedRoute Component
 * 
 * Protects routes based on authentication and permissions
 * Handles loading states and error scenarios
 */
export const ProtectedRoute = ({ 
  children, 
  requiredPermissions = [],
  requiredRoles = [],
  fallbackPath = '/login',
  showAccessDenied = true 
}) => {
  const isAuthenticated = useIsAuthenticated()
  const location = useLocation()
  const { user, isLoading: authLoading, error: authError } = useAuth()
  const { permissions, isLoading: permissionsLoading, error: permissionsError } = useUserPermissions(user)

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={fallbackPath} 
        state={{ from: location.pathname }} 
        replace 
      />
    )
  }

  // Loading states
  if (authLoading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 font-medium">
            {authLoading ? 'Authenticating...' : 'Loading permissions...'}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we verify your access
          </p>
        </div>
      </div>
    )
  }

  // Authentication or permission errors
  if (authError || permissionsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Error
            </h2>
            <p className="text-gray-600 mb-6">
              {authError?.message || permissionsError?.message || 'Unable to verify your authentication'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // No user data
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            User Information Unavailable
          </h2>
          <p className="text-gray-600 mb-4">
            We couldn't load your user information. Please try signing in again.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In Again
          </button>
        </div>
      </div>
    )
  }

  // Check role requirements
  if (requiredRoles.length > 0) {
    const userRoles = user.roles || []
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role))
    
    if (!hasRequiredRole) {
      if (!showAccessDenied) {
        return <Navigate to="/dashboard" replace />
      }
      
      return <AccessDeniedPage requiredRoles={requiredRoles} userRoles={userRoles} />
    }
  }

  // Check permission requirements
  if (requiredPermissions.length > 0) {
    if (!permissions) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )
    }

    const hasRequiredPermissions = requiredPermissions.every(permission => 
      permissions[permission] === true
    )
    
    if (!hasRequiredPermissions) {
      if (!showAccessDenied) {
        return <Navigate to="/dashboard" replace />
      }
      
      return (
        <AccessDeniedPage 
          requiredPermissions={requiredPermissions} 
          userPermissions={permissions} 
        />
      )
    }
  }

  // All checks passed - render children
  return children
}

/**
 * Access Denied Page Component
 */
const AccessDeniedPage = ({ requiredRoles = [], requiredPermissions = [], userRoles = [], userPermissions = {} }) => {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Icon */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldX className="w-10 h-10 text-red-600" />
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600">
              You don't have permission to access this page
            </p>
          </div>

          {/* Requirements */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <Lock className="w-4 h-4 mr-2" />
              Access Requirements
            </h3>
            
            {requiredRoles.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 mb-1">Required Roles:</p>
                <div className="flex flex-wrap gap-2">
                  {requiredRoles.map(role => (
                    <span
                      key={role}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        userRoles.includes(role)
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      )}
                    >
                      {role}
                      {userRoles.includes(role) && " ✓"}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {requiredPermissions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Required Permissions:</p>
                <div className="space-y-1">
                  {requiredPermissions.map(permission => (
                    <div
                      key={permission}
                      className={cn(
                        "flex items-center text-xs",
                        userPermissions[permission]
                          ? "text-green-700"
                          : "text-red-700"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full mr-2",
                        userPermissions[permission] ? "bg-green-500" : "bg-red-500"
                      )} />
                      {permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Current User Info */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Your Current Access</h3>
            {userRoles.length > 0 && (
              <div className="mb-2">
                <p className="text-sm font-medium text-gray-700 mb-1">Your Roles:</p>
                <div className="flex flex-wrap gap-1">
                  {userRoles.map(role => (
                    <span
                      key={role}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-gray-600">
              If you believe you should have access, please contact your administrator.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Go Back
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
          </div>

          {/* Support */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Need help?{' '}
              <a 
                href="mailto:support@yourcompany.com" 
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook for checking permissions in components
 */
export const usePermissionCheck = (requiredPermissions = [], requiredRoles = []) => {
  const { user } = useAuth()
  const { permissions } = useUserPermissions(user)

  const hasRoles = requiredRoles.length === 0 || requiredRoles.some(role => 
    user?.roles?.includes(role)
  )

  const hasPermissions = requiredPermissions.length === 0 || requiredPermissions.every(permission => 
    permissions?.[permission] === true
  )

  return {
    hasAccess: hasRoles && hasPermissions,
    hasRoles,
    hasPermissions,
    userRoles: user?.roles || [],
    userPermissions: permissions || {}
  }
}

export default ProtectedRoute