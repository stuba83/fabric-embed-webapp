import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { 
  BarChart3, 
  Users, 
  Activity, 
  TrendingUp, 
  Calendar,
  Clock,
  Eye,
  Download,
  RefreshCw,
  Bell,
  Settings
} from 'lucide-react'

import ReportContainer from '@/components/powerbi/ReportContainer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { getAvailableReports, getWorkspaceInfo } from '@/services/powerbiService'
import { QUERY_KEYS, ROUTES } from '@/utils/constants'

/**
 * Dashboard Page Component
 * Main landing page showing overview metrics and primary reports
 */
const Dashboard = () => {
  // State
  const [selectedMetric, setSelectedMetric] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Auth and permissions
  const { user, userRoles } = useAuth()
  const { 
    isAdmin, 
    canViewReports, 
    canViewAnalytics, 
    canExportReports,
    getNavigationConfig 
  } = useUserPermissions()

  // Fetch dashboard data
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
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  // Calculate dashboard metrics
  const dashboardMetrics = React.useMemo(() => {
    const baseMetrics = [
      {
        id: 'reports',
        title: 'Reportes Disponibles',
        value: reportsData?.reports?.length || 0,
        change: '+2.1%',
        trend: 'up',
        icon: BarChart3,
        color: 'blue',
        description: 'Total de reportes accesibles'
      },
      {
        id: 'access',
        title: 'Nivel de Acceso',
        value: userRoles.join(', ') || 'Usuario',
        change: null,
        trend: null,
        icon: Users,
        color: 'green',
        description: 'Roles asignados al usuario'
      }
    ]

    if (isAdmin) {
      baseMetrics.push(
        {
          id: 'workspace',
          title: 'Workspace Activo',
          value: workspaceData?.workspace_name || 'Fabric Workspace',
          change: 'Conectado',
          trend: 'up',
          icon: Activity,
          color: 'purple',
          description: 'Microsoft Fabric workspace'
        },
        {
          id: 'capacity',
          title: 'Capacidad',
          value: 'F8',
          change: 'Activa',
          trend: 'up',
          icon: TrendingUp,
          color: 'orange',
          description: 'Microsoft Fabric Capacity'
        }
      )
    }

    return baseMetrics
  }, [reportsData, workspaceData, userRoles, isAdmin])

  // Get primary reports for dashboard
  const primaryReports = React.useMemo(() => {
    if (!reportsData?.reports) return []
    
    // Filter primary reports (could be marked as featured or by naming convention)
    return reportsData.reports.filter(report => 
      report.displayName?.toLowerCase().includes('dashboard') ||
      report.displayName?.toLowerCase().includes('overview') ||
      report.displayName?.toLowerCase().includes('principal')
    ).slice(0, 2) // Show max 2 reports on dashboard
  }, [reportsData?.reports])

  // Handle refresh
  const handleRefresh = () => {
    refetchReports()
    setLastRefresh(new Date())
  }

  // Get welcome message based on time of day
  const getWelcomeMessage = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  // Get current time string
  const getCurrentTimeString = () => {
    return new Date().toLocaleString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <ErrorBoundary>
      <Helmet>
        <title>Dashboard | Microsoft Fabric Embedded</title>
        <meta name="description" content="Dashboard principal con reportes y métricas de Microsoft Fabric" />
      </Helmet>

      <div className="dashboard-page">
        {/* Header Section */}
        <div className="dashboard-header">
          <div className="header-content">
            <div className="welcome-section">
              <h1 className="welcome-title">
                {getWelcomeMessage()}, {user?.name?.split(' ')[0] || 'Usuario'}
              </h1>
              <p className="welcome-subtitle">
                {getCurrentTimeString()}
              </p>
            </div>

            <div className="header-actions">
              <div className="last-refresh">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">
                  Actualizado: {lastRefresh.toLocaleTimeString('es-ES')}
                </span>
              </div>
              
              <button
                onClick={handleRefresh}
                disabled={reportsLoading}
                className="refresh-btn"
                title="Actualizar datos"
              >
                <RefreshCw className={`h-4 w-4 ${reportsLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="metrics-section">
          <div className="metrics-grid">
            {dashboardMetrics.map((metric) => {
              const IconComponent = metric.icon
              const isSelected = selectedMetric === metric.id

              return (
                <div
                  key={metric.id}
                  className={`metric-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedMetric(isSelected ? null : metric.id)}
                >
                  <div className="metric-header">
                    <div className={`metric-icon ${metric.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    {metric.change && (
                      <div className={`metric-change ${metric.trend}`}>
                        {metric.change}
                      </div>
                    )}
                  </div>

                  <div className="metric-content">
                    <h3 className="metric-title">{metric.title}</h3>
                    <p className="metric-value">{metric.value}</p>
                    <p className="metric-description">{metric.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quick Actions */}
        {(canViewAnalytics || canExportReports || isAdmin) && (
          <div className="quick-actions-section">
            <h2 className="section-title">Acciones Rápidas</h2>
            <div className="actions-grid">
              {canViewAnalytics && (
                <div className="action-card">
                  <Eye className="h-8 w-8 text-blue-600 mb-3" />
                  <h3 className="action-title">Ver Reportes</h3>
                  <p className="action-description">
                    Accede a todos los reportes disponibles
                  </p>
                  <a href={ROUTES.REPORTS} className="action-link">
                    Ver todos →
                  </a>
                </div>
              )}

              {canExportReports && (
                <div className="action-card">
                  <Download className="h-8 w-8 text-green-600 mb-3" />
                  <h3 className="action-title">Exportar Datos</h3>
                  <p className="action-description">
                    Exporta reportes en diferentes formatos
                  </p>
                  <button className="action-link">
                    Exportar →
                  </button>
                </div>
              )}

              {isAdmin && (
                <div className="action-card">
                  <Settings className="h-8 w-8 text-purple-600 mb-3" />
                  <h3 className="action-title">Administración</h3>
                  <p className="action-description">
                    Gestiona usuarios y configuraciones
                  </p>
                  <a href={ROUTES.ADMIN} className="action-link">
                    Administrar →
                  </a>
                </div>
              )}

              <div className="action-card">
                <Bell className="h-8 w-8 text-orange-600 mb-3" />
                <h3 className="action-title">Notificaciones</h3>
                <p className="action-description">
                  Configura alertas y notificaciones
                </p>
                <button className="action-link">
                  Configurar →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Primary Reports Section */}
        {canViewReports() && (
          <div className="reports-section">
            <div className="section-header">
              <h2 className="section-title">Reportes Principales</h2>
              <a href={ROUTES.REPORTS} className="view-all-link">
                Ver todos los reportes →
              </a>
            </div>

            {reportsLoading || workspaceLoading ? (
              <div className="loading-container">
                <LoadingSpinner size="lg" text="Cargando reportes..." />
              </div>
            ) : reportsError ? (
              <div className="error-container">
                <p className="error-message">Error al cargar los reportes</p>
                <button onClick={refetchReports} className="retry-btn">
                  Reintentar
                </button>
              </div>
            ) : primaryReports.length > 0 ? (
              <ReportContainer
                layout="grid"
                showSearch={false}
                showFilters={false}
                showLayoutToggle={false}
                allowMultipleReports={true}
                defaultHeight="500px"
                className="dashboard-reports"
              />
            ) : (
              <div className="no-reports">
                <BarChart3 className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  No hay reportes principales configurados
                </h3>
                <p className="text-gray-500 mb-4">
                  Los reportes aparecerán aquí una vez que estén disponibles
                </p>
                <a href={ROUTES.REPORTS} className="btn btn-primary">
                  Explorar Reportes
                </a>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity or Help Section */}
        <div className="bottom-section">
          <div className="info-cards">
            <div className="info-card">
              <h3 className="info-title">
                <Calendar className="h-5 w-5 mr-2" />
                Acceso Reciente
              </h3>
              <div className="info-content">
                <p className="text-sm text-gray-600">
                  Último acceso: {new Date().toLocaleDateString('es-ES')}
                </p>
                <p className="text-sm text-gray-600">
                  Rol activo: {userRoles.join(', ') || 'Usuario'}
                </p>
              </div>
            </div>

            <div className="info-card">
              <h3 className="info-title">
                <Activity className="h-5 w-5 mr-2" />
                Estado del Sistema
              </h3>
              <div className="info-content">
                <div className="status-indicator">
                  <div className="status-dot green"></div>
                  <span className="text-sm text-gray-600">Microsoft Fabric: Operativo</span>
                </div>
                <div className="status-indicator">
                  <div className="status-dot green"></div>
                  <span className="text-sm text-gray-600">API: Funcional</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        .dashboard-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .dashboard-header {
          @apply bg-white rounded-lg border border-gray-200 p-6 mb-8 shadow-sm;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
        }

        .welcome-title {
          @apply text-3xl font-bold text-gray-900 mb-2;
        }

        .welcome-subtitle {
          @apply text-gray-600;
          margin: 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .last-refresh {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .refresh-btn {
          @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .refresh-btn:disabled {
          @apply bg-gray-400 cursor-not-allowed;
        }

        .metrics-section {
          margin-bottom: 32px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
        }

        .metric-card {
          @apply bg-white border border-gray-200 rounded-lg p-6 cursor-pointer transition-all duration-200;
        }

        .metric-card:hover {
          @apply border-blue-300 shadow-md;
          transform: translateY(-2px);
        }

        .metric-card.selected {
          @apply border-blue-500 shadow-lg;
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .metric-icon {
          @apply p-3 rounded-lg;
        }

        .metric-icon.blue {
          @apply bg-blue-100 text-blue-600;
        }

        .metric-icon.green {
          @apply bg-green-100 text-green-600;
        }

        .metric-icon.purple {
          @apply bg-purple-100 text-purple-600;
        }

        .metric-icon.orange {
          @apply bg-orange-100 text-orange-600;
        }

        .metric-change {
          @apply px-2 py-1 rounded-full text-xs font-medium;
        }

        .metric-change.up {
          @apply bg-green-100 text-green-700;
        }

        .metric-title {
          @apply text-sm font-medium text-gray-600 mb-1;
        }

        .metric-value {
          @apply text-2xl font-bold text-gray-900 mb-2;
        }

        .metric-description {
          @apply text-sm text-gray-500;
          margin: 0;
        }

        .quick-actions-section,
        .reports-section {
          margin-bottom: 32px;
        }

        .section-title {
          @apply text-xl font-semibold text-gray-900 mb-6;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .view-all-link {
          @apply text-blue-600 hover:text-blue-700 font-medium;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
        }

        .action-card {
          @apply bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow;
        }

        .action-title {
          @apply text-lg font-semibold text-gray-900 mb-2;
        }

        .action-description {
          @apply text-gray-600 mb-4;
          margin: 0;
        }

        .action-link {
          @apply text-blue-600 hover:text-blue-700 font-medium;
          text-decoration: none;
        }

        .loading-container,
        .error-container,
        .no-reports {
          @apply bg-white border border-gray-200 rounded-lg p-12 text-center;
        }

        .error-message {
          @apply text-red-600 mb-4;
        }

        .retry-btn {
          @apply px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors;
        }

        .bottom-section {
          margin-top: 48px;
        }

        .info-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .info-card {
          @apply bg-white border border-gray-200 rounded-lg p-6;
        }

        .info-title {
          @apply text-lg font-semibold text-gray-900 mb-4;
          display: flex;
          align-items: center;
        }

        .info-content {
          space-y: 8px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.green {
          @apply bg-green-500;
        }

        @media (max-width: 768px) {
          .dashboard-page {
            padding: 16px;
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </ErrorBoundary>
  )
}

export default Dashboard