import React, { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMsal } from '@azure/msal-react'
import { toast } from 'sonner'
import { 
  Menu, 
  X, 
  Search, 
  Bell, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown,
  BarChart3,
  Home,
  FileText,
  Shield,
  HelpCircle,
  Moon,
  Sun
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { ROUTES } from '@/utils/constants'

/**
 * Header Component
 * Main navigation header with user menu, notifications, and mobile navigation
 */
const Header = ({ onMenuToggle, isSidebarOpen = false }) => {
  // State
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Refs
  const userMenuRef = useRef(null)
  const notificationsRef = useRef(null)
  const searchRef = useRef(null)

  // Hooks
  const location = useLocation()
  const { instance } = useMsal()
  const { user, userRoles } = useAuth()
  const { isAdmin, canAccessAdmin, getNavigationConfig } = useUserPermissions()

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearch(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Navigate to reports with search query
      window.location.href = `${ROUTES.REPORTS}?search=${encodeURIComponent(searchQuery.trim())}`
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin
      })
      toast.success('Sesión cerrada correctamente')
    } catch (error) {
      console.error('Error logging out:', error)
      toast.error('Error al cerrar sesión')
    }
  }

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    // Here you would implement actual dark mode logic
    toast.info(`Modo ${!isDarkMode ? 'oscuro' : 'claro'} ${!isDarkMode ? 'activado' : 'desactivado'}`)
  }

  // Get page title based on current route
  const getPageTitle = () => {
    switch (location.pathname) {
      case ROUTES.DASHBOARD:
        return 'Dashboard'
      case ROUTES.REPORTS:
        return 'Reportes'
      case ROUTES.ADMIN:
        return 'Administración'
      default:
        return 'Microsoft Fabric'
    }
  }

  // Navigation items for quick access
  const quickNavItems = getNavigationConfig()

  // Mock notifications (in real app, this would come from an API)
  const notifications = [
    {
      id: 1,
      title: 'Reporte actualizado',
      message: 'El reporte de ventas ha sido actualizado',
      timestamp: '5 min',
      unread: true,
      type: 'info'
    },
    {
      id: 2,
      title: 'Sistema mantenimiento',
      message: 'Mantenimiento programado para esta noche',
      timestamp: '1 hora',
      unread: true,
      type: 'warning'
    },
    {
      id: 3,
      title: 'Nuevo usuario agregado',
      message: 'Se agregó un nuevo usuario al sistema',
      timestamp: '2 horas',
      unread: false,
      type: 'success'
    }
  ]

  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <header className="app-header">
      <div className="header-content">
        {/* Left Section */}
        <div className="header-left">
          {/* Mobile Menu Toggle */}
          <button
            onClick={onMenuToggle}
            className="mobile-menu-btn"
            aria-label="Toggle menu"
          >
            {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Logo and Brand */}
          <Link to={ROUTES.DASHBOARD} className="brand-link">
            <div className="brand">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div className="brand-text">
                <span className="brand-name">Fabric Embedded</span>
                <span className="brand-subtitle">Microsoft</span>
              </div>
            </div>
          </Link>

          {/* Page Title (Desktop) */}
          <div className="page-title-section">
            <span className="page-title">{getPageTitle()}</span>
          </div>
        </div>

        {/* Center Section - Quick Navigation */}
        <div className="header-center">
          <nav className="quick-nav">
            {quickNavItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`quick-nav-item ${location.pathname === item.path ? 'active' : ''}`}
                title={item.name}
              >
                {item.icon === 'BarChart3' && <BarChart3 className="h-4 w-4" />}
                {item.icon === 'FileText' && <FileText className="h-4 w-4" />}
                {item.icon === 'Settings' && <Settings className="h-4 w-4" />}
                <span className="nav-label">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Section */}
        <div className="header-right">
          {/* Search */}
          <div className="search-section" ref={searchRef}>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="search-toggle"
              title="Buscar"
            >
              <Search className="h-5 w-5" />
            </button>

            {showSearch && (
              <div className="search-dropdown">
                <form onSubmit={handleSearch} className="search-form">
                  <Search className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar reportes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    autoFocus
                  />
                  <button type="submit" className="search-submit">
                    Buscar
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="notifications-section" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="notifications-toggle"
              title="Notificaciones"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h3 className="notifications-title">Notificaciones</h3>
                  <button className="mark-all-read">Marcar como leídas</button>
                </div>

                <div className="notifications-list">
                  {notifications.length > 0 ? (
                    notifications.map(notification => (
                      <div
                        key={notification.id}
                        className={`notification-item ${notification.unread ? 'unread' : ''}`}
                      >
                        <div className={`notification-type ${notification.type}`}></div>
                        <div className="notification-content">
                          <h4 className="notification-title">{notification.title}</h4>
                          <p className="notification-message">{notification.message}</p>
                          <span className="notification-time">{notification.timestamp}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-notifications">
                      <Bell className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-gray-500">No hay notificaciones</p>
                    </div>
                  )}
                </div>

                <div className="notifications-footer">
                  <Link to="/notifications" className="view-all-link">
                    Ver todas las notificaciones
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            className="dark-mode-toggle"
            title={`Cambiar a modo ${isDarkMode ? 'claro' : 'oscuro'}`}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* User Menu */}
          <div className="user-menu-section" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="user-menu-toggle"
              title="Menú de usuario"
            >
              <div className="user-info">
                <div className="user-avatar">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="user-details">
                  <span className="user-name">{user?.name || 'Usuario'}</span>
                  <span className="user-role">
                    {userRoles.join(', ') || 'Usuario'}
                  </span>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-dropdown-avatar">
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div className="user-dropdown-info">
                    <div className="user-dropdown-name">{user?.name || 'Usuario'}</div>
                    <div className="user-dropdown-email">{user?.email || 'email@ejemplo.com'}</div>
                    <div className="user-dropdown-roles">
                      {userRoles.map(role => (
                        <span key={role} className="role-tag">{role}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="user-dropdown-menu">
                  <Link to="/profile" className="dropdown-item">
                    <User className="h-4 w-4" />
                    <span>Mi Perfil</span>
                  </Link>

                  <Link to="/settings" className="dropdown-item">
                    <Settings className="h-4 w-4" />
                    <span>Configuración</span>
                  </Link>

                  {canAccessAdmin && (
                    <Link to={ROUTES.ADMIN} className="dropdown-item">
                      <Shield className="h-4 w-4" />
                      <span>Administración</span>
                    </Link>
                  )}

                  <Link to="/help" className="dropdown-item">
                    <HelpCircle className="h-4 w-4" />
                    <span>Ayuda</span>
                  </Link>

                  <div className="dropdown-divider"></div>

                  <button onClick={handleLogout} className="dropdown-item logout">
                    <LogOut className="h-4 w-4" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style jsx>{`
        .app-header {
          height: 64px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          position: sticky;
          top: 0;
          z-index: 40;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }

        .header-content {
          height: 100%;
          max-width: 100%;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
        }

        .mobile-menu-btn {
          @apply p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors;
          display: none;
        }

        .brand-link {
          text-decoration: none;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
        }

        .brand-name {
          @apply text-lg font-bold text-gray-900;
          line-height: 1;
        }

        .brand-subtitle {
          @apply text-xs text-gray-500;
          line-height: 1;
        }

        .page-title-section {
          @apply border-l border-gray-200 pl-4 ml-4;
        }

        .page-title {
          @apply text-lg font-semibold text-gray-700;
        }

        .header-center {
          flex: 1;
          display: flex;
          justify-content: center;
          max-width: 600px;
        }

        .quick-nav {
          display: flex;
          gap: 8px;
          padding: 4px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .quick-nav-item {
          @apply px-4 py-2 text-gray-600 hover:text-gray-800 rounded-md transition-colors;
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          font-weight: 500;
          font-size: 14px;
        }

        .quick-nav-item.active {
          @apply bg-white text-blue-600 shadow-sm;
        }

        .nav-label {
          display: block;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          justify-content: flex-end;
        }

        .search-section {
          position: relative;
        }

        .search-toggle,
        .notifications-toggle,
        .dark-mode-toggle {
          @apply p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors;
          position: relative;
        }

        .notification-badge {
          position: absolute;
          top: 0;
          right: 0;
          @apply bg-red-500 text-white text-xs rounded-full;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
        }

        .search-dropdown,
        .notifications-dropdown,
        .user-dropdown {
          position: absolute;
          top: 100%;
          right: 0;
          @apply bg-white border border-gray-200 rounded-lg shadow-lg;
          z-index: 50;
          min-width: 320px;
          margin-top: 8px;
        }

        .search-dropdown {
          width: 400px;
          padding: 16px;
        }

        .search-form {
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
          @apply w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg;
          font-size: 14px;
        }

        .search-submit {
          position: absolute;
          right: 8px;
          @apply px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors;
        }

        .notifications-dropdown {
          width: 380px;
          max-height: 500px;
          overflow-y: auto;
        }

        .notifications-header {
          @apply px-4 py-3 border-b border-gray-200;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .notifications-title {
          @apply text-lg font-semibold text-gray-900;
        }

        .mark-all-read {
          @apply text-sm text-blue-600 hover:text-blue-700;
          background: none;
          border: none;
          cursor: pointer;
        }

        .notifications-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .notification-item {
          @apply px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer;
          display: flex;
          gap: 12px;
          transition: background-color 0.2s;
        }

        .notification-item.unread {
          @apply bg-blue-50;
        }

        .notification-type {
          width: 4px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .notification-type.info {
          @apply bg-blue-500;
        }

        .notification-type.warning {
          @apply bg-yellow-500;
        }

        .notification-type.success {
          @apply bg-green-500;
        }

        .notification-content {
          flex: 1;
        }

        .notification-title {
          @apply font-semibold text-gray-900 mb-1;
          font-size: 14px;
          margin: 0;
        }

        .notification-message {
          @apply text-gray-600 mb-2;
          font-size: 13px;
          margin: 0;
        }

        .notification-time {
          @apply text-xs text-gray-500;
        }

        .no-notifications {
          @apply p-8 text-center;
        }

        .notifications-footer {
          @apply px-4 py-3 border-t border-gray-200;
        }

        .view-all-link {
          @apply text-sm text-blue-600 hover:text-blue-700;
          text-decoration: none;
        }

        .user-menu-toggle {
          @apply p-2 hover:bg-gray-100 rounded-md transition-colors;
          display: flex;
          align-items: center;
          gap: 12px;
          background: none;
          border: none;
          cursor: pointer;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          @apply w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold;
          font-size: 14px;
        }

        .user-details {
          display: flex;
          flex-direction: column;
          text-align: left;
        }

        .user-name {
          @apply font-semibold text-gray-900;
          font-size: 14px;
          line-height: 1.2;
        }

        .user-role {
          @apply text-xs text-gray-500;
          line-height: 1.2;
        }

        .user-dropdown {
          width: 280px;
        }

        .user-dropdown-header {
          @apply px-4 py-4 border-b border-gray-200;
          display: flex;
          gap: 12px;
        }

        .user-dropdown-avatar {
          @apply w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold;
          font-size: 16px;
        }

        .user-dropdown-info {
          flex: 1;
        }

        .user-dropdown-name {
          @apply font-semibold text-gray-900 mb-1;
        }

        .user-dropdown-email {
          @apply text-sm text-gray-600 mb-2;
        }

        .user-dropdown-roles {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .role-tag {
          @apply px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs;
        }

        .user-dropdown-menu {
          @apply py-2;
        }

        .dropdown-item {
          @apply px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors;
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          font-size: 14px;
        }

        .dropdown-item.logout {
          @apply text-red-600 hover:bg-red-50;
          background: none;
          border: none;
          width: 100%;
          cursor: pointer;
        }

        .dropdown-divider {
          @apply border-t border-gray-200 my-2;
        }

        @media (max-width: 1024px) {
          .header-center {
            display: none;
          }

          .quick-nav {
            display: none;
          }

          .page-title-section {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .header-content {
            padding: 0 16px;
          }

          .mobile-menu-btn {
            display: block;
          }

          .brand-text {
            display: none;
          }

          .user-details {
            display: none;
          }

          .search-dropdown {
            width: 300px;
          }

          .notifications-dropdown {
            width: 300px;
          }

          .user-dropdown {
            width: 260px;
          }

          .nav-label {
            display: none;
          }
        }
      `}</style>
    </header>
  )
}

export default Header