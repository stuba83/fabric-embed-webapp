import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  BarChart3, 
  FileText, 
  Settings, 
  Users, 
  Shield, 
  Activity,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Bookmark,
  Clock,
  Star,
  TrendingUp,
  Database,
  Globe,
  Zap,
  Bell,
  Eye
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { ROUTES, STORAGE_KEYS } from '@/utils/constants'

/**
 * Sidebar Component
 * Main navigation sidebar with collapsible sections and role-based menu items
 */
const Sidebar = ({ isOpen = true, onClose }) => {
  // State
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEYS.LAYOUT_PREFERENCES}_sidebar_sections`)
    return saved ? JSON.parse(saved) : ['main', 'reports']
  })
  const [recentItems, setRecentItems] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEYS.REPORT_SETTINGS}_recent`)
    return saved ? JSON.parse(saved).slice(0, 5) : []
  })
  const [favoriteItems, setFavoriteItems] = useState(() => {
    const saved = localStorage.getItem(`${STORAGE_KEYS.REPORT_SETTINGS}_favorites`)
    return saved ? JSON.parse(saved).slice(0, 5) : []
  })

  // Hooks
  const location = useLocation()
  const { user, userRoles } = useAuth()
  const { 
    isAdmin, 
    canAccessAdmin, 
    canViewReports, 
    canManageUsers,
    canViewAnalytics,
    getNavigationConfig 
  } = useUserPermissions()

  // Save expanded sections to localStorage
  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_KEYS.LAYOUT_PREFERENCES}_sidebar_sections`,
      JSON.stringify(expandedSections)
    )
  }, [expandedSections])

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => 
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  // Check if current path matches
  const isActiveRoute = (path) => location.pathname === path

  // Check if current path starts with given path (for sections)
  const isActivePath = (path) => location.pathname.startsWith(path)

  // Main navigation items
  const mainNavItems = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: ROUTES.DASHBOARD,
      icon: Home,
      description: 'Resumen general del sistema',
      show: true
    },
    {
      id: 'reports',
      name: 'Reportes',
      path: ROUTES.REPORTS,
      icon: BarChart3,
      description: 'Visualizar reportes de PowerBI',
      show: canViewReports(),
      badge: recentItems.length > 0 ? recentItems.length : null
    },
    {
      id: 'analytics',
      name: 'Analytics',
      path: '/analytics',
      icon: TrendingUp,
      description: 'Análisis avanzado de datos',
      show: canViewAnalytics,
      comingSoon: true
    }
  ]

  // Admin navigation items
  const adminNavItems = [
    {
      id: 'admin',
      name: 'Administración',
      path: ROUTES.ADMIN,
      icon: Settings,
      description: 'Panel de administración',
      show: canAccessAdmin
    },
    {
      id: 'users',
      name: 'Gestión de Usuarios',
      path: '/admin/users',
      icon: Users,
      description: 'Administrar usuarios del sistema',
      show: canManageUsers
    },
    {
      id: 'security',
      name: 'Seguridad',
      path: '/admin/security',
      icon: Shield,
      description: 'Configuración de seguridad',
      show: isAdmin
    },
    {
      id: 'system',
      name: 'Sistema',
      path: '/admin/system',
      icon: Database,
      description: 'Monitoreo del sistema',
      show: isAdmin
    }
  ]

  // Tools and utilities
  const toolsNavItems = [
    {
      id: 'fabric',
      name: 'Microsoft Fabric',
      path: 'https://app.fabric.microsoft.com',
      icon: Globe,
      description: 'Abrir Fabric Portal',
      external: true,
      show: true
    },
    {
      id: 'help',
      name: 'Ayuda y Soporte',
      path: '/help',
      icon: HelpCircle,
      description: 'Documentación y soporte',
      show: true
    },
    {
      id: 'activity',
      name: 'Registro de Actividad',
      path: '/activity',
      icon: Activity,
      description: 'Ver actividad del sistema',
      show: isAdmin
    }
  ]

  // Render navigation item
  const renderNavItem = (item, className = '') => {
    const IconComponent = item.icon
    const isActive = item.external ? false : isActiveRoute(item.path)
    const isPathActive = item.external ? false : isActivePath(item.path)

    if (!item.show) return null

    const itemProps = item.external
      ? { 
          href: item.path, 
          target: '_blank', 
          rel: 'noopener noreferrer',
          as: 'a'
        }
      : { to: item.path, as: Link }

    const Component = item.external ? 'a' : Link

    return (
      <Component
        key={item.id}
        {...(item.external ? { href: item.path, target: '_blank', rel: 'noopener noreferrer' } : { to: item.path })}
        className={`nav-item ${isActive ? 'active' : ''} ${isPathActive ? 'path-active' : ''} ${className}`}
        onClick={onClose}
        title={item.description}
      >
        <div className="nav-item-content">
          <div className="nav-icon">
            <IconComponent className="h-5 w-5" />
          </div>
          <div className="nav-text">
            <span className="nav-name">{item.name}</span>
            {item.description && (
              <span className="nav-description">{item.description}</span>
            )}
          </div>
        </div>
        
        <div className="nav-badges">
          {item.badge && (
            <span className="nav-badge">{item.badge}</span>
          )}
          {item.comingSoon && (
            <span className="coming-soon-badge">Próximamente</span>
          )}
          {item.external && (
            <span className="external-badge">↗</span>
          )}
        </div>
      </Component>
    )
  }

  // Render collapsible section
  const renderSection = (sectionId, title, items, icon = null) => {
    const isExpanded = expandedSections.includes(sectionId)
    const hasVisibleItems = items.some(item => item.show)
    
    if (!hasVisibleItems) return null

    const IconComponent = icon

    return (
      <div key={sectionId} className="nav-section">
        <button
          onClick={() => toggleSection(sectionId)}
          className="section-header"
        >
          <div className="section-title">
            {IconComponent && <IconComponent className="h-4 w-4" />}
            <span>{title}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {isExpanded && (
          <div className="section-content">
            {items.map(item => renderNavItem(item, 'section-item'))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={onClose}></div>
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-content">
          {/* User Info Section */}
          <div className="user-section">
            <div className="user-info">
              <div className="user-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <div className="user-name">{user?.name || 'Usuario'}</div>
                <div className="user-roles">
                  {userRoles.map(role => (
                    <span key={role} className="role-badge">{role}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav">
            {/* Main Navigation */}
            <div className="nav-group">
              <div className="nav-group-title">Navegación Principal</div>
              {mainNavItems.map(item => renderNavItem(item))}
            </div>

            {/* Quick Access - Recent Items */}
            {recentItems.length > 0 && (
              <div className="nav-group">
                <div className="nav-group-title">
                  <Clock className="h-4 w-4" />
                  Recientes
                </div>
                <div className="quick-access-items">
                  {recentItems.slice(0, 3).map(itemId => (
                    <Link
                      key={itemId}
                      to={`${ROUTES.REPORTS}?reportId=${itemId}`}
                      className="quick-access-item"
                      onClick={onClose}
                    >
                      <Eye className="h-4 w-4" />
                      <span>Reporte {itemId.slice(0, 8)}...</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Access - Favorites */}
            {favoriteItems.length > 0 && (
              <div className="nav-group">
                <div className="nav-group-title">
                  <Star className="h-4 w-4" />
                  Favoritos
                </div>
                <div className="quick-access-items">
                  {favoriteItems.slice(0, 3).map(itemId => (
                    <Link
                      key={itemId}
                      to={`${ROUTES.REPORTS}?reportId=${itemId}`}
                      className="quick-access-item favorite"
                      onClick={onClose}
                    >
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>Reporte {itemId.slice(0, 8)}...</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Section */}
            {(canAccessAdmin || canManageUsers || isAdmin) && (
              <>
                {renderSection('admin', 'Administración', adminNavItems, Shield)}
              </>
            )}

            {/* Tools Section */}
            {renderSection('tools', 'Herramientas', toolsNavItems, Zap)}
          </nav>

          {/* Footer */}
          <div className="sidebar-footer">
            <div className="footer-info">
              <div className="app-version">
                <span className="version-label">Microsoft Fabric Embedded</span>
                <span className="version-number">v1.0.0</span>
              </div>
              <div className="connection-status">
                <div className="status-indicator online"></div>
                <span className="status-text">Conectado</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Styles */}
      <style jsx>{`
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 20;
          display: none;
        }

        .sidebar {
          position: fixed;
          top: 64px;
          left: 0;
          bottom: 0;
          width: 280px;
          @apply bg-white border-r border-gray-200;
          z-index: 30;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          overflow: hidden;
        }

        .sidebar.open {
          transform: translateX(0);
        }

        .sidebar-content {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .user-section {
          @apply px-4 py-4 border-b border-gray-200 bg-gray-50;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          @apply w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold;
        }

        .user-details {
          flex: 1;
          min-width: 0;
        }

        .user-name {
          @apply font-semibold text-gray-900 truncate;
          font-size: 14px;
        }

        .user-roles {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .role-badge {
          @apply px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium;
        }

        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          padding: 16px 0;
        }

        .nav-group {
          margin-bottom: 24px;
        }

        .nav-group-title {
          @apply px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .nav-item {
          @apply mx-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-decoration: none;
          margin-bottom: 2px;
        }

        .nav-item.active {
          @apply bg-blue-100 text-blue-700;
        }

        .nav-item.path-active {
          @apply bg-blue-50 text-blue-600;
        }

        .nav-item.section-item {
          @apply mx-4 px-2;
          font-size: 14px;
        }

        .nav-item-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }

        .nav-icon {
          flex-shrink: 0;
        }

        .nav-text {
          flex: 1;
          min-width: 0;
        }

        .nav-name {
          @apply font-medium;
          display: block;
          font-size: 14px;
        }

        .nav-description {
          @apply text-xs text-gray-500;
          display: block;
          margin-top: 2px;
        }

        .nav-badges {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .nav-badge {
          @apply bg-blue-600 text-white rounded-full text-xs;
          min-width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
        }

        .coming-soon-badge {
          @apply bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium;
        }

        .external-badge {
          @apply text-gray-400 text-sm;
        }

        .nav-section {
          margin-bottom: 16px;
        }

        .section-header {
          @apply w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: none;
          border: none;
          cursor: pointer;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          @apply font-medium text-sm;
        }

        .section-content {
          padding-top: 4px;
        }

        .quick-access-items {
          @apply px-2;
        }

        .quick-access-item {
          @apply mx-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-size: 13px;
          margin-bottom: 2px;
        }

        .quick-access-item.favorite {
          @apply text-yellow-700 hover:bg-yellow-50;
        }

        .sidebar-footer {
          @apply px-4 py-4 border-t border-gray-200 bg-gray-50;
        }

        .footer-info {
          space-y: 8px;
        }

        .app-version {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .version-label {
          @apply text-xs font-medium text-gray-700;
        }

        .version-number {
          @apply text-xs text-gray-500;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-indicator.online {
          @apply bg-green-500;
        }

        .status-text {
          @apply text-xs text-gray-600;
        }

        /* Desktop styles */
        @media (min-width: 1024px) {
          .sidebar {
            position: static;
            transform: translateX(0);
            border-right: 1px solid #e5e7eb;
          }

          .sidebar-overlay {
            display: none;
          }
        }

        /* Mobile styles */
        @media (max-width: 1023px) {
          .sidebar-overlay {
            display: block;
          }

          .sidebar {
            top: 64px;
          }
        }

        @media (max-width: 640px) {
          .sidebar {
            width: 100%;
            max-width: 320px;
          }

          .nav-description {
            display: none;
          }

          .coming-soon-badge {
            display: none;
          }
        }

        /* Scrollbar styling */
        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar-nav::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }

        .sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </>
  )
}

export default Sidebar