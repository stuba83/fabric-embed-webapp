/**
 * PowerBI Service for Microsoft Fabric Embedded Frontend
 * Handles PowerBI embedding, token management, and report interactions
 */

import { models, service, factories } from 'powerbi-client'
import { toast } from 'sonner'

import { apiClient } from './apiClient'

// PowerBI Service instance
let powerbiService = null

// Token cache with expiration
const tokenCache = new Map()

// PowerBI Configuration
const POWERBI_CONFIG = {
  tokenType: models.TokenType.Embed,
  accessLevel: models.Permissions.Read,
  allowEdit: false,
  viewMode: models.ViewMode.View,
  permissions: models.Permissions.Read,
  settings: {
    localeSettings: {
      language: 'es-ES',
      formatLocale: 'es-ES'
    },
    filterPaneEnabled: false,
    navContentPaneEnabled: true,
    bookmarksPane: {
      visible: false
    },
    visualSettings: {
      visualHeaders: [
        {
          settings: {
            visible: true
          }
        }
      ]
    },
    background: models.BackgroundType.Transparent,
    layoutType: models.LayoutType.Custom,
    customLayout: {
      displayOption: models.DisplayOption.FitToPage
    }
  }
}

/**
 * Initialize PowerBI service
 */
export const initializePowerBI = () => {
  if (!powerbiService) {
    powerbiService = new service.Service(
      factories.hpmFactory,
      factories.wpmpFactory,
      factories.routerFactory
    )
    
    console.log('🔷 PowerBI Service initialized')
  }
  return powerbiService
}

/**
 * Get embed token for a specific report
 * @param {string} reportId - PowerBI report ID
 * @param {string} datasetId - PowerBI dataset ID
 * @param {Array} roles - User roles for RLS
 * @returns {Promise<Object>} Embed token data
 */
export const getEmbedToken = async (reportId, datasetId = null, roles = []) => {
  try {
    const cacheKey = `${reportId}-${datasetId}-${roles.join(',')}`
    
    // Check cache first
    if (tokenCache.has(cacheKey)) {
      const cached = tokenCache.get(cacheKey)
      const now = new Date()
      const expiry = new Date(cached.expiration)
      
      // Return cached token if still valid (with 5 min buffer)
      if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
        console.log('🔷 Using cached embed token')
        return cached.data
      } else {
        tokenCache.delete(cacheKey)
      }
    }

    console.log('🔷 Requesting new embed token...')
    
    const response = await apiClient.post('/api/powerbi/embed-token', {
      report_id: reportId,
      dataset_id: datasetId,
      roles: roles
    })

    const tokenData = response.data
    
    // Cache the token
    tokenCache.set(cacheKey, {
      data: tokenData,
      expiration: tokenData.expiration || new Date(Date.now() + 55 * 60 * 1000) // 55 min default
    })

    console.log('🔷 Embed token obtained successfully')
    return tokenData

  } catch (error) {
    console.error('❌ Error getting embed token:', error)
    
    if (error.response?.status === 403) {
      toast.error('No tienes permisos para acceder a este reporte')
      throw new Error('INSUFFICIENT_PERMISSIONS')
    } else if (error.response?.status === 404) {
      toast.error('Reporte no encontrado')
      throw new Error('REPORT_NOT_FOUND')
    } else {
      toast.error('Error al cargar el reporte. Intenta nuevamente.')
      throw new Error('TOKEN_REQUEST_FAILED')
    }
  }
}

/**
 * Get available reports for the current user
 * @returns {Promise<Array>} List of available reports
 */
export const getAvailableReports = async () => {
  try {
    console.log('🔷 Fetching available reports...')
    
    const response = await apiClient.get('/api/powerbi/reports')
    const reports = response.data.reports || []
    
    console.log(`🔷 Found ${reports.length} available reports`)
    return reports

  } catch (error) {
    console.error('❌ Error fetching reports:', error)
    toast.error('Error al cargar la lista de reportes')
    return []
  }
}

/**
 * Get workspace information
 * @returns {Promise<Object>} Workspace data
 */
export const getWorkspaceInfo = async () => {
  try {
    const response = await apiClient.get('/api/powerbi/workspace')
    return response.data
  } catch (error) {
    console.error('❌ Error fetching workspace info:', error)
    return null
  }
}

/**
 * Embed a PowerBI report in a container
 * @param {HTMLElement} container - DOM element to embed the report
 * @param {string} reportId - PowerBI report ID
 * @param {string} datasetId - PowerBI dataset ID (optional)
 * @param {Array} roles - User roles for RLS
 * @param {Object} customSettings - Custom PowerBI settings
 * @returns {Promise<Object>} PowerBI report instance
 */
