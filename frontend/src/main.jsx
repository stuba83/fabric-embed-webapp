import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'sonner'

import App from './App.jsx'
import { msalConfig } from './services/authService.js'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import './index.css'

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig)

// Initialize MSAL
msalInstance.initialize().then(() => {
  console.log('MSAL initialized successfully')
}).catch((error) => {
  console.error('MSAL initialization failed:', error)
})

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 401/403 errors
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false
        }
        // Retry up to 3 times for other errors
        return failureCount < 3
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true
    },
    mutations: {
      retry: false,
      onError: (error) => {
        console.error('Mutation error:', error)
      }
    }
  }
})

// Error logging function
const logError = (error, errorInfo) => {
  console.error('Application Error:', error)
  console.error('Error Info:', errorInfo)
  
  // In production, send to monitoring service
  if (import.meta.env.PROD) {
    // Add error reporting service integration here
    // Example: Sentry, Application Insights, etc.
  }
}

// Application component with providers
const AppWithProviders = () => {
  return (
    <ErrorBoundary onError={logError}>
      <HelmetProvider>
        <MsalProvider instance={msalInstance}>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <App />
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#fff',
                    color: '#1f2937',
                    border: '1px solid #e5e7eb'
                  },
                  className: 'font-medium',
                  success: {
                    style: {
                      background: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #bbf7d0'
                    }
                  },
                  error: {
                    style: {
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca'
                    }
                  },
                  warning: {
                    style: {
                      background: '#fffbeb',
                      color: '#d97706',
                      border: '1px solid #fed7aa'
                    }
                  }
                }}
              />
            </BrowserRouter>
            {/* React Query DevTools - only in development */}
            {import.meta.env.DEV && (
              <ReactQueryDevtools 
                initialIsOpen={false}
                position="bottom-right"
              />
            )}
          </QueryClientProvider>
        </MsalProvider>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

// Performance monitoring
const startTime = performance.now()

// Remove loading screen when app is ready
const removeLoadingScreen = () => {
  const loadingElement = document.querySelector('.app-loading')
  if (loadingElement) {
    loadingElement.style.display = 'none'
    document.body.classList.add('app-ready')
  }
  
  // Log performance metrics
  const endTime = performance.now()
  const loadTime = endTime - startTime
  console.log(`App initialized in ${loadTime.toFixed(2)}ms`)
  
  // Report performance metrics in production
  if (import.meta.env.PROD && 'performance' in window) {
    // Add performance monitoring here
  }
}

// Initialize application
const initializeApp = async () => {
  try {
    // Wait for MSAL to be ready
    await msalInstance.initialize()
    
    // Handle redirect promise
    const response = await msalInstance.handleRedirectPromise()
    if (response) {
      console.log('Authentication redirect handled:', response)
    }
    
    // Get root element
    const rootElement = document.getElementById('root')
    if (!rootElement) {
      throw new Error('Root element not found')
    }
    
    // Create React root and render app
    const root = ReactDOM.createRoot(rootElement)
    
    root.render(
      <React.StrictMode>
        <AppWithProviders />
      </React.StrictMode>
    )
    
    // Remove loading screen after React renders
    setTimeout(removeLoadingScreen, 100)
    
  } catch (error) {
    console.error('Failed to initialize app:', error)
    
    // Show error message
    const rootElement = document.getElementById('root')
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          font-family: system-ui, sans-serif;
          text-align: center;
          padding: 20px;
          background: #fef2f2;
        ">
          <div style="
            max-width: 500px;
            padding: 32px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          ">
            <h1 style="color: #dc2626; margin-bottom: 16px; font-size: 24px;">
              Application Error
            </h1>
            <p style="color: #6b7280; margin-bottom: 24px; line-height: 1.6;">
              We're sorry, but something went wrong while loading the application.
            </p>
            <details style="text-align: left; margin-bottom: 24px;">
              <summary style="cursor: pointer; color: #4b5563; font-weight: 500;">
                Technical Details
              </summary>
              <pre style="
                background: #f9fafb;
                padding: 12px;
                border-radius: 6px;
                margin-top: 8px;
                font-size: 12px;
                color: #374151;
                overflow-x: auto;
              ">${error.message}</pre>
            </details>
            <button 
              onclick="window.location.reload()"
              style="
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.2s;
              "
              onmouseover="this.style.background='#2563eb'"
              onmouseout="this.style.background='#3b82f6'"
            >
              Reload Application
            </button>
          </div>
        </div>
      `
    }
  }
}

// Start the application
initializeApp()

// Handle browser compatibility warnings
if (import.meta.env.DEV) {
  // Warn about unsupported browsers in development
  const isModernBrowser = 
    'fetch' in window &&
    'Promise' in window &&
    'Map' in window &&
    'Set' in window &&
    'Symbol' in window
  
  if (!isModernBrowser) {
    console.warn('Some browser features may not be available. Please use a modern browser.')
  }
}

// Service Worker registration (optional)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration)
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError)
      })
  })
}