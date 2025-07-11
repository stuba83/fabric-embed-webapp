import React, { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { toast, Toaster } from 'sonner'
import { useIsAuthenticated } from '@azure/msal-react'

import Header from './Header'
import Sidebar from './Sidebar'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useAuth } from '@/hooks/useAuth'
import { STORAGE_KEYS, APP_CONFIG } from '@/utils/constants'

/**
 * Layout Component
 * Main application layout that wraps all pages with header, sidebar, and content area
 */
const Layout = () => {
  // State
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Get initial sidebar state from localStorage or default to open on desktop
    const saved = localStorage.getItem(`${STORAGE_KEYS.LAYOUT_PREFERENCES}_sidebar_open`)
    if (saved !== null) {
      return JSON.parse(saved)
    }
    // Default to closed on mobile, open on desktop
    return window.innerWidth >= 1024
  })
  const [isLoading, setIsLoading] = useState(true)
  const [contentKey, setContentKey] = useState(0)

  // Hooks
  const location = useLocation()
  const isAuthenticated = useIsAuthenticated()
  const { user, isLoading: userLoading } = useAuth()

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_KEYS.LAYOUT_PREFERENCES}_sidebar_open`,
      JSON.stringify(sidebarOpen)
    )
  }, [sidebarOpen])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Auto-close sidebar on mobile when resizing
      if (window.innerWidth < 1024 && sidebarOpen) {
        setSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [sidebarOpen])

  // Handle route changes
  useEffect(() => {
    // Close sidebar on mobile when route changes
    if (window.innerWidth < 1024) {
      setSidebarOpen(false)
    }

    // Force content re-render for better transitions
    setContentKey(prev => prev + 1)

    // Scroll to top on route change
    window.scrollTo(0, 0)

    // Update last visited route
    localStorage.setItem(STORAGE_KEYS.LAST_VISITED, location.pathname)
  }, [location.pathname])

  // Handle loading states
  useEffect(() => {
    if (!userLoading && isAuthenticated) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [userLoading, isAuthenticated])

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev)
  }

  // Close sidebar (for mobile)
  const closeSidebar = () => {
    setSidebarOpen(false)
  }

  // Handle offline/online status
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Conexión restaurada')
    }

    const handleOffline = () => {
      toast.error('Conexión perdida. Algunas funciones pueden no estar disponibles.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Show loading screen while authenticating
  if (isLoading || userLoading || !isAuthenticated) {
    return (
      <div className="loading-layout">
        <Helmet>
          <title>Cargando... | {APP_CONFIG.name}</title>
        </Helmet>
        
        <div className="loading-content">
          <div className="loading-brand">
            <div className="brand-icon"></div>
            <h1 className="brand-title">{APP_CONFIG.name}</h1>
            <p className="brand-subtitle">{APP_CONFIG.description}</p>
          </div>
          
          <LoadingSpinner 
            size="lg" 
            text={userLoading ? "Cargando perfil de usuario..." : "Inicializando aplicación..."} 
          />
          
          <div className="loading-footer">
            <p className="loading-version">Versión {APP_CONFIG.version}</p>
            <p className="loading-powered">Powered by Microsoft Fabric</p>
          </div>
        </div>
      </div>
    )
  }

  // Get page-specific metadata
  const getPageMetadata = () => {
    const baseMeta = {
      title: APP_CONFIG.name,
      description: APP_CONFIG.description
    }

    switch (location.pathname) {
      case '/dashboard':
        return {
          title: `Dashboard | ${APP_CONFIG.name}`,
          description: 'Panel principal con métricas y reportes de Microsoft Fabric'
        }
      case '/reports':
        return {
          title: `Reportes | ${APP_CONFIG.name}`,
          description: 'Explora y visualiza reportes de PowerBI con Microsoft Fabric'
        }
      case '/admin':
        return {
          title: `Administración | ${APP_CONFIG.name}`,
          description: 'Panel de administración del sistema Microsoft Fabric Embedded'
        }
      default:
        return baseMeta
    }
  }

  const metadata = getPageMetadata()

  return (
    <ErrorBoundary variant="detailed" showDetails={false}>
      <Helmet>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#3b82f6" />
      </Helmet>

      <div className="app-layout">
        {/* Header */}
        <Header 
          onMenuToggle={toggleSidebar}
          isSidebarOpen={sidebarOpen}
        />

        {/* Main Content Area */}
        <div className="app-body">
          {/* Sidebar */}
          <Sidebar 
            isOpen={sidebarOpen}
            onClose={closeSidebar}
          />

          {/* Main Content */}
          <main className={`app-main ${sidebarOpen ? 'with-sidebar' : 'without-sidebar'}`}>
            <div className="main-content">
              <ErrorBoundary variant="minimal">
                <div key={contentKey} className="content-wrapper">
                  <Outlet />
                </div>
              </ErrorBoundary>
            </div>

            {/* Content Footer */}
            <footer className="content-footer">
              <div className="footer-content">
                <div className="footer-left">
                  <span className="footer-text">
                    © 2025 {APP_CONFIG.name}. Powered by Microsoft Fabric.
                  </span>
                </div>
                <div className="footer-right">
                  <a href="/privacy" className="footer-link">Privacidad</a>
                  <a href="/terms" className="footer-link">Términos</a>
                  <a href="/help" className="footer-link">Ayuda</a>
                  <span className="footer-version">v{APP_CONFIG.version}</span>
                </div>
              </div>
            </footer>
          </main>
        </div>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          expand={true}
          richColors
          closeButton
          duration={4000}
          toastOptions={{
            style: {
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px'
            },
            className: 'toast-notification',
          }}
        />

        {/* Keyboard Navigation Indicator */}
        <div className="keyboard-nav-indicator" aria-live="polite" aria-atomic="true">
          <span className="sr-only">
            Usa Tab para navegar, Enter para seleccionar, Escape para cerrar menús
          </span>
        </div>
      </div>

      {/* Global Styles */}
      <style jsx>{`
        .loading-layout {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .loading-content {
          text-align: center;
          max-width: 400px;
          padding: 32px;
        }

        .loading-brand {
          margin-bottom: 32px;
        }

        .brand-icon {
          width: 64px;
          height: 64px;
          background: white;
          border-radius: 16px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }

        .brand-icon::before {
          content: "📊";
          font-size: 32px;
        }

        .brand-title {
          @apply text-2xl font-bold text-white mb-2;
        }

        .brand-subtitle {
          @apply text-white/80;
          margin: 0;
        }

        .loading-footer {
          margin-top: 32px;
          @apply text-white/60 text-sm;
        }

        .loading-version,
        .loading-powered {
          margin: 4px 0;
        }

        .app-layout {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
        }

        .app-body {
          display: flex;
          flex: 1;
          position: relative;
        }

        .app-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          transition: margin-left 0.3s ease;
          min-height: calc(100vh - 64px);
        }

        .app-main.with-sidebar {
          margin-left: 280px;
        }

        .app-main.without-sidebar {
          margin-left: 0;
        }

        .main-content {
          flex: 1;
          overflow-x: auto;
        }

        .content-wrapper {
          animation: fadeIn 0.3s ease-in-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .content-footer {
          @apply border-t border-gray-200 bg-white/50 backdrop-blur-sm;
          margin-top: auto;
        }

        .footer-content {
          @apply px-6 py-4;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .footer-left {
          flex: 1;
        }

        .footer-text {
          @apply text-sm text-gray-600;
        }

        .footer-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .footer-link {
          @apply text-sm text-gray-600 hover:text-gray-800 transition-colors;
          text-decoration: none;
        }

        .footer-version {
          @apply text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-full;
        }

        .keyboard-nav-indicator {
          position: absolute;
          left: -10000px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Toast customization */
        :global(.toast-notification) {
          font-family: inherit !important;
        }

        /* Desktop responsive */
        @media (min-width: 1024px) {
          .app-main.with-sidebar {
            margin-left: 280px;
          }
        }

        /* Tablet responsive */
        @media (max-width: 1023px) {
          .app-main {
            margin-left: 0 !important;
          }
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .footer-content {
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 8px;
          }

          .footer-right {
            flex-wrap: wrap;
            justify-content: center;
            gap: 12px;
          }

          .loading-content {
            padding: 24px 16px;
          }

          .brand-title {
            @apply text-xl;
          }
        }

        /* Print styles */
        @media print {
          .app-header,
          .sidebar,
          .content-footer,
          .toast-notification {
            display: none !important;
          }

          .app-main {
            margin: 0 !important;
          }

          .main-content {
            padding: 0 !important;
          }
        }

        /* Accessibility enhancements */
        @media (prefers-reduced-motion: reduce) {
          .app-main {
            transition: none;
          }

          .content-wrapper {
            animation: none;
          }
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
          .app-layout {
            background: white;
          }

          .content-footer {
            @apply border-gray-800;
          }
        }

        /* Focus management */
        .app-layout :global(*:focus-visible) {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
          border-radius: 4px;
        }

        /* Loading states */
        .app-layout :global(.loading-shimmer) {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        /* Error states */
        .app-layout :global(.error-boundary) {
          margin: 24px;
        }

        /* Smooth transitions for all interactive elements */
        .app-layout :global(button),
        .app-layout :global(a),
        .app-layout :global(.nav-item),
        .app-layout :global(.dropdown-item) {
          transition: all 0.2s ease;
        }

        /* Ensure proper stacking contexts */
        .app-header {
          z-index: 40;
        }

        .sidebar {
          z-index: 30;
        }

        .app-main {
          z-index: 10;
        }

        /* Performance optimization */
        .app-layout {
          contain: layout style paint;
        }

        .main-content {
          contain: layout style;
        }
      `}</style>
    </ErrorBoundary>
  )
}

export default Layout