export const embedReport = async (
  container, 
  reportId, 
  datasetId = null, 
  roles = [], 
  customSettings = {}
) => {
  try {
    if (!container) {
      throw new Error('Container element is required')
    }

    console.log('🔷 Starting report embed process...')
    
    // Initialize PowerBI service
    const service = initializePowerBI()
    
    // Get embed token
    const tokenData = await getEmbedToken(reportId, datasetId, roles)
    
    // Prepare embed configuration
    const embedConfig = {
      type: 'report',
      id: reportId,
      embedUrl: tokenData.embed_url,
      accessToken: tokenData.access_token,
      tokenType: POWERBI_CONFIG.tokenType,
      permissions: POWERBI_CONFIG.permissions,
      viewMode: POWERBI_CONFIG.viewMode,
      settings: {
        ...POWERBI_CONFIG.settings,
        ...customSettings
      }
    }

    console.log('🔷 Embedding report with config:', {
      reportId,
      embedUrl: tokenData.embed_url,
      hasToken: !!tokenData.access_token,
      roles
    })

    // Embed the report
    const report = service.embed(container, embedConfig)
    
    // Set up event handlers
    setupReportEventHandlers(report)
    
    console.log('🔷 Report embedded successfully')
    return report

  } catch (error) {
    console.error('❌ Error embedding report:', error)
    throw error
  }
}

/**
 * Set up event handlers for PowerBI report
 * @param {Object} report - PowerBI report instance
 */
const setupReportEventHandlers = (report) => {
  // Report loaded event
  report.on('loaded', () => {
    console.log('🔷 Report loaded successfully')
  })

  // Report rendered event
  report.on('rendered', () => {
    console.log('🔷 Report rendered successfully')
  })

  // Report error event
  report.on('error', (event) => {
    console.error('❌ PowerBI Report Error:', event.detail)
    toast.error('Error en el reporte de PowerBI')
  })

  // Data selected event
  report.on('dataSelected', (event) => {
    console.log('🔷 Data selected in report:', event.detail)
  })

  // Page changed event
  report.on('pageChanged', (event) => {
    console.log('🔷 Report page changed:', event.detail)
  })

  // Button clicked event
  report.on('buttonClicked', (event) => {
    console.log('🔷 Button clicked in report:', event.detail)
  })
}

/**
 * Refresh report data
 * @param {Object} report - PowerBI report instance
 * @returns {Promise<void>}
 */
export const refreshReport = async (report) => {
  try {
    console.log('🔷 Refreshing report data...')
    await report.refresh()
    toast.success('Reporte actualizado correctamente')
  } catch (error) {
    console.error('❌ Error refreshing report:', error)
    toast.error('Error al actualizar el reporte')
  }
}

/**
 * Set report filters
 * @param {Object} report - PowerBI report instance
 * @param {Array} filters - Array of filter objects
 * @returns {Promise<void>}
 */
export const setReportFilters = async (report, filters) => {
  try {
    console.log('🔷 Setting report filters:', filters)
    await report.setFilters(filters)
    console.log('🔷 Filters applied successfully')
  } catch (error) {
    console.error('❌ Error setting filters:', error)
    toast.error('Error al aplicar filtros')
  }
}

/**
 * Export report to PDF
 * @param {Object} report - PowerBI report instance
 * @param {string} filename - Output filename
 * @returns {Promise<void>}
 */
export const exportToPDF = async (report, filename = 'report.pdf') => {
  try {
    console.log('🔷 Exporting report to PDF...')
    
    const exportData = await report.exportData(models.ExportDataType.Summarized)
    
    // Create blob and download
    const blob = new Blob([exportData], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    
    window.URL.revokeObjectURL(url)
    toast.success('Reporte exportado correctamente')
    
  } catch (error) {
    console.error('❌ Error exporting report:', error)
    toast.error('Error al exportar el reporte')
  }
}

/**
 * Clear token cache
 */
export const clearTokenCache = () => {
  tokenCache.clear()
  console.log('🔷 Token cache cleared')
}

/**
 * Get cached tokens info (for debugging)
 */
export const getCacheInfo = () => {
  const info = Array.from(tokenCache.entries()).map(([key, value]) => ({
    key,
    expiration: value.expiration,
    isExpired: new Date() > new Date(value.expiration)
  }))
  
  return {
    totalTokens: tokenCache.size,
    tokens: info
  }
}