import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  BarChart3, 
  Grid3x3, 
  List, 
  Search, 
  Filter, 
  RefreshCw, 
  ChevronDown,
  Eye,
  EyeOff,
  Maximize2,
  Download,
  Settings
} from 'lucide-react'

import PowerBIEmbed from './PowerBIEmbed'
import { getAvailableReports, getWorkspaceInfo, clearTokenCache } from '@/services/powerbiService'
import { useAuth } from '@/hooks/useAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

/**
 * Report Container Component
 * Manages multiple PowerBI reports with filtering, search, and layout options
 */
const ReportContainer = ({
  selectedReportId = null,
  layout = 'grid', // 'grid', 'list', 'single'
  showSearch = true,
  showFilters = true,
  showLayoutToggle = true,
  allowMultipleReports = true,
  defaultHeight = '600px',
  className = ''
}) => {
  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLayout, setSelectedLayout] = useState(layout)
  const [visibleReports, setVisibleReports] = useState(new Set())
  const [reportFilters, setReportFilters] = useState({})
  const [expandedReport, setExpandedReport] = useState(null)

  // Auth context
  const { user, userRoles, hasRole } = useAuth()

  // Fetch available reports
  const {
    data: reportsData,
    isLoading: reportsLoading,
    error: reportsError,
    refetch: refetchReports
  } = useQuery({
    queryKey: ['powerbi-reports', user?.id],
    queryFn: getAvailableReports,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false
  })

  // Fetch workspace info
  const {
    data: workspaceData,
    isLoading: workspaceLoading
  } = useQuery({
    queryKey: ['powerbi-workspace', user?.id],
    queryFn: getWorkspaceInfo,
    enabled: !!user,
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false
  })

  // Process reports data
  const reports = useMemo(() => {
    if (!reportsData?.reports) return []
    
    let filteredReports = reportsData.reports

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filteredReports = filteredReports.filter(report =>
        report.name?.toLowerCase().includes(term) ||
        report.displayName?.toLowerCase().includes(term) ||
        report.description?.toLowerCase().includes(term)
      )
    }

    // Sort reports by name
    return filteredReports.sort((a, b) => 
      (a.displayName || a.name || '').localeCompare(b.displayName || b.name || '')
    )
  }, [reportsData?.reports, searchTerm])

  // Initialize visible reports based on layout and selection
  useEffect(() => {
    if (reports.length === 0) return

    if (selectedReportId) {
      // Show only selected report
      setVisibleReports(new Set([selectedReportId]))
    } else if (selectedLayout === 'single' && reports.length > 0) {
      // Show first report in single layout
      setVisibleReports(new Set([reports[0].id]))
    } else if (allowMultipleReports && selectedLayout !== 'single') {
      // Show all reports in grid/list layout
      setVisibleReports(new Set(reports.map(r => r.id)))
    }
  }, [reports, selectedReportId, selectedLayout, allowMultipleReports])

  /**
   * Toggle report visibility
   */
  const toggleReportVisibility = (reportId) => {
    setVisibleReports(prev => {
      const newSet = new Set(prev)
      if (newSet.has(reportId)) {
        newSet.delete(reportId)
      } else {
        if (selectedLayout === 'single') {
          // In single layout, only one report visible
          newSet.clear()
        }
        newSet.add(reportId)
      }
      return newSet
    })
  }

  /**
   * Handle layout change
   */
  const handleLayoutChange = (newLayout) => {
    setSelectedLayout(newLayout)
    
    if (newLayout === 'single' && visibleReports.size > 1) {
      // Keep only first visible report in single layout
      const firstReport = Array.from(visibleReports)[0]
      setVisibleReports(new Set([firstReport]))
    }
  }

  /**
   * Handle report expansion (fullscreen within container)
   */
  const handleReportExpand = (reportId) => {
    setExpandedReport(expandedReport === reportId ? null : reportId)
  }

  /**
   * Clear all caches and refresh
   */
  const handleRefreshAll = () => {
    clearTokenCache()
    refetchReports()
    toast.success('Reportes actualizados')
  }

  /**
   * Get report role-based filters
   */
  const getReportRoles = () => {
    // Return user roles that PowerBI can understand
    const roles = []
    
    if (hasRole('Admin')) {
      roles.push('Admin')
    } else if (hasRole('RolA')) {
      roles.push('RolA')
    } else if (hasRole('RolB')) {
      roles.push('RolB')
    }
    
    return roles
  }

  // Loading state
  if (reportsLoading || workspaceLoading) {
    return (
      <div className={`report-container loading ${className}`}>
        <LoadingSpinner size="lg" />
        <p className="text-gray-600 mt-4">Cargando reportes disponibles...</p>
      </div>
    )
  }

  // Error state
  if (reportsError) {
    return (
      <div className={`report-container error ${className}`}>
        <div className="error-content">
          <BarChart3 className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error al cargar reportes</h3>
          <p className="text-red-500 mb-4">No se pudieron cargar los reportes disponibles</p>
          <button
            onClick={refetchReports}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // No reports available
  if (!reports || reports.length === 0) {
    return (
      <div className={`report-container empty ${className}`}>
        <div className="empty-content">
          <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay reportes disponibles</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm 
              ? `No se encontraron reportes que coincidan con "${searchTerm}"`
              : 'No tienes acceso a ningún reporte en este momento'
            }
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className={`report-container ${selectedLayout} ${className}`}>
        {/* Header Controls */}
        <div className="report-controls">
          <div className="controls-left">
            <h2 className="text-xl font-semibold text-gray-800">
              Reportes de PowerBI
              {workspaceData && (
                <span className="text-sm text-gray-500 ml-2">
                  ({workspaceData.workspace_name})
                </span>
              )}
            </h2>
            <span className="text-sm text-gray-500">
              {reports.length} reporte{reports.length !== 1 ? 's' : ''} disponible{reports.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="controls-right">
            {/* Search */}
            {showSearch && (
              <div className="search-container">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar reportes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            )}

            {/* Layout Toggle */}
            {showLayoutToggle && allowMultipleReports && (
              <div className="layout-toggle">
                <button
                  onClick={() => handleLayoutChange('grid')}
                  className={`layout-btn ${selectedLayout === 'grid' ? 'active' : ''}`}
                  title="Vista en grilla"
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleLayoutChange('list')}
                  className={`layout-btn ${selectedLayout === 'list' ? 'active' : ''}`}
                  title="Vista en lista"
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleLayoutChange('single')}
                  className={`layout-btn ${selectedLayout === 'single' ? 'active' : ''}`}
                  title="Vista individual"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Refresh All */}
            <button
              onClick={handleRefreshAll}
              className="refresh-btn"
              title="Actualizar todos los reportes"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Reports Grid/List */}
        <div className={`reports-layout layout-${selectedLayout}`}>
          {reports.map((report) => {
            const isVisible = visibleReports.has(report.id)
            const isExpanded = expandedReport === report.id

            return (
              <div
                key={report.id}
                className={`report-item ${isVisible ? 'visible' : 'hidden'} ${isExpanded ? 'expanded' : ''}`}
              >
                {/* Report Header */}
                <div className="report-header">
                  <div className="report-info">
                    <h3 className="report-title">
                      {report.displayName || report.name}
                    </h3>
                    {report.description && (
                      <p className="report-description">{report.description}</p>
                    )}
                  </div>

                  <div className="report-actions">
                    <button
                      onClick={() => toggleReportVisibility(report.id)}
                      className="action-btn"
                      title={isVisible ? 'Ocultar reporte' : 'Mostrar reporte'}
                    >
                      {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>

                    {isVisible && (
                      <button
                        onClick={() => handleReportExpand(report.id)}
                        className="action-btn"
                        title={isExpanded ? 'Contraer' : 'Expandir'}
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* PowerBI Embed */}
                {isVisible && (
                  <div className="report-embed">
                    <PowerBIEmbed
                      reportId={report.id}
                      datasetId={report.datasetId}
                      title={report.displayName || report.name}
                      height={isExpanded ? '80vh' : defaultHeight}
                      showToolbar={true}
                      allowExport={true}
                      allowFullscreen={true}
                      customSettings={{
                        filterPaneEnabled: false,
                        navContentPaneEnabled: true
                      }}
                      onReportLoad={(reportInstance) => {
                        console.log(`🔷 Report ${report.id} loaded successfully`)
                      }}
                      onError={(error) => {
                        console.error(`❌ Error in report ${report.id}:`, error)
                        toast.error(`Error en reporte: ${report.displayName || report.name}`)
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer Info */}
        <div className="report-footer">
          <div className="footer-info">
            <span className="text-sm text-gray-500">
              Mostrando {visibleReports.size} de {reports.length} reportes
            </span>
            {userRoles.length > 0 && (
              <span className="text-sm text-gray-500">
                | Roles: {userRoles.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        .report-container {
          @apply bg-gray-50;
          padding: 24px;
          min-height: 100vh;
        }

        .report-container.loading,
        .report-container.error,
        .report-container.empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 500px;
        }

        .error-content,
        .empty-content {
          text-align: center;
          max-width: 400px;
        }

        .report-controls {
          @apply bg-white rounded-lg border border-gray-200 p-4 mb-6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .controls-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .controls-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .search-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          @apply h-4 w-4 text-gray-400;
          pointer-events: none;
        }

        .search-input {
          @apply pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm;
          width: 240px;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          @apply outline-none border-blue-500 ring-1 ring-blue-500;
        }

        .layout-toggle {
          display: flex;
          @apply border border-gray-300 rounded-lg;
          overflow: hidden;
        }

        .layout-btn {
          @apply px-3 py-2 text-gray-600 hover:bg-gray-100 transition-colors;
          border-right: 1px solid #e5e7eb;
        }

        .layout-btn:last-child {
          border-right: none;
        }

        .layout-btn.active {
          @apply bg-blue-100 text-blue-600;
        }

        .refresh-btn {
          @apply p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors;
        }

        .reports-layout {
          display: grid;
          gap: 24px;
        }

        .layout-grid {
          grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
        }

        .layout-list {
          grid-template-columns: 1fr;
        }

        .layout-single {
          grid-template-columns: 1fr;
        }

        .report-item {
          @apply bg-white rounded-lg border border-gray-200 shadow-sm;
          transition: all 0.3s ease;
        }

        .report-item.expanded {
          grid-column: 1 / -1;
        }

        .report-item.hidden .report-embed {
          display: none;
        }

        .report-header {
          @apply p-4 border-b border-gray-200;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .report-info {
          flex: 1;
        }

        .report-title {
          @apply text-lg font-semibold text-gray-800 mb-1;
        }

        .report-description {
          @apply text-sm text-gray-600;
          margin: 0;
        }

        .report-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          @apply p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors;
        }

        .report-embed {
          padding: 0;
        }

        .report-footer {
          @apply bg-white rounded-lg border border-gray-200 p-4 mt-6;
        }

        .footer-info {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
        }

        @media (max-width: 768px) {
          .report-container {
            padding: 16px;
          }

          .layout-grid {
            grid-template-columns: 1fr;
          }

          .controls-right {
            flex-wrap: wrap;
          }

          .search-input {
            width: 200px;
          }
        }
      `}</style>
    </ErrorBoundary>
  )
}

export default ReportContainer