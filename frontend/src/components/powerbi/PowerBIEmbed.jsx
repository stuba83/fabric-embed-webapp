import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { 
  RefreshCw, 
  Download, 
  Maximize2, 
  Minimize2, 
  AlertTriangle, 
  Loader2,
  Settings,
  BarChart3,
  Eye,
  EyeOff
} from 'lucide-react'

import { 
  embedReport, 
  refreshReport, 
  exportToPDF, 
  setReportFilters,
  clearTokenCache 
} from '@/services/powerbiService'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

/**
 * PowerBI Embed Component
 * Embeds PowerBI reports with full functionality and error handling
 */
const PowerBIEmbed = ({
  reportId,
  datasetId = null,
  title = 'PowerBI Report',
  className = '',
  height = '600px',
  customSettings = {},
  filters = [],
  onReportLoad = null,
  onError = null,
  showToolbar = true,
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
  allowExport = true,
  allowFullscreen = true
}) => {
  // Refs
  const containerRef = useRef(null)
  const reportRef = useRef(null)
  const refreshIntervalRef = useRef(null)

  // State
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [reportMetadata, setReportMetadata] = useState(null)

  // Auth context
  const { user, userRoles } = useAuth()

  // Memoized embed settings
  const embedSettings = useMemo(() => ({
    filterPaneEnabled: false,
    navContentPaneEnabled: true,
    background: 'transparent',
    ...customSettings
  }), [customSettings])

  /**
   * Embed the PowerBI report
   */
  const embedPowerBIReport = useCallback(async () => {
    if (!containerRef.current || !reportId) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log('🔷 Embedding PowerBI report:', { reportId, datasetId, userRoles })

      // Clear any existing report
      if (reportRef.current) {
        try {
          reportRef.current.off()
          reportRef.current = null
        } catch (e) {
          console.warn('⚠️ Error clearing previous report:', e)
        }
      }

      // Clear container
      containerRef.current.innerHTML = ''

      // Embed new report
      const report = await embedReport(
        containerRef.current,
        reportId,
        datasetId,
        userRoles,
        embedSettings
      )

      reportRef.current = report

      // Set up additional event handlers
      report.on('loaded', () => {
        console.log('🔷 Report loaded successfully')
        setIsLoading(false)
        
        // Get report metadata
        report.getPages().then(pages => {
          setReportMetadata({
            pageCount: pages.length,
            pages: pages.map(p => ({ name: p.name, displayName: p.displayName }))
          })
        }).catch(console.warn)

        // Callback
        if (onReportLoad) {
          onReportLoad(report)
        }
      })

      report.on('error', (event) => {
        console.error('❌ PowerBI Report Error:', event.detail)
        setError('Error al cargar el reporte')
        setIsLoading(false)
        
        if (onError) {
          onError(event.detail)
        }
      })

      // Apply initial filters if provided
      if (filters && filters.length > 0) {
        setTimeout(() => {
          setReportFilters(report, filters).catch(console.warn)
        }, 1000)
      }

    } catch (error) {
      console.error('❌ Error embedding PowerBI report:', error)
      
      let errorMessage = 'Error al cargar el reporte'
      
      if (error.message === 'INSUFFICIENT_PERMISSIONS') {
        errorMessage = 'No tienes permisos para ver este reporte'
      } else if (error.message === 'REPORT_NOT_FOUND') {
        errorMessage = 'Reporte no encontrado'
      } else if (error.message === 'TOKEN_REQUEST_FAILED') {
        errorMessage = 'Error de autenticación. Intenta recargar la página.'
      }
      
      setError(errorMessage)
      setIsLoading(false)
      
      if (onError) {
        onError(error)
      }
    }
  }, [reportId, datasetId, userRoles, embedSettings, filters, onReportLoad, onError])

  /**
   * Refresh report data
   */
  const handleRefresh = useCallback(async () => {
    if (!reportRef.current) return

    setIsRefreshing(true)
    try {
      await refreshReport(reportRef.current)
    } catch (error) {
      console.error('❌ Error refreshing report:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  /**
   * Export report to PDF
   */
  const handleExport = useCallback(async () => {
    if (!reportRef.current) return

    try {
      const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${new Date().toISOString().split('T')[0]}.pdf`
      await exportToPDF(reportRef.current, filename)
    } catch (error) {
      console.error('❌ Error exporting report:', error)
    }
  }, [title])

  /**
   * Toggle fullscreen mode
   */
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev)
  }, [])

  /**
   * Toggle report visibility
   */
  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  /**
   * Set up auto-refresh
   */
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        if (!isLoading && !error && reportRef.current) {
          handleRefresh()
        }
      }, refreshInterval)

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      }
    }
  }, [autoRefresh, refreshInterval, isLoading, error, handleRefresh])

  /**
   * Initial embed and re-embed on dependencies change
   */
  useEffect(() => {
    if (reportId && user) {
      embedPowerBIReport()
    }

    // Cleanup on unmount
    return () => {
      if (reportRef.current) {
        try {
          reportRef.current.off()
        } catch (e) {
          console.warn('⚠️ Error cleaning up report:', e)
        }
      }
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [reportId, user, embedPowerBIReport])

  /**
   * Handle fullscreen escape key
   */
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      document.addEventListener('keydown', handleEscapeKey)
      return () => document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isFullscreen])

  // Don't render if no user or reportId
  if (!user || !reportId) {
    return null
  }

  // Error state
  if (error) {
    return (
      <div className={`powerbi-embed-container ${className}`}>
        {showToolbar && (
          <div className="powerbi-toolbar">
            <div className="toolbar-left">
              <BarChart3 className="h-5 w-5 text-red-500" />
              <span className="font-medium text-red-600">{title}</span>
            </div>
            <div className="toolbar-right">
              <button
                onClick={() => {
                  setError(null)
                  embedPowerBIReport()
                }}
                className="toolbar-btn"
                title="Reintentar"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <div className="powerbi-error">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error al cargar el reporte</h3>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null)
              embedPowerBIReport()
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className={`powerbi-embed-container ${isFullscreen ? 'fullscreen' : ''} ${className}`}>
        {/* Toolbar */}
        {showToolbar && (
          <div className="powerbi-toolbar">
            <div className="toolbar-left">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-700">{title}</span>
              {reportMetadata && (
                <span className="text-sm text-gray-500">
                  ({reportMetadata.pageCount} página{reportMetadata.pageCount !== 1 ? 's' : ''})
                </span>
              )}
            </div>

            <div className="toolbar-right">
              {/* Visibility Toggle */}
              <button
                onClick={toggleVisibility}
                className="toolbar-btn"
                title={isVisible ? 'Ocultar reporte' : 'Mostrar reporte'}
              >
                {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="toolbar-btn"
                title="Actualizar datos"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Export Button */}
              {allowExport && (
                <button
                  onClick={handleExport}
                  disabled={isLoading || !reportRef.current}
                  className="toolbar-btn"
                  title="Exportar a PDF"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}

              {/* Fullscreen Toggle */}
              {allowFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  className="toolbar-btn"
                  title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              )}

              {/* Auto-refresh indicator */}
              {autoRefresh && (
                <div className="flex items-center text-sm text-gray-500">
                  <Settings className="h-3 w-3 mr-1" />
                  Auto
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Container */}
        <div className={`powerbi-report-wrapper ${!isVisible ? 'hidden' : ''}`} style={{ height }}>
          {/* Loading Overlay */}
          {isLoading && (
            <div className="powerbi-loading">
              <LoadingSpinner size="lg" />
              <p className="text-gray-600 mt-4">Cargando reporte...</p>
            </div>
          )}

          {/* PowerBI Container */}
          <div
            ref={containerRef}
            className="powerbi-container"
            style={{ 
              width: '100%', 
              height: '100%',
              opacity: isLoading ? 0 : 1,
              transition: 'opacity 0.3s ease-in-out'
            }}
          />
        </div>

        {/* Fullscreen Overlay */}
        {isFullscreen && (
          <div className="fullscreen-overlay">
            <button
              onClick={toggleFullscreen}
              className="fullscreen-close"
              title="Cerrar pantalla completa"
            >
              <Minimize2 className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>

      {/* Styles */}
      <style jsx>{`
        .powerbi-embed-container {
          @apply bg-white rounded-lg border border-gray-200 shadow-sm;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .powerbi-embed-container.fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 50;
          @apply bg-white rounded-none border-0;
        }

        .powerbi-toolbar {
          @apply px-4 py-3 border-b border-gray-200 bg-gray-50;
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 56px;
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .toolbar-btn {
          @apply p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toolbar-btn:disabled {
          @apply text-gray-400 cursor-not-allowed;
        }

        .powerbi-report-wrapper {
          flex: 1;
          position: relative;
          overflow: hidden;
        }

        .powerbi-report-wrapper.hidden {
          display: none;
        }

        .powerbi-container {
          width: 100%;
          height: 100%;
        }

        .powerbi-loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          @apply bg-white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .powerbi-error {
          @apply p-8 text-center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .fullscreen-overlay {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 60;
        }

        .fullscreen-close {
          @apply p-2 bg-white text-gray-600 hover:text-gray-800 rounded-md shadow-lg hover:shadow-xl transition-all;
        }
      `}</style>
    </ErrorBoundary>
  )
}

export default PowerBIEmbed