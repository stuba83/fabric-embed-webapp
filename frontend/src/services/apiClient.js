/**
 * API Client for Microsoft Fabric Embedded Frontend
 * Handles HTTP requests with authentication, error handling, and retry logic
 */

import axios from 'axios'
import { toast } from 'sonner'

import { getAuthToken } from './authService'

// Base configuration
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Create axios instance with base configuration
 */
const createApiClient = () => {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor - Add auth token
  client.interceptors.request.use(
    async (config) => {
      try {
        // Add authentication token
        const token = await getAuthToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = generateRequestId()

        // Log request in development
        if (import.meta.env.DEV) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
            headers: config.headers,
            data: config.data
          })
        }

        return config
      } catch (error) {
        console.error('Failed to prepare request:', error)
        return Promise.reject(error)
      }
    },
    (error) => {
      console.error('Request interceptor error:', error)
      return Promise.reject(error)
    }
  )

  // Response interceptor - Handle responses and errors
  client.interceptors.response.use(
    (response) => {
      // Log response in development
      if (import.meta.env.DEV) {
        console.log(`[API Response] ${response.status} ${response.config.url}`, {
          data: response.data,
          headers: response.headers
        })
      }

      return response
    },
    async (error) => {
      const originalRequest = error.config

      // Log error in development
      if (import.meta.env.DEV) {
        console.error(`[API Error] ${error.response?.status} ${originalRequest?.url}`, {
          error: error.message,
          response: error.response?.data,
          headers: error.response?.headers
        })
      }

      // Handle different error types
      if (error.response) {
        // Server responded with error status
        const { status, data } = error.response

        switch (status) {
          case 401:
            handleUnauthorizedError(error, originalRequest)
            break
          case 403:
            handleForbiddenError(error)
            break
          case 404:
            handleNotFoundError(error)
            break
          case 429:
            handleRateLimitError(error)
            break
          case 500:
          case 502:
          case 503:
          case 504:
            handleServerError(error)
            break
          default:
            handleGenericError(error)
        }

        // Enhance error with structured data
        error.isApiError = true
        error.statusCode = status
        error.errorCode = data?.error
        error.userMessage = data?.message || getDefaultErrorMessage(status)
        
      } else if (error.request) {
        // Network error
        handleNetworkError(error)
      } else {
        // Request configuration error
        handleConfigError(error)
      }

      return Promise.reject(error)
    }
  )

  return client
}

/**
 * Error handlers
 */
const handleUnauthorizedError = async (error, originalRequest) => {
  console.warn('Unauthorized request, attempting token refresh...')
  
  // Prevent infinite retry loops
  if (originalRequest._retry) {
    toast.error('Session expired. Please sign in again.')
    // Could trigger logout here
    return
  }

  originalRequest._retry = true

  try {
    // Try to get a fresh token
    const newToken = await getAuthToken()
    if (newToken) {
      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return apiClient(originalRequest)
    }
  } catch (refreshError) {
    console.error('Token refresh failed:', refreshError)
    toast.error('Session expired. Please sign in again.')
    // Could trigger logout here
  }
}

const handleForbiddenError = (error) => {
  const message = error.response?.data?.message || 'You do not have permission to perform this action'
  toast.error(message)
}

const handleNotFoundError = (error) => {
  const message = error.response?.data?.message || 'The requested resource was not found'
  if (import.meta.env.DEV) {
    toast.error(message)
  }
}

const handleRateLimitError = (error) => {
  const retryAfter = error.response?.headers['retry-after']
  const message = `Too many requests. Please try again ${retryAfter ? `in ${retryAfter} seconds` : 'later'}.`
  toast.error(message)
}

const handleServerError = (error) => {
  const message = error.response?.data?.message || 'Server error occurred. Please try again.'
  toast.error(message)
}

const handleNetworkError = (error) => {
  console.error('Network error:', error)
  toast.error('Network error. Please check your connection and try again.')
}

const handleConfigError = (error) => {
  console.error('Request configuration error:', error)
  toast.error('Request failed. Please try again.')
}

const handleGenericError = (error) => {
  const message = error.response?.data?.message || 'An unexpected error occurred'
  toast.error(message)
}

/**
 * Get default error message based on status code
 */
const getDefaultErrorMessage = (status) => {
  const messages = {
    400: 'Invalid request. Please check your input.',
    401: 'Authentication required.',
    403: 'Access denied.',
    404: 'Resource not found.',
    422: 'Invalid data provided.',
    429: 'Too many requests. Please try again later.',
    500: 'Server error. Please try again.',
    502: 'Service temporarily unavailable.',
    503: 'Service unavailable.',
    504: 'Request timeout. Please try again.'
  }
  
  return messages[status] || 'An error occurred'
}

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create the API client instance
 */
export const apiClient = createApiClient()

/**
 * API wrapper methods with enhanced error handling
 */
export const api = {
  // GET request
  get: async (url, config = {}) => {
    try {
      const response = await apiClient.get(url, config)
      return response
    } catch (error) {
      throw enhanceError(error, 'GET', url)
    }
  },

  // POST request
  post: async (url, data = {}, config = {}) => {
    try {
      const response = await apiClient.post(url, data, config)
      return response
    } catch (error) {
      throw enhanceError(error, 'POST', url)
    }
  },

  // PUT request
  put: async (url, data = {}, config = {}) => {
    try {
      const response = await apiClient.put(url, data, config)
      return response
    } catch (error) {
      throw enhanceError(error, 'PUT', url)
    }
  },

  // DELETE request
  delete: async (url, config = {}) => {
    try {
      const response = await apiClient.delete(url, config)
      return response
    } catch (error) {
      throw enhanceError(error, 'DELETE', url)
    }
  },

  // PATCH request
  patch: async (url, data = {}, config = {}) => {
    try {
      const response = await apiClient.patch(url, data, config)
      return response
    } catch (error) {
      throw enhanceError(error, 'PATCH', url)
    }
  }
}

/**
 * Enhance error with additional context
 */
const enhanceError = (error, method, url) => {
  return {
    ...error,
    method,
    url,
    timestamp: new Date().toISOString()
  }
}

/**
 * Upload file helper
 */
export const uploadFile = async (url, file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const response = await apiClient.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percentCompleted)
        }
      }
    })

    return response
  } catch (error) {
    throw enhanceError(error, 'UPLOAD', url)
  }
}

/**
 * Download file helper
 */
export const downloadFile = async (url, filename) => {
  try {
    const response = await apiClient.get(url, {
      responseType: 'blob'
    })

    // Create blob URL and trigger download
    const blob = new Blob([response.data])
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(downloadUrl)

    return response
  } catch (error) {
    throw enhanceError(error, 'DOWNLOAD', url)
  }
}

/**
 * Health check helper
 */
export const healthCheck = async () => {
  try {
    const response = await apiClient.get('/health')
    return response.data
  } catch (error) {
    console.error('Health check failed:', error)
    return { status: 'unhealthy', error: error.message }
  }
}

/**
 * Retry helper for failed requests
 */
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  let lastError
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn()
    } catch (error) {
      lastError = error
      
      // Don't retry auth or client errors
      if (error.response?.status < 500) {
        throw error
      }
      
      // Wait before retry
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
      }
    }
  }
  
  throw lastError
}

// Export default api client
export default apiClient