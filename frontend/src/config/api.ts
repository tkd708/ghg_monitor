// API Configuration for GHG Monitor Frontend

const getApiBaseUrl = (): string => {
  // In production with Railway, frontend and backend are on same domain
  if (import.meta.env.PROD) {
    // Use relative URLs in production (same domain)
    return ''
  }
  
  // In development, use localhost
  return 'http://localhost:3000'
}

export const API_BASE_URL = getApiBaseUrl()

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  
  // If no base URL (production), return just the endpoint
  if (!API_BASE_URL) {
    return cleanEndpoint
  }
  
  // Otherwise, combine base URL and endpoint
  return `${API_BASE_URL}${cleanEndpoint}`
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