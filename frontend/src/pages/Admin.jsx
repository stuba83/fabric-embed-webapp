import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Helmet } from 'react-helmet-async'
import { toast } from 'sonner'
import { 
  Settings, 
  Users, 
  BarChart3, 
  Database, 
  Shield, 
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Upload,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Key,
  Globe,
  Zap,
  Monitor
} from 'lucide-react'

import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { apiClient } from '@/services/apiClient'
import { clearTokenCache } from '@/services/powerbiService'
import { QUERY_KEYS, USER_ROLES } from '@/utils/constants'

/**
 * Admin Page Component
 * Administrative interface for system management, user administration, and monitoring
 */
const Admin = () => {
  // State
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  // Auth and permissions
  const { user } = useAuth()
  const { isAdmin, canManageUsers, canAccessAdmin } = useUserPermissions()

  // Query client
  const queryClient = useQueryClient()

  // Fetch admin data
  const {
    data: systemHealth,
    isLoading: healthLoading,
    refetch: refetchHealth
  } = useQuery({
    queryKey: [QUERY_KEYS.SYSTEM_HEALTH],
    queryFn: () => apiClient.get('/api/admin/health').then(res => res.data),
    enabled: !!user && isAdmin,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000
  })

  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers
  } = useQuery({
    queryKey: [QUERY_KEYS.ADMIN_USERS],
    queryFn: () => apiClient.get('/api/admin/users').then(res => res.data),
    enabled: !!user && canManageUsers,
    staleTime: 5 * 60 * 1000
  })

  const {
    data: reportsData,
    isLoading: reportsLoading
  } = useQuery({
    queryKey: [`${QUERY_KEYS.POWERBI_REPORTS}_admin`],
    queryFn: () => apiClient.get('/api/admin/reports').then(res => res.data),
    enabled: !!user && isAdmin,
    staleTime: 5 * 60 * 1000
  })

  // Mutations
  const updateUserMutation = useMutation({
    mutationFn: (userData) => apiClient.put(`/api/admin/users/${userData.id}`, userData),
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.ADMIN_USERS])
      toast.success('Usuario actualizado correctamente')
      setShowUserModal(false)
      setEditingUser(null)
    },
    onError: (error) => {
      toast.error('Error al actualizar usuario: ' + error.message)
    }
  })

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => apiClient.delete(`/api/admin/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries([QUERY_KEYS.ADMIN_USERS])
      toast.success('Usuario eliminado correctamente')
    },
    onError: (error) => {
      toast.error('Error al eliminar usuario: ' + error.message)
    }
  })

  const clearCacheMutation = useMutation({
    mutationFn: () => apiClient.post('/api/admin/clear-cache'),
    onSuccess: () => {
      clearTokenCache()
      toast.success('Cache limpiado correctamente')
      refetchHealth()
    },
    onError: (error) => {
      toast.error('Error al limpiar cache: ' + error.message)
    }
  })

  // Access control
  if (!canAccessAdmin) {
    return (
      <div className="admin-page unauthorized">
        <Helmet>
          <title>Acceso Denegado | Microsoft Fabric Embedded</title>
        </Helmet>
        <div className="unauthorized-content">
          <Shield className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-red-600 mb-2">Acceso Denegado</h2>
          <p className="text-red-500">No tienes permisos de administrador.</p>
        </div>
      </div>
    )
  }

  // Filter users based on search
  const filteredUsers = React.useMemo(() => {
    if (!usersData?.users) return []
    
    if (!searchTerm) return usersData.users
    
    const term = searchTerm.toLowerCase()
    return usersData.users.filter(user =>
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.roles?.some(role => role.toLowerCase().includes(term))
    )
  }, [usersData?.users, searchTerm])

  // Calculate overview metrics
  const overviewMetrics = React.useMemo(() => {
    return [
      {
        id: 'users',
        title: 'Usuarios Totales',
        value: usersData?.users?.length || 0,
        change: '+5.2%',
        trend: 'up',
        icon: Users,
        color: 'blue'
      },
      {
        id: 'reports',
        title: 'Reportes Activos',
        value: reportsData?.reports?.length || 0,
        change: '+2.1%',
        trend: 'up',
        icon: BarChart3,
        color: 'green'
      },
      {
        id: 'capacity',
        title: 'Uso de Capacidad',
        value: systemHealth?.fabric_capacity?.usage_percentage || 0,
        suffix: '%',
        change: systemHealth?.fabric_capacity?.status === 'healthy' ? 'Saludable' : 'Atención',
        trend: systemHealth?.fabric_capacity?.status === 'healthy' ? 'up' : 'down',
        icon: Database,
        color: 'purple'
      },
      {
        id: 'sessions',
        title: 'Sesiones Activas',
        value: systemHealth?.active_sessions || 0,
        change: 'Tiempo real',
        trend: 'neutral',
        icon: Activity,
        color: 'orange'
      }
    ]
  }, [usersData, reportsData, systemHealth])

  // Handle user actions
  const handleEditUser = (user) => {
    setEditingUser(user)
    setShowUserModal(true)
  }

  const handleDeleteUser = (userId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      deleteUserMutation.mutate(userId)
    }
  }

  const handleClearCache = () => {
    if (window.confirm('¿Estás seguro de que quieres limpiar el cache? Esto puede afectar el rendimiento temporalmente.')) {
      clearCacheMutation.mutate()
    }
  }

  // Get system status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return CheckCircle
      case 'warning': return AlertTriangle
      case 'error': return XCircle
      default: return Clock
    }
  }

  const tabs = [
    { id: 'overview', name: 'Resumen', icon: Monitor },
    { id: 'users', name: 'Usuarios', icon: Users, disabled: !canManageUsers },
    { id: 'reports', name: 'Reportes', icon: BarChart3 },
    { id: 'system', name: 'Sistema', icon: Settings },
    { id: 'security', name: 'Seguridad', icon: Shield }
  ].filter(tab => !tab.disabled)

  return (
    <ErrorBoundary>
      <Helmet>
        <title>Administración | Microsoft Fabric Embedded</title>
        <meta name="description" content="Panel de administración del sistema Microsoft Fabric Embedded" />
      </Helmet>

      <div className="admin-page">
        {/* Header */}
        <div className="admin-header">
          <div className="header-content">
            <div className="title-section">
              <h1 className="page-title">
                <Settings className="h-8 w-8 mr-3" />
                Panel de Administración
              </h1>
              <p className="page-subtitle">
                Gestión y monitoreo del sistema Microsoft Fabric Embedded
              </p>
            </div>

            <div className="header-actions">
              <button
                onClick={() => {
                  refetchHealth()
                  refetchUsers()
                }}
                disabled={healthLoading || usersLoading}
                className="refresh-btn"
              >
                <RefreshCw className={`h-4 w-4 ${healthLoading || usersLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          </div>
        </div>

        {/* System Status Bar */}
        {systemHealth && (
          <div className="status-bar">
            <div className="status-items">
              {Object.entries(systemHealth.services || {}).map(([service, status]) => {
                const StatusIcon = getStatusIcon(status.status)
                return (
                  <div key={service} className="status-item">
                    <StatusIcon className={`h-4 w-4 ${getStatusColor(status.status)}`} />
                    <span className="status-label">{service}</span>
                    <span className={`status-value ${getStatusColor(status.status)}`}>
                      {status.status}
                    </span>
                  </div>
                )
              })}
            </div>
            
            <div className="status-timestamp">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Actualizado: {new Date().toLocaleTimeString('es-ES')}
              </span>
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="tabs-navigation">
          {tabs.map(tab => {
            const TabIcon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                <TabIcon className="h-4 w-4" />
                {tab.name}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-tab">
              {/* Metrics Grid */}
              <div className="metrics-grid">
                {overviewMetrics.map(metric => {
                  const IconComponent = metric.icon
                  return (
                    <div key={metric.id} className="metric-card">
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
                        <p className="metric-value">
                          {metric.value}{metric.suffix || ''}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Quick Actions */}
              <div className="quick-actions">
                <h3 className="section-title">Acciones Rápidas</h3>
                <div className="actions-grid">
                  <button 
                    onClick={handleClearCache}
                    disabled={clearCacheMutation.isLoading}
                    className="action-card"
                  >
                    <Zap className="h-8 w-8 text-yellow-600 mb-3" />
                    <h4 className="action-title">Limpiar Cache</h4>
                    <p className="action-description">Optimizar rendimiento del sistema</p>
                  </button>

                  <button className="action-card">
                    <Download className="h-8 w-8 text-blue-600 mb-3" />
                    <h4 className="action-title">Exportar Logs</h4>
                    <p className="action-description">Descargar registros del sistema</p>
                  </button>

                  <button className="action-card">
                    <Globe className="h-8 w-8 text-green-600 mb-3" />
                    <h4 className="action-title">Configurar API</h4>
                    <p className="action-description">Gestionar configuraciones de API</p>
                  </button>

                  <button className="action-card">
                    <Key className="h-8 w-8 text-purple-600 mb-3" />
                    <h4 className="action-title">Rotar Claves</h4>
                    <p className="action-description">Actualizar claves de seguridad</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && canManageUsers && (
            <div className="users-tab">
              {/* Users Controls */}
              <div className="users-controls">
                <div className="controls-left">
                  <div className="search-container">
                    <Search className="search-icon" />
                    <input
                      type="text"
                      placeholder="Buscar usuarios..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                <div className="controls-right">
                  <button 
                    onClick={() => setShowUserModal(true)}
                    className="add-user-btn"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Usuario
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="users-table-container">
                {usersLoading ? (
                  <div className="loading-container">
                    <LoadingSpinner size="lg" text="Cargando usuarios..." />
                  </div>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Email</th>
                        <th>Roles</th>
                        <th>Último Acceso</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(user => (
                        <tr key={user.id}>
                          <td>
                            <div className="user-info">
                              <div className="user-avatar">
                                {user.name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="user-details">
                                <div className="user-name">{user.name}</div>
                                <div className="user-id">ID: {user.id}</div>
                              </div>
                            </div>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            <div className="user-roles">
                              {user.roles?.map(role => (
                                <span key={role} className={`role-badge ${role.toLowerCase()}`}>
                                  {role}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            {user.lastAccess ? new Date(user.lastAccess).toLocaleDateString('es-ES') : 'Nunca'}
                          </td>
                          <td>
                            <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                              {user.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <div className="user-actions">
                              <button 
                                onClick={() => handleEditUser(user)}
                                className="action-btn edit"
                                title="Editar usuario"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteUser(user.id)}
                                className="action-btn delete"
                                title="Eliminar usuario"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button className="action-btn more" title="Más opciones">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="reports-tab">
              <div className="reports-overview">
                <h3 className="section-title">Gestión de Reportes</h3>
                {reportsLoading ? (
                  <LoadingSpinner size="md" text="Cargando reportes..." />
                ) : (
                  <div className="reports-grid">
                    {reportsData?.reports?.map(report => (
                      <div key={report.id} className="report-card">
                        <div className="report-header">
                          <BarChart3 className="h-6 w-6 text-blue-600" />
                          <div className="report-actions">
                            <button className="action-btn">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="action-btn">
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="report-content">
                          <h4 className="report-title">{report.displayName || report.name}</h4>
                          <p className="report-description">
                            {report.description || 'Sin descripción'}
                          </p>
                          <div className="report-meta">
                            <span className="report-access">
                              Accesos: {report.accessCount || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="system-tab">
              <h3 className="section-title">Configuración del Sistema</h3>
              
              <div className="system-sections">
                <div className="system-section">
                  <h4 className="subsection-title">Microsoft Fabric</h4>
                  <div className="system-info">
                    <div className="info-item">
                      <span className="info-label">Workspace ID:</span>
                      <span className="info-value">
                        {systemHealth?.fabric_workspace?.id || 'No configurado'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Capacidad:</span>
                      <span className="info-value">
                        {systemHealth?.fabric_capacity?.sku || 'F8'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Estado:</span>
                      <span className={`info-value ${getStatusColor(systemHealth?.fabric_capacity?.status)}`}>
                        {systemHealth?.fabric_capacity?.status || 'Desconocido'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="system-section">
                  <h4 className="subsection-title">Base de Datos</h4>
                  <div className="system-info">
                    <div className="info-item">
                      <span className="info-label">Conexiones Activas:</span>
                      <span className="info-value">
                        {systemHealth?.database?.active_connections || 0}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Estado:</span>
                      <span className={`info-value ${getStatusColor(systemHealth?.database?.status)}`}>
                        {systemHealth?.database?.status || 'Desconocido'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="security-tab">
              <h3 className="section-title">Configuración de Seguridad</h3>
              
              <div className="security-sections">
                <div className="security-section">
                  <h4 className="subsection-title">Autenticación</h4>
                  <div className="security-info">
                    <div className="info-item">
                      <span className="info-label">Proveedor:</span>
                      <span className="info-value">Microsoft Entra ID</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Tenant ID:</span>
                      <span className="info-value">***-***-***</span>
                    </div>
                  </div>
                </div>

                <div className="security-section">
                  <h4 className="subsection-title">Tokens</h4>
                  <div className="security-info">
                    <div className="info-item">
                      <span className="info-label">Tokens Activos:</span>
                      <span className="info-value">
                        {systemHealth?.tokens?.active_count || 0}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Tiempo de Vida:</span>
                      <span className="info-value">60 minutos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Modal */}
        {showUserModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">
                  {editingUser ? 'Editar Usuario' : 'Agregar Usuario'}
                </h3>
                <button 
                  onClick={() => {
                    setShowUserModal(false)
                    setEditingUser(null)
                  }}
                  className="modal-close"
                >
                  ×
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input 
                    type="text" 
                    className="form-input"
                    defaultValue={editingUser?.name || ''}
                    placeholder="Nombre del usuario"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input 
                    type="email" 
                    className="form-input"
                    defaultValue={editingUser?.email || ''}
                    placeholder="email@ejemplo.com"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Roles</label>
                  <div className="roles-selection">
                    {Object.values(USER_ROLES).map(role => (
                      <label key={role} className="role-checkbox">
                        <input 
                          type="checkbox" 
                          defaultChecked={editingUser?.roles?.includes(role)}
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="modal-footer">
                <button 
                  onClick={() => {
                    setShowUserModal(false)
                    setEditingUser(null)
                  }}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    // Handle save logic here
                    setShowUserModal(false)
                    setEditingUser(null)
                  }}
                  className="btn btn-primary"
                >
                  {editingUser ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Styles */}
      <style jsx>{`
        .admin-page {
          padding: 24px;
          min-height: 100vh;
          background: #f8fafc;
        }

        .admin-page.unauthorized {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .unauthorized-content {
          text-align: center;
          max-width: 400px;
        }

        .admin-header {
          @apply bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 16px;
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

        .refresh-btn {
          @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-bar {
          @apply bg-white rounded-lg border border-gray-200 p-4 mb-6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }

        .status-items {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-label {
          @apply text-sm font-medium text-gray-700;
          text-transform: capitalize;
        }

        .status-value {
          @apply text-sm font-semibold;
          text-transform: capitalize;
        }

        .status-timestamp {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tabs-navigation {
          @apply bg-white rounded-lg border border-gray-200 p-2 mb-6;
          display: flex;
          gap: 4px;
        }

        .tab-btn {
          @apply px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 500;
        }

        .tab-btn.active {
          @apply bg-blue-100 text-blue-700;
        }

        .tab-content {
          min-height: 600px;
        }

        .overview-tab {
          space-y: 32px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .metric-card {
          @apply bg-white border border-gray-200 rounded-lg p-6;
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

        .metric-icon.blue { @apply bg-blue-100 text-blue-600; }
        .metric-icon.green { @apply bg-green-100 text-green-600; }
        .metric-icon.purple { @apply bg-purple-100 text-purple-600; }
        .metric-icon.orange { @apply bg-orange-100 text-orange-600; }

        .metric-change {
          @apply px-2 py-1 rounded-full text-xs font-medium;
        }

        .metric-change.up { @apply bg-green-100 text-green-700; }
        .metric-change.down { @apply bg-red-100 text-red-700; }
        .metric-change.neutral { @apply bg-gray-100 text-gray-700; }

        .metric-title {
          @apply text-sm font-medium text-gray-600 mb-1;
        }

        .metric-value {
          @apply text-2xl font-bold text-gray-900;
        }

        .section-title {
          @apply text-xl font-semibold text-gray-900 mb-6;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
        }

        .action-card {
          @apply bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all;
          text-align: center;
        }

        .action-title {
          @apply text-lg font-semibold text-gray-900 mb-2;
        }

        .action-description {
          @apply text-gray-600;
        }

        .users-controls {
          @apply bg-white rounded-lg border border-gray-200 p-4 mb-6;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
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
          @apply pl-10 pr-4 py-2 border border-gray-300 rounded-lg;
          width: 300px;
        }

        .add-user-btn {
          @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .users-table-container {
          @apply bg-white rounded-lg border border-gray-200 overflow-hidden;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table th,
        .users-table td {
          @apply px-6 py-4 text-left border-b border-gray-200;
        }

        .users-table th {
          @apply bg-gray-50 font-semibold text-gray-700;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          @apply w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold;
        }

        .user-name {
          @apply font-medium text-gray-900;
        }

        .user-id {
          @apply text-sm text-gray-500;
        }

        .user-roles {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .role-badge {
          @apply px-2 py-1 rounded-full text-xs font-medium;
        }

        .role-badge.admin {
          @apply bg-red-100 text-red-700;
        }

        .role-badge.rola {
          @apply bg-blue-100 text-blue-700;
        }

        .role-badge.rolb {
          @apply bg-green-100 text-green-700;
        }

        .status-badge {
          @apply px-2 py-1 rounded-full text-xs font-medium;
        }

        .status-badge.active {
          @apply bg-green-100 text-green-700;
        }

        .status-badge.inactive {
          @apply bg-gray-100 text-gray-700;
        }

        .user-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          @apply p-2 rounded-lg transition-colors;
        }

        .action-btn.edit {
          @apply text-blue-600 hover:bg-blue-100;
        }

        .action-btn.delete {
          @apply text-red-600 hover:bg-red-100;
        }

        .action-btn.more {
          @apply text-gray-600 hover:bg-gray-100;
        }

        .reports-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .report-card {
          @apply bg-white border border-gray-200 rounded-lg p-6;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .report-actions {
          display: flex;
          gap: 8px;
        }

        .report-title {
          @apply text-lg font-semibold text-gray-900 mb-2;
        }

        .report-description {
          @apply text-gray-600 mb-4;
        }

        .report-meta {
          @apply text-sm text-gray-500;
        }

        .system-sections,
        .security-sections {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .system-section,
        .security-section {
          @apply bg-white border border-gray-200 rounded-lg p-6;
        }

        .subsection-title {
          @apply text-lg font-semibold text-gray-900 mb-4;
        }

        .system-info,
        .security-info {
          space-y: 12px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          @apply py-2 border-b border-gray-100;
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-label {
          @apply font-medium text-gray-700;
        }

        .info-value {
          @apply text-gray-900 font-mono text-sm;
        }

        .loading-container {
          @apply flex items-center justify-center py-12;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }

        .modal-content {
          @apply bg-white rounded-lg shadow-xl;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          @apply px-6 py-4 border-b border-gray-200;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title {
          @apply text-lg font-semibold text-gray-900;
        }

        .modal-close {
          @apply text-gray-400 hover:text-gray-600 text-2xl;
          background: none;
          border: none;
          cursor: pointer;
        }

        .modal-body {
          @apply px-6 py-4;
          space-y: 16px;
        }

        .modal-footer {
          @apply px-6 py-4 border-t border-gray-200;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          @apply font-medium text-gray-700;
        }

        .form-input {
          @apply px-3 py-2 border border-gray-300 rounded-lg;
        }

        .roles-selection {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .role-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          @apply text-gray-700;
        }

        .btn {
          @apply px-4 py-2 rounded-lg font-medium transition-colors;
        }

        .btn-primary {
          @apply bg-blue-600 text-white hover:bg-blue-700;
        }

        .btn-secondary {
          @apply bg-gray-200 text-gray-700 hover:bg-gray-300;
        }

        @media (max-width: 1024px) {
          .status-bar {
            flex-direction: column;
            align-items: stretch;
          }

          .status-items {
            justify-content: space-between;
          }

          .tabs-navigation {
            overflow-x: auto;
            flex-wrap: nowrap;
          }
        }

        @media (max-width: 768px) {
          .admin-page {
            padding: 16px;
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .users-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input {
            width: 100%;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .actions-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }

          .users-table-container {
            overflow-x: auto;
          }

          .modal-content {
            width: 95%;
            margin: 16px;
          }
        }
      `}</style>
    </ErrorBoundary>
  )
}

export default Admin