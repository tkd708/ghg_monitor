import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Save, X, AlertCircle } from 'lucide-react'
import { Site } from '@/types'
import { buildApiUrl, getAuthHeaders } from '@/config/api'

interface SiteInfoEditorProps {
  site: Site
  siteId: string
}

export default function SiteInfoEditor({ site, siteId }: SiteInfoEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(site.name)
  const [description, setDescription] = useState(site.description)
  const [error, setError] = useState<string | null>(null)
  
  const queryClient = useQueryClient()

  // Reset form when site changes
  useEffect(() => {
    setName(site.name)
    setDescription(site.description)
    setError(null)
  }, [site.name, site.description])

  const updateSiteMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const response = await fetch(buildApiUrl(`api/sites/${siteId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name, description }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update site information')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Update the site context and query cache
      queryClient.invalidateQueries({ queryKey: ['site', siteId] })
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      setIsEditing(false)
      setError(null)
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleSave = () => {
    if (!name.trim() || !description.trim()) {
      setError('Name and description are required')
      return
    }
    
    setError(null)
    updateSiteMutation.mutate({ name: name.trim(), description: description.trim() })
  }

  const handleCancel = () => {
    setName(site.name)
    setDescription(site.description)
    setIsEditing(false)
    setError(null)
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Site Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter site name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            placeholder="Enter site description"
          />
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center space-x-3">
          <button
            onClick={handleSave}
            disabled={updateSiteMutation.isPending}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateSiteMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          
          <button
            onClick={handleCancel}
            disabled={updateSiteMutation.isPending}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {site.name}
          </h1>
          <p className="text-gray-600 mt-1">
            {site.description}
          </p>
        </div>
        
        <button
          onClick={() => setIsEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          title="Edit site information"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}