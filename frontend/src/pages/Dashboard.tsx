import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, BarChart3, TrendingUp, Activity } from 'lucide-react'
import { useSite } from '@/context/SiteContext'
import { buildApiUrl, getAuthHeaders } from '@/config/api'

export default function Dashboard() {
  const { siteId } = useParams<{ siteId: string }>()
  const { currentSite } = useSite()

  const { data: fluxData, isLoading, error } = useQuery({
    queryKey: ['fluxData', siteId],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`api/sites/${siteId}/data`), {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to fetch flux data')
      return response.json()
    },
    enabled: !!siteId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
            <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
            <p className="mt-1 text-sm text-red-700">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    )
  }

  const totalRecords = fluxData?.totalRecords || 0
  const uniqueChambers = fluxData?.data ? 
    [...new Set(fluxData.data.map((d: any) => d.chamber))].length : 0
  const mostRecentFile = fluxData?.mostRecentFile

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {currentSite?.name || 'Site Dashboard'}
        </h1>
        <p className="text-gray-600">
          {currentSite?.description}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Records</p>
              <p className="text-2xl font-semibold text-gray-900">{totalRecords.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Active Chambers</p>
              <p className="text-2xl font-semibold text-gray-900">{uniqueChambers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Site Status</p>
              <p className="text-2xl font-semibold text-green-600">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Most Recent File Info */}
      {mostRecentFile && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Most Recent Data File</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Filename</p>
                <p className="text-lg font-semibold text-gray-900">{mostRecentFile.filename}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Last Record Time</p>
                <p className="text-lg font-semibold text-gray-900">
                  {mostRecentFile.datetime ? new Date(mostRecentFile.datetime).toLocaleString() : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Records in File</p>
                <p className="text-lg font-semibold text-gray-900">{mostRecentFile.recordCount?.toLocaleString() || 'N/A'}</p>
              </div>
              
              {/* Status counts */}
              {mostRecentFile.statusCounts && Object.keys(mostRecentFile.statusCounts).length > 0 && (
                <div className="col-span-full">
                  <p className="text-sm font-medium text-gray-500 mb-2">Status Distribution</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(mostRecentFile.statusCounts).map(([status, count]) => (
                      <span
                        key={status}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        Status {status}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data Preview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Data</h2>
        </div>
        <div className="p-6">
          {fluxData?.data?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      DateTime
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Chamber
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CO2 (ppm)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      N2O (ppb)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      H2O (ppm)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Temp (°C)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pressure (kPa)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fluxData.data.slice(-10).reverse().map((record: any, index: number) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.datetime).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.chamber_label}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.co2_ppm?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(record.n2o_ppb || record.n2o_ppm * 1000)?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.h2o_ppm?.toFixed(2) || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          record.status === '0' ? 'bg-green-100 text-green-800' : 
                          record.status === '1' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.temp_c?.toFixed(1) || '25.0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.pair_kpa?.toFixed(1) || '0.0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No data available</p>
          )}
        </div>
      </div>
    </div>
  )
}