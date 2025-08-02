import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { MapPin, Activity, AlertCircle } from 'lucide-react'
import { Site } from '@/types'
import { useSite } from '@/context/SiteContext'
import { buildApiUrl, getAuthHeaders } from '@/config/api'

export default function SiteSelector() {
  const navigate = useNavigate()
  const { setCurrentSite } = useSite()

  const { data: sites, isLoading, error } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await fetch('/api/sites', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch sites')
      return response.json()
    },
  })

  const handleSiteSelect = (site: Site) => {
    setCurrentSite(site)
    navigate(`/sites/${site.id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sites...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading sites</h3>
            <p className="mt-1 text-sm text-red-700">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Select a Site</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sites?.map((site) => (
          <button
            key={site.id}
            onClick={() => handleSiteSelect(site)}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-primary-300 transition-all text-left"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{site.name}</h3>
              {site.active ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Activity className="w-3 h-3 mr-1" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Inactive
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-600 mb-4">{site.description}</p>
            
            <div className="flex items-center text-sm text-gray-500">
              <MapPin className="w-4 h-4 mr-1" />
              {site.location.region}, {site.location.country}
            </div>
            
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">{site.chambers} chambers</span>
              <span className="text-gray-500">{site.treatments.length} treatments</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}