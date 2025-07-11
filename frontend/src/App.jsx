import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'

// Layout Components
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// Pages
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { Reports } from '@/pages/Reports'
import { Admin } from '@/pages/Admin'
import { NotFound } from '@/pages/NotFound'

// Hooks
import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'

// Utils
import { cn } from '@/utils/cn'

function App() {
  const isAuthenticated = useIsAuthenticated()
  const { instance: msalInstance } = useMsal()
  const location = useLocation()
  
  // Custom hooks for auth and permissions
  const { user, isLoading: authLoading, error: authError } = useAuth()
  const { permissions, isLoading: permissionsLoading } = useUserPermissions(user)

  // Handle authentication errors
  useEffect(() => {
    if (authError) {
      console.error('Authentication error:', authError)
      toast.error('Authentication failed. Please try signing in again.')
    }
  }, [authError])

  // Handle MSAL errors
  useEffect(() => {
    const handleError = (error) => {
      console.error('MSAL Error:', error)
      
      // Handle specific error types
      if (error.name === 'InteractionRequiredAuthError') {
        toast.error('Please sign in to continue')
      } else if (error.name === 'ServerError') {
        toast.error('Server error occurred. Please try again.')
      } else {
        toast.error('An authentication error occurred')
      }
    }

    // Listen for MSAL errors
    msalInstance.addEventCallback((event) => {
      if (event.eventType === 'msal:loginFailure' || 
          event.eventType === 'msal:acquireTokenFailure') {
        handleError(event.error)
      }
    })
  }, [msalInstance])

  // Page tracking (for analytics)
  useEffect(() => {
    if (import.meta.env.PROD && isAuthenticated) {
      // Track page views in production
      console.log('Page view:', location.pathname)
      // Add analytics tracking here
    }
  }, [location.pathname, isAuthenticated])

  // Loading state
  if (authLoading || (isAuthenticated && permissionsLoading)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 font-medium">
            {authLoading ? 'Authenticating...' : 'Loading user permissions...'}
          </p>
        </div>
      </div>
    )
  }

  // Authentication required
  if (!isAuthenticated) {
    return (
      <>
        <Helmet>
          <title>Sign In - Microsoft Fabric Embedded</title>
          <meta name="description" content="Sign in to access your Microsoft Fabric analytics dashboard" />
        </Helmet>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </>
    )
  }

  // Main application routes
  return (
    <>
      <Helmet titleTemplate="%s - Microsoft Fabric Embedded">
        <title>Dashboard</title>
        <meta name="description" content="Microsoft Fabric embedded analytics dashboard with PowerBI reports" />
      </Helmet>
      
      <div className="min-h-screen bg-gray-50">
        <Routes>
          {/* Public authenticated routes */}
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          
          {/* Protected routes with layout */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            
            {/* Dashboard - All authenticated users */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            
            {/* Reports - Users with report access */}
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute requiredPermissions={['can_view_reports']}>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/reports/:reportId" 
              element={
                <ProtectedRoute requiredPermissions={['can_view_reports']}>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            
            {/* Admin - Admin users only */}
            <Route 
              path="/admin/*" 
              element={
                <ProtectedRoute requiredPermissions={['can_access_admin']}>
                  <Admin />
                </ProtectedRoute>
              } 
            />
          </Route>
          
          {/* 404 - Not found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </>
  )
}

export default App