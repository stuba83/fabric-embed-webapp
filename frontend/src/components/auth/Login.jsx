import React, { useState, useEffect } from 'react'
import { useMsal } from '@azure/msal-react'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { LogIn, Shield, BarChart3, Users, Zap, CheckCircle } from 'lucide-react'

import { loginRequest } from '@/services/authService'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { cn } from '@/utils/cn'

export const Login = () => {
  const { instance: msalInstance } = useMsal()
  const [isLoading, setIsLoading] = useState(false)
  const [loginMethod, setLoginMethod] = useState('popup') // 'popup' or 'redirect'

  // Handle authentication
  const handleLogin = async (method = loginMethod) => {
    setIsLoading(true)
    
    try {
      if (method === 'popup') {
        await msalInstance.loginPopup(loginRequest)
        toast.success('Successfully signed in!')
      } else {
        await msalInstance.loginRedirect(loginRequest)
        // Redirect method doesn't return here
      }
    } catch (error) {
      console.error('Login failed:', error)
      
      // Handle specific error types
      if (error.errorCode === 'popup_window_error' || error.errorCode === 'user_cancelled') {
        toast.error('Sign in was cancelled. Please try again.')
      } else if (error.errorCode === 'consent_required') {
        toast.error('Additional permissions required. Please contact your administrator.')
      } else {
        toast.error('Sign in failed. Please try again or contact support.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handle keyboard events
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Enter' && !isLoading) {
        handleLogin()
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [isLoading])

  return (
    <>
      <Helmet>
        <title>Sign In - Microsoft Fabric Embedded</title>
        <meta name="description" content="Sign in with your Microsoft account to access your analytics dashboard" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex">
        {/* Left Panel - Branding and Features */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
          </div>
          
          {/* Content */}
          <div className="relative z-10 flex flex-col justify-center px-12 py-24 text-white">
            <div className="mb-12">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl font-bold">Microsoft Fabric</h1>
                  <p className="text-blue-100">Embedded Analytics</p>
                </div>
              </div>
              
              <h2 className="text-4xl font-bold mb-4 leading-tight">
                Enterprise Analytics
                <br />
                <span className="text-blue-200">Made Simple</span>
              </h2>
              
              <p className="text-xl text-blue-100 leading-relaxed">
                Access powerful business intelligence with secure, 
                role-based data insights powered by Microsoft Fabric.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm mt-1">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Secure Authentication</h3>
                  <p className="text-blue-100">Enterprise-grade security with Microsoft Entra ID</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm mt-1">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Role-Based Access</h3>
                  <p className="text-blue-100">See only the data you're authorized to access</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm mt-1">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Real-Time Insights</h3>
                  <p className="text-blue-100">Interactive dashboards with live data updates</p>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 pt-8 border-t border-white/20">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-300" />
                  <span className="text-sm text-blue-100">SOC 2 Compliant</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-300" />
                  <span className="text-sm text-blue-100">GDPR Ready</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-300" />
                  <span className="text-sm text-blue-100">ISO 27001</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="flex-1 flex flex-col justify-center px-8 py-12 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gray-900">Microsoft Fabric</h1>
                <p className="text-gray-600 text-sm">Embedded Analytics</p>
              </div>
            </div>

            {/* Welcome Message */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome Back
              </h2>
              <p className="text-gray-600">
                Sign in with your Microsoft account to continue
              </p>
            </div>

            {/* Login Card */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              {/* Sign In Button */}
              <button
                onClick={() => handleLogin()}
                disabled={isLoading}
                className={cn(
                  "w-full flex items-center justify-center px-6 py-4 rounded-xl font-semibold transition-all duration-200",
                  "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700",
                  "text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg",
                  "focus:outline-none focus:ring-4 focus:ring-blue-500/25"
                )}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-3" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-3" />
                    Sign in with Microsoft
                  </>
                )}
              </button>

              {/* Login Method Toggle */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm text-gray-600 mb-3">Having trouble with popups?</p>
                <button
                  onClick={() => handleLogin('redirect')}
                  disabled={isLoading}
                  className={cn(
                    "w-full px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                    "bg-gray-50 hover:bg-gray-100 text-gray-700",
                    "border border-gray-200 hover:border-gray-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "focus:outline-none focus:ring-2 focus:ring-gray-500/25"
                  )}
                >
                  Use redirect method instead
                </button>
              </div>

              {/* Help Text */}
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </div>

            {/* Support Info */}
            <div className="mt-8 text-center">
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
    </>
  )
}