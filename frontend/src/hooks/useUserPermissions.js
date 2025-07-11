import { useMemo } from 'react'
import { useAuth } from './useAuth'

/**
 * Hook para manejar permisos de usuario basados en roles
 * Proporciona funciones para verificar permisos y accesos
 */
export const useUserPermissions = () => {
  const { user, userRoles } = useAuth()

  // Mapeo de roles a permisos
  const rolePermissions = useMemo(() => ({
    Admin: [
      'view_all_reports',
      'manage_users',
      'export_reports',
      'manage_system',
      'view_analytics',
      'configure_reports',
      'access_admin_panel'
    ],
    RolA: [
      'view_rola_reports',
      'export_reports',
      'view_analytics'
    ],
    RolB: [
      'view_rolb_reports',
      'export_reports',
      'view_analytics'
    ]
  }), [])

  // Obtener todos los permisos del usuario actual
  const userPermissions = useMemo(() => {
    if (!userRoles || userRoles.length === 0) return []
    
    const permissions = new Set()
    
    userRoles.forEach(role => {
      const rolePerms = rolePermissions[role] || []
      rolePerms.forEach(perm => permissions.add(perm))
    })
    
    return Array.from(permissions)
  }, [userRoles, rolePermissions])

  // Verificar si el usuario tiene un permiso específico
  const hasPermission = (permission) => {
    return userPermissions.includes(permission)
  }

  // Verificar si el usuario tiene al menos uno de los permisos
  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => userPermissions.includes(permission))
  }

  // Verificar si el usuario tiene todos los permisos
  const hasAllPermissions = (permissions) => {
    return permissions.every(permission => userPermissions.includes(permission))
  }

  // Verificar si el usuario tiene un rol específico
  const hasRole = (role) => {
    return userRoles.includes(role)
  }

  // Verificar si el usuario tiene al menos uno de los roles
  const hasAnyRole = (roles) => {
    return roles.some(role => userRoles.includes(role))
  }

  // Verificar si el usuario es administrador
  const isAdmin = hasRole('Admin')

  // Verificar si puede ver reportes específicos
  const canViewReports = (reportType = 'all') => {
    switch (reportType) {
      case 'all':
        return hasPermission('view_all_reports')
      case 'rola':
        return hasAnyPermission(['view_all_reports', 'view_rola_reports'])
      case 'rolb':
        return hasAnyPermission(['view_all_reports', 'view_rolb_reports'])
      default:
        return false
    }
  }

  // Verificar si puede exportar reportes
  const canExportReports = hasPermission('export_reports')

  // Verificar si puede acceder al panel de administración
  const canAccessAdmin = hasPermission('access_admin_panel')

  // Verificar si puede gestionar usuarios
  const canManageUsers = hasPermission('manage_users')

  // Verificar si puede ver analytics
  const canViewAnalytics = hasPermission('view_analytics')

  // Verificar si puede configurar reportes
  const canConfigureReports = hasPermission('configure_reports')

  // Obtener filtros de PowerBI basados en roles
  const getPowerBIFilters = () => {
    if (isAdmin) {
      // Los admins ven todo, no necesitan filtros RLS
      return []
    }

    const filters = []
    
    if (hasRole('RolA')) {
      filters.push({
        $schema: "http://powerbi.com/product/schema#basic",
        target: {
          table: "Users",
          column: "Role"
        },
        operator: "In",
        values: ["RolA"],
        filterType: 1
      })
    }
    
    if (hasRole('RolB')) {
      filters.push({
        $schema: "http://powerbi.com/product/schema#basic",
        target: {
          table: "Users", 
          column: "Role"
        },
        operator: "In",
        values: ["RolB"],
        filterType: 1
      })
    }

    return filters
  }

  // Obtener configuración de navegación basada en permisos
  const getNavigationConfig = () => {
    const navigation = [
      {
        name: 'Dashboard',
        path: '/dashboard',
        icon: 'BarChart3',
        visible: true
      },
      {
        name: 'Reportes',
        path: '/reports',
        icon: 'FileText',
        visible: userPermissions.length > 0
      }
    ]

    if (canAccessAdmin) {
      navigation.push({
        name: 'Administración',
        path: '/admin',
        icon: 'Settings',
        visible: true
      })
    }

    return navigation.filter(item => item.visible)
  }

  // Obtener información de usuario para debugging
  const getPermissionInfo = () => {
    return {
      user: user?.name || 'Unknown',
      roles: userRoles,
      permissions: userPermissions,
      isAdmin,
      canExport: canExportReports,
      canViewAnalytics,
      canAccessAdmin
    }
  }

  return {
    // Estado
    userPermissions,
    userRoles,
    isAdmin,
    
    // Funciones de verificación
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    
    // Permisos específicos
    canViewReports,
    canExportReports,
    canAccessAdmin,
    canManageUsers,
    canViewAnalytics,
    canConfigureReports,
    
    // Utilidades
    getPowerBIFilters,
    getNavigationConfig,
    getPermissionInfo
  }
}