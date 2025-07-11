import React, { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { 
  BarChart3, 
  Search, 
  Filter, 
  Grid3x3, 
  List, 
  SortAsc, 
  SortDesc,
  Calendar,
  Clock,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
  Star,
  StarOff,
  ChevronDown,
  Settings,
  Bookmark,
  Share,
  MoreHorizontal
} from 'lucide-react'

import ReportContainer from '@/components/powerbi/ReportContainer'
import PowerBIEmbed from '@/components/powerbi/PowerBIEmbed'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { getAvailableReports, getWorkspaceInfo, clearTokenCache } from '@/services/powerbiService'
import { QUERY_KEYS, STORAGE_KEYS } from '@/utils/constants'

/**
 * Reports Page Component
 * Complete reports management interface with advanced filtering and viewing options
 */
const Reports = () => {
  // URL search params
  const [searchParams, setSearchParams] = useSearchParams()
  
  // State
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all')
  const [selectedLayout, setSelectedLayout] = useState(
    localStorage.getItem(STORAGE_KEYS.LAYOUT_PREFERENCES) || 'grid'
  )
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [favoriteReports, setFavoriteReports] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEYS.REPORT_SETTINGS}_favorites`)
    return saved ? JSON.parse(saved) : []
  })
  const [selectedReportId, setSelectedReportId] = useState(searchParams.get('reportId') || null)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState('browse') // 'browse', 'focus', 'compare'

  // Auth and permissions
  const { user } = useAuth()
  const { 
    canViewReports, 
    canExportReports, 
    isAdmin,
    getPowerBIFilters 
  } = useUserPermissions()

  // Query client for cache management
  const queryClient = useQueryClient()

  // Fetch reports
  const {
    data: reportsData,
    isLoading: reportsLoading,
    error: reportsError,
    refetch: refetchReports
  } = useQuery({
    queryKey: [QUERY_KEYS.POWERBI_REPORTS, user?.id],
    queryFn: getAvailableReports,
    enabled: !!user && canViewReports(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const {
    data: workspaceData,
    isLoading: workspaceLoading
  } = useQuery({
    queryKey: [QUERY_KEYS.POWERBI_WORKSPACE, user?.id],
    queryFn: getWorkspaceInfo,
    enabled: !!user,
    staleTime: 15 * 60 * 1000
  })

  // Process and filter reports
  const processedReports = useMemo(() => {
    if (!reportsData?.reports) return []

    let filtered = [...reportsData.reports]

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(report =>
        report.name?.toLowerCase().includes(term) ||
        report.displayName?.toLowerCase().includes(term) ||
        report.description?.toLowerCase().includes(term)
      )
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'favorites') {
        filtered = filtered.filter(report => favoriteReports.includes(report.id))
      } else if (selectedCategory === 'recent') {
        // Filter by recently accessed (mock implementation)
        const recentIds = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.REPORT_SETTINGS}_recent`) || '[]')
        filtered = filtered.filter(report => recentIds.includes(report.id))
      } else {
        // Filter by report type or other categories
        filtered = filtered.filter(report => report.category === selectedCategory)
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'name':
          aValue = (a.displayName || a.name || '').toLowerCase()
          bValue = (b.displayName || b.name || '').toLowerCase()
          break
        case 'created':
          aValue = new Date(a.createdDateTime || 0)
          bValue = new Date(b.createdDateTime || 0)
          break
        case 'modified':
          aValue = new Date(a.modifiedDateTime || 0)
          bValue = new Date(b.modifiedDateTime || 0)
          break
        case 'favorite':
          aValue = favoriteReports.includes(a.id) ? 1 : 0
          bValue = favoriteReports.includes(b.id) ? 1 : 0
          break
        default:
          aValue = a.displayName || a.name || ''
          bValue = b.displayName || b.name || ''
      }

      if (sortOrder === 'desc') {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      }
    })

    return filtered
  }, [reportsData?.reports, searchTerm, selectedCategory, sortBy, sortOrder, favoriteReports])

  // Get report categories
  const reportCategories = useMemo(() => {
    const categories = [
      { id: 'all', name: 'Todos los reportes', count: reportsData?.reports?.length || 0 },
      { id: 'favorites', name: 'Favoritos', count: favoriteReports.length },
      { id: 'recent', name: 'Recientes', count: 0 } // Could be calculated from localStorage
    ]

    return categories
  }, [reportsData?.reports, favoriteReports])

  // Handle search with URL sync
  const handleSearch = (value) => {
    setSearchTerm(value)
    if (value) {
      searchParams.set('search', value)
    } else {
      searchParams.delete('search')
    }
    setSearchParams(searchParams)
  }

  // Handle category change
  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    if (category !== 'all') {
      searchParams.set('category', category)
    } else {
      searchParams.delete('category')
    }
    setSearchParams(searchParams)
  }

  // Handle layout change
  const handleLayoutChange = (layout) => {
    setSelectedLayout(layout)
    localStorage.setItem(STORAGE_KEYS.LAYOUT_PREFERENCES, layout)
  }

  // Handle sorting
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  // Toggle favorite report
  const toggleFavorite = (reportId) => {
    const newFavorites = favoriteReports.includes(reportId)
      ? favoriteReports.filter(id => id !== reportId)
      : [...favoriteReports, reportId]
    
    setFavoriteReports(newFavorites)
    localStorage.setItem(`${STORAGE_KEYS.REPORT_SETTINGS}_favorites`, JSON.stringify(newFavorites))
    
    toast.success(
      favoriteReports.includes(reportId) 
        ? 'Reporte removido de favoritos' 
        : 'Reporte añadido a favoritos'
    )
  }

  // Handle refresh all
  const handleRefreshAll = () => {
    clearTokenCache()
    refetchReports()
    queryClient.invalidateQueries([QUERY_KEYS.POWERBI_WORKSPACE])
    toast.success('Reportes actualizados')
  }

  // Handle report selection
  const handleReportSelect = (reportId) => {
    setSelectedReportId(reportId)
    if (reportId) {
      searchParams.set('reportId', reportId)
    } else {
      searchParams.delete('reportId')
    }
    setSearchParams(searchParams)

    // Track recent access
    const recentIds = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.REPORT_SETTINGS}_recent`) || '[]')
    const updatedRecent = [reportId, ...recentIds.filter(id => id !== reportId)].slice(0, 10)
    localStorage.setItem(`${STORAGE_KEYS.REPORT_SETTINGS}_recent`, JSON.stringify(updatedRecent))
  }

  // Access control check
  if (!canViewReports()) {
    return (
      <div className="reports-page unauthorized">
        <Helmet>
          <title>Acceso Denegado | Microsoft Fabric Embedded</title>
        </Helmet>
        <div className="unauthorized-content">
          <EyeOff className="h-16 w-16 text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">Acceso Denegado</h2>
          <p className="text-gray-500">No tienes permisos para ver los reportes.</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Helmet>
        <title>Reportes | Microsoft Fabric Embedded</title>
        <meta name="description" content="Explora y visualiza reportes de Microsoft Fabric" />
      </Helmet>

      <div className="reports-page">
        {/* Header */}
        <div className="reports-header">
          <div className="header-content">
            <div className="title-section">
              <h1 className="page-title">
                <BarChart3 className="h-8 w-8 mr-3" />
                Reportes de PowerBI
              </h1>
              {workspaceData && (
                <p className="page-subtitle">
                  {workspaceData.workspace_name} • {processedReports.length} reporte{processedReports.length !== 1 ? 's' : ''} 
                  {searchTerm && ` • Filtrado por "${searchTerm}"`}
                </p>
              )}
            </div>

            <div className="header-actions">
              <button
                onClick={handleRefreshAll}
                disabled={reportsLoading}
                className="refresh-btn"
                title="Actualizar reportes"
              >
                <RefreshCw className={`h-4 w-4 ${reportsLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>

              {isAdmin && (
                <button className="settings-btn" title="Configuración">
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="controls-bar">
          <div className="controls-left">
            {/* Search */}
            <div className="search-container">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Buscar reportes..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Category Filter */}
            <div className="category-filter">
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="category-select"
              >
                {reportCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`filters-toggle ${showFilters ? 'active' : ''}`}
              title="Filtros avanzados"
            >
              <Filter className="h-4 w-4" />
              Filtros
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className="controls-right">
            {/* Sort Options */}
            <div className="sort-container">
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value)}
                className="sort-select"
              >
                <option value="name">Nombre</option>
                <option value="created">Fecha de creación</option>
                <option value="modified">Última modificación</option>
                <option value="favorite">Favoritos</option>
              </select>
              
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="sort-order-btn"
                title={`Ordenar ${sortOrder === 'asc' ? 'descendente' : 'ascendente'}`}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </button>
            </div>

            {/* Layout Toggle */}
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
              </button>
              <button
                onClick={() => handleLayoutChange('single')}
                className={`layout-btn ${selectedLayout === 'single' ? 'active' : ''}`}
                title="Vista individual"
              >
                <Eye className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="advanced-filters">
            <div className="filters-content">
              <div className="filter-group">
                <label className="filter-label">Período:</label>
                <select className="filter-select">
                  <option value="all">Todos los períodos</option>
                  <option value="today">Hoy</option>
                  <option value="week">Esta semana</option>
                  <option value="month">Este mes</option>
                  <option value="quarter">Este trimestre</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Estado:</label>
                <select className="filter-select">
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="draft">Borradores</option>
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Autor:</label>
                <select className="filter-select">
                  <option value="all">Todos los autores</option>
                  <option value="me">Mis reportes</option>
                </select>
              </div>

              <button
                onClick={() => {
                  setSearchTerm('')
                  setSelectedCategory('all')
                  setSortBy('name')
                  setSortOrder('asc')
                  setSearchParams({})
                }}
                className="clear-filters-btn"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="reports-content">
          {reportsLoading || workspaceLoading ? (
            <div className="loading-container">
              <LoadingSpinner size="lg" text="Cargando reportes..." />
            </div>
          ) : reportsError ? (
            <div className="error-container">
              <BarChart3 className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-red-600 mb-2">Error al cargar reportes</h3>
              <p className="text-red-500 mb-4">No se pudieron cargar los reportes disponibles</p>
              <button onClick={refetchReports} className="btn btn-error">
                Reintentar
              </button>
            </div>
          ) : processedReports.length === 0 ? (
            <div className="empty-container">
              <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'No se encontraron reportes' 
                  : 'No hay reportes disponibles'
                }
              </h3>
              <p className="text-gray-500 mb-4">
                {searchTerm 
                  ? `No hay reportes que coincidan con "${searchTerm}"`
                  : 'No tienes acceso a ningún reporte en este momento'
                }
              </p>
              {(searchTerm || selectedCategory !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setSelectedCategory('all')
                    setSearchParams({})
                  }}
                  className="btn btn-primary"
                >
                  Ver todos los reportes
                </button>
              )}
            </div>
          ) : selectedLayout === 'single' && selectedReportId ? (
            // Single report view
            <div className="single-report-view">
              <div className="single-report-header">
                <button
                  onClick={() => handleReportSelect(null)}
                  className="back-btn"
                >
                  ← Volver a la lista
                </button>
                
                <div className="report-actions">
                  {canExportReports && (
                    <button className="action-btn">
                      <Download className="h-4 w-4" />
                      Exportar
                    </button>
                  )}
                  
                  <button 
                    onClick={() => toggleFavorite(selectedReportId)}
                    className="action-btn"
                  >
                    {favoriteReports.includes(selectedReportId) ? (
                      <Star className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <PowerBIEmbed
                reportId={selectedReportId}
                title={processedReports.find(r => r.id === selectedReportId)?.displayName || 'Reporte'}
                height="calc(100vh - 200px)"
                showToolbar={true}
                allowExport={canExportReports}
                allowFullscreen={true}
                className="single-report-embed"
              />
            </div>
          ) : (
            // Grid/List view with ReportContainer
            <ReportContainer
              layout={selectedLayout}
              showSearch={false}
              showFilters={false}
              showLayoutToggle={false}
              allowMultipleReports={selectedLayout !== 'single'}
              defaultHeight="500px"
              className="reports-container"
            />
          )}
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        .reports-page {
          padding: 24px;
          min-height: 100vh;
          background: #f8fafc;
        }

        .reports-page.unauthorized {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .unauthorized-content {
          text-align: center;
          max-width: 400px;
        }

        .reports-header {
          @apply bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
        }

        .title-section {
          flex: 1;
        }

        .page-title {
          @apply text-2xl font-bold text-gray-900 mb-2;
          display: flex;
          align-items: center;
        }

        .page-subtitle {
          @apply text-gray-600;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .refresh-btn,
        .settings-btn {
          @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .settings-btn {
          @apply bg-gray-600 hover:bg-gray-700;
        }

        .controls-bar {
          @apply bg-white rounded-lg border border-gray-200 p-4 mb-6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .controls-left,
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
          width: 280px;
          transition: border-color 0.2s;
        }

        .search-input:focus {
          @apply outline-none border-blue-500 ring-1 ring-blue-500;
        }

        .category-select,
        .sort-select,
        .filter-select {
          @apply px-3 py-2 border border-gray-300 rounded-lg text-sm;
          background: white;
        }

        .filters-toggle {
          @apply px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
        }

        .filters-toggle.active {
          @apply bg-blue-50 border-blue-300 text-blue-700;
        }

        .sort-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sort-order-btn {
          @apply p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors;
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

        .advanced-filters {
          @apply bg-white rounded-lg border border-gray-200 p-4 mb-6;
        }

        .filters-content {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-label {
          @apply text-sm font-medium text-gray-700;
          white-space: nowrap;
        }

        .clear-filters-btn {
          @apply px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors;
        }

        .reports-content {
          min-height: 600px;
        }

        .loading-container,
        .error-container,
        .empty-container {
          @apply bg-white rounded-lg border border-gray-200 p-12 text-center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 500px;
        }

        .single-report-view {
          @apply bg-white rounded-lg border border-gray-200;
          overflow: hidden;
        }

        .single-report-header {
          @apply p-4 border-b border-gray-200 bg-gray-50;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .back-btn {
          @apply px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors;
        }

        .report-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          @apply px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .single-report-embed {
          border: none;
          border-radius: 0;
        }

        @media (max-width: 1024px) {
          .controls-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .controls-left,
          .controls-right {
            justify-content: space-between;
          }
        }

        @media (max-width: 768px) {
          .reports-page {
            padding: 16px;
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input {
            width: 100%;
          }

          .filters-content {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-group {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </ErrorBoundary>
  )
}

export default Reports