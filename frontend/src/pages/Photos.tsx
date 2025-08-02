import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Camera, AlertCircle } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

export default function Photos() {
  const { siteId } = useParams<{ siteId: string }>()
  const [isUploading, setIsUploading] = useState(false)
  const queryClient = useQueryClient()

  const { data: photos, isLoading, error } = useQuery({
    queryKey: ['photos', siteId],
    queryFn: async () => {
      const response = await fetch(`/api/sites/${siteId}/photos`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch photos')
      return response.json()
    },
    enabled: !!siteId,
  })

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData()
      files.forEach(file => formData.append('photos', file))
      
      const response = await fetch(`/api/sites/${siteId}/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      })
      
      if (!response.ok) throw new Error('Failed to upload photos')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', siteId] })
      setIsUploading(false)
    },
    onError: () => {
      setIsUploading(false)
    },
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    onDrop: (acceptedFiles) => {
      setIsUploading(true)
      uploadMutation.mutate(acceptedFiles)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading photos...</p>
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
            <h3 className="text-sm font-medium text-red-800">Error loading photos</h3>
            <p className="mt-1 text-sm text-red-700">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Site Photos</h1>
        <p className="text-gray-600">Upload and manage field documentation photos</p>
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        {isDragActive ? (
          <p className="text-primary-600">Drop photos here...</p>
        ) : (
          <div>
            <p className="text-gray-600 mb-2">
              Drag and drop photos here, or click to select files
            </p>
            <p className="text-sm text-gray-500">
              Supports: JPEG, PNG, GIF, WebP (max 10MB each)
            </p>
          </div>
        )}
        {isUploading && (
          <div className="mt-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Uploading...</p>
          </div>
        )}
      </div>

      {/* Photos Grid */}
      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {photos.map((photo: any) => (
            <div key={photo.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <img
                src={photo.path}
                alt={photo.filename}
                className="w-full h-48 object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y3ZjdmNyIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+'
                }}
              />
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 truncate" title={photo.filename}>
                  {photo.filename}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(photo.uploadDate).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500">
                  {(photo.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Camera className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No photos uploaded yet</p>
          <p className="text-sm text-gray-400">Upload your first photo to get started</p>
        </div>
      )}
    </div>
  )
}