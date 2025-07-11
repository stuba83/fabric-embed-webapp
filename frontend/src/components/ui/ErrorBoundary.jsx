import React from 'react'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and potentially to logging service
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo)
    
    this.setState({
      error,
      errorInfo
    })

    // Log to external service if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      })
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  render() {
    if (this.state.hasError) {
      const {
        title = 'Algo salió mal',
        subtitle = 'Se produjo un error inesperado en la aplicación',
        showDetails = false,
        showRetry = true,
        showReload = true,
        showHome = true,
        variant = 'default' // 'default', 'minimal', 'detailed'
      } = this.props

      // Minimal error UI
      if (variant === 'minimal') {
        return (
          <div className="error-boundary minimal">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <p className="text-red-600 font-medium">Error al cargar el componente</p>
            <button onClick={this.handleRetry} className="retry-btn">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </button>
          </div>
        )
      }

      // Detailed error UI
      if (variant === 'detailed') {
        return (
          <div className="error-boundary detailed">
            <div className="error-content">
              <div className="error-header">
                <AlertTriangle className="h-12 w-12 text-red-500" />
                <div>
                  <h2 className="error-title">{title}</h2>
                  <p className="error-subtitle">{subtitle}</p>
                  <p className="error-id">ID del error: {this.state.errorId}</p>
                </div>
              </div>

              {(showDetails && this.state.error) && (
                <details className="error-details">
                  <summary className="error-details-toggle">
                    <Bug className="h-4 w-4 mr-2" />
                    Detalles técnicos
                  </summary>
                  <div className="error-details-content">
                    <div className="error-section">
                      <h4>Error:</h4>
                      <pre className="error-text">{this.state.error.toString()}</pre>
                    </div>
                    {this.state.errorInfo && (
                      <div className="error-section">
                        <h4>Stack trace:</h4>
                        <pre className="error-text">{this.state.errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="error-actions">
                {showRetry && (
                  <button onClick={this.handleRetry} className="btn-primary">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar
                  </button>
                )}
                {showReload && (
                  <button onClick={this.handleReload} className="btn-secondary">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recargar página
                  </button>
                )}
                {showHome && (
                  <button onClick={this.handleGoHome} className="btn-secondary">
                    <Home className="h-4 w-4 mr-2" />
                    Ir al inicio
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      }

      // Default error UI
      return (
        <div className="error-boundary default">
          <div className="error-content">
            <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
            
            <h2 className="error-title">{title}</h2>
            <p className="error-subtitle">{subtitle}</p>
            
            <div className="error-actions">
              {showRetry && (
                <button onClick={this.handleRetry} className="btn-primary">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reintentar
                </button>
              )}
              {showReload && (
                <button onClick={this.handleReload} className="btn-secondary">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recargar página
                </button>
              )}
            </div>

            {(showDetails && this.state.error) && (
              <details className="error-details">
                <summary>Ver detalles técnicos</summary>
                <pre className="error-text">{this.state.error.toString()}</pre>
              </details>
            )}
          </div>

          <style jsx>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 400px;
              padding: 32px;
            }

            .error-boundary.minimal {
              min-height: 200px;
              flex-direction: column;
              gap: 16px;
            }

            .error-boundary.detailed {
              min-height: 500px;
              background: #fef2f2;
              border: 1px solid #fecaca;
              border-radius: 12px;
            }

            .error-content {
              text-align: center;
              max-width: 600px;
              width: 100%;
            }

            .error-header {
              display: flex;
              align-items: flex-start;
              gap: 16px;
              text-align: left;
              margin-bottom: 24px;
            }

            .error-title {
              @apply text-2xl font-bold text-red-600 mb-2;
            }

            .error-subtitle {
              @apply text-gray-700 mb-4;
              margin: 0;
            }

            .error-id {
              @apply text-xs text-gray-500;
              margin: 0;
              font-family: monospace;
            }

            .error-actions {
              display: flex;
              gap: 12px;
              justify-content: center;
              flex-wrap: wrap;
              margin-bottom: 24px;
            }

            .btn-primary {
              @apply px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors;
              display: flex;
              align-items: center;
              font-weight: 500;
            }

            .btn-secondary {
              @apply px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors;
              display: flex;
              align-items: center;
              font-weight: 500;
            }

            .retry-btn {
              @apply px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors;
              display: flex;
              align-items: center;
              font-weight: 500;
            }

            .error-details {
              @apply bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6;
              text-align: left;
            }

            .error-details-toggle {
              @apply cursor-pointer font-medium text-gray-700 hover:text-gray-900;
              display: flex;
              align-items: center;
              list-style: none;
            }

            .error-details-toggle::-webkit-details-marker {
              display: none;
            }

            .error-details-content {
              margin-top: 16px;
            }

            .error-section {
              margin-bottom: 16px;
            }

            .error-section h4 {
              @apply text-sm font-semibold text-gray-700 mb-2;
              margin: 0;
            }

            .error-text {
              @apply bg-white border border-gray-200 rounded p-3 text-xs;
              font-family: 'Courier New', monospace;
              white-space: pre-wrap;
              overflow-x: auto;
              max-height: 200px;
              overflow-y: auto;
              color: #dc2626;
            }

            @media (max-width: 640px) {
              .error-boundary {
                padding: 16px;
                min-height: 300px;
              }

              .error-header {
                flex-direction: column;
                text-align: center;
                align-items: center;
              }

              .error-actions {
                flex-direction: column;
              }

              .btn-primary,
              .btn-secondary {
                width: 100%;
                justify-content: center;
              }
            }
          `}</style>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary