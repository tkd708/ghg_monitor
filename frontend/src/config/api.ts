// API Configuration for GHG Monitor Frontend

const getApiBaseUrl = (): string => {
  // In production, use the environment variable
  if (import.meta.env.PROD) {
    return import.meta.env.VITE_API_URL || 'https://ghg-monitor-backend.railway.app'
  }
  
  // In development, use localhost
  return 'http://localhost:3000'
}

export const API_BASE_URL = getApiBaseUrl()

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  return `${API_BASE_URL}/${cleanEndpoint}`
}

// API client configuration
export const apiConfig = {
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
}

// Helper function to get auth headers
export const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Complete headers including auth
export const getApiHeaders = (): Record<string, string> => {
  return {
    ...apiConfig.headers,
    ...getAuthHeaders(),
  }
}