import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Settings, AlertTriangle, BarChart3 } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Site } from '@/types'

interface FluxCalculation {
  datetime: string
  chamber: number
  treatment: string
  replicate: number
  co2_flux: number
  n2o_flux: number
  co2_r2: number
  n2o_r2: number
  measurement_start_time: string // HH:MM format for diurnal analysis
  duration_seconds: number
}

interface FluxQualityCheckProps {
  siteId: string
  site?: Site
}

// Helper function to get color based on flux magnitude
const getFluxColor = (flux: number, gasType: 'co2' | 'n2o', allData: FluxCalculation[]) => {
  // Calculate dynamic range from actual data
  const gasFluxValues = allData.map(d => d[`${gasType}_flux`]).filter(v => !isNaN(v) && isFinite(v))
  const minFlux = Math.min(...gasFluxValues)
  const maxFlux = Math.max(...gasFluxValues)
  
  // Handle case where all values are the same
  if (maxFlux === minFlux) {
    return `hsl(120, 70%, 50%)` // Green for uniform data
  }
  
  // Normalize flux value to 0-1 range
  const normalized = Math.max(0, Math.min(1, (flux - minFlux) / (maxFlux - minFlux)))
  
  // Color gradient from blue (low flux) to red (high flux)
  const hue = (1 - normalized) * 240 // 240 is blue, 0 is red
  return `hsl(${hue}, 70%, 50%)`
}

// Helper function to get color for chamber
const getChamberColor = (chamber: number) => {
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#34495e', '#e67e22',
    '#8e44ad', '#16a085', '#27ae60', '#2980b9',
    '#c0392b', '#d35400', '#7f8c8d', '#2c3e50'
  ]
  return colors[(chamber - 1) % colors.length]
}

export default function FluxQualityCheck({ siteId }: FluxQualityCheckProps) {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  
  const [selectedGas, setSelectedGas] = useState<'co2' | 'n2o'>('co2')
  const [viewMode, setViewMode] = useState<'diurnal' | 'chamber' | 'correlation'>('diurnal')
  const [fluxRange, setFluxRange] = useState({
    min: '',
    max: '',
    enabled: false
  })

  // Get all calculated flux data
  const { data: fluxData, isLoading, refetch } = useQuery<FluxCalculation[]>({
    queryKey: ['allFluxCalculations', siteId, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })

      const response = await fetch(`/api/sites/${siteId}/flux-calculations?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch flux calculations')
      
      return response.json()
    },
    enabled: !!siteId,
  })

  // Prepare data for different visualizations
  const chartData = fluxData || []
  
  // Calculate flux range for current gas
  const currentGasFluxValues = chartData.map(d => d[`${selectedGas}_flux`]).filter(v => !isNaN(v) && isFinite(v))
  const defaultMinFlux = currentGasFluxValues.length > 0 ? Math.min(...currentGasFluxValues) : 0
  const defaultMaxFlux = currentGasFluxValues.length > 0 ? Math.max(...currentGasFluxValues) : 100
  
  // Filter data for correlation view based on flux range
  const correlationData = fluxRange.enabled && fluxRange.min !== '' && fluxRange.max !== '' 
    ? chartData.filter(d => {
        const flux = d[`${selectedGas}_flux`]
        const minVal = parseFloat(fluxRange.min)
        const maxVal = parseFloat(fluxRange.max)
        return flux >= minVal && flux <= maxVal
      })
    : chartData
  
  // Custom tooltip for scatter plots
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload
      const gasLabel = selectedGas === 'co2' ? 'CO₂' : 'N₂O'
      const fluxUnit = selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'
      
      // Get the actual flux and R² values from the data
      const fluxValue = data[`${selectedGas}_flux`]
      const r2Value = data[`${selectedGas}_r2`]
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg text-sm">
          <p className="font-medium text-gray-900">Chamber {data.chamber}</p>
          <p className="text-gray-600">Treatment: {data.treatment}</p>
          <p className="text-gray-600">Time: {data.measurement_start_time || new Date(data.datetime).toLocaleTimeString()}</p>
          <div className="border-t border-gray-200 mt-2 pt-2">
            <p className="text-blue-600 font-medium">{gasLabel} Flux: {fluxValue?.toFixed(2) || 'N/A'} {fluxUnit}</p>
            <p className="text-green-600 font-medium">R²: {r2Value?.toFixed(3) || 'N/A'}</p>
          </div>
          <p className="text-gray-500 text-xs mt-2">Date: {new Date(data.datetime).toLocaleDateString()}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-primary-600" />
          Quality Check Parameters
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Date Range */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Date Range</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Gas Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Gas Type</h3>
            <select
              value={selectedGas}
              onChange={(e) => setSelectedGas(e.target.value as 'co2' | 'n2o')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="co2">CO₂ (Carbon Dioxide)</option>
              <option value="n2o">N₂O (Nitrous Oxide)</option>
            </select>
          </div>

          {/* Apply Button */}
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
            >
              Load Flux Data
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedGas === 'co2' ? 'CO₂' : 'N₂O'} Flux Quality Analysis
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('diurnal')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'diurnal' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              (i) Diurnal R²
            </button>
            <button
              onClick={() => setViewMode('chamber')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'chamber' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              (ii) Chamber R²
            </button>
            <button
              onClick={() => setViewMode('correlation')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'correlation' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              (iii) R² vs Flux
            </button>
          </div>
        </div>

        {/* Charts */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading flux calculations...</p>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-[32rem]">
            {/* (i) Diurnal Pattern */}
            {viewMode === 'diurnal' && (
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-4">
                  Diurnal Pattern of R² Performance (Time of Day: 0:00-24:00)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Shows R² values plotted against time of day across all measurement dates. Color indicates flux magnitude.
                </p>
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart
                    data={chartData.map(entry => ({
                      ...entry,
                      time_decimal: (() => {
                        const time = new Date(entry.datetime)
                        return time.getHours() + time.getMinutes() / 60
                      })()
                    }))}
                    margin={{ top: 20, right: 30, bottom: 60, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number"
                      dataKey="time_decimal"
                      name="Time of Day"
                      label={{ value: 'Time of Day (hours)', position: 'insideBottom', offset: -40 }}
                      domain={[0, 24]}
                      ticks={[0, 4, 8, 12, 16, 20, 24]}
                      tickFormatter={(value) => `${Math.floor(value)}:${String(Math.floor((value % 1) * 60)).padStart(2, '0')}`}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      type="number"
                      dataKey={`${selectedGas}_r2`}
                      name="R²"
                      label={{ value: 'R² Value', angle: -90, position: 'insideLeft' }}
                      domain={[0, 1]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter
                      dataKey={`${selectedGas}_r2`}
                      name={`${selectedGas.toUpperCase()} R²`}
                      fill="#8884d8"
                      fillOpacity={0.7}
                      r={4}
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getFluxColor(entry[`${selectedGas}_flux`], selectedGas, chartData)} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-4">
                  <div className="text-sm text-gray-600 text-center mb-3">
                    Color scale: Blue = Low flux, Red = High flux • X-axis shows time of day (0:00-24:00)
                  </div>
                  {/* Flux Color Legend */}
                  {chartData.length > 0 && (() => {
                    const gasFluxValues = chartData.map(d => d[`${selectedGas}_flux`]).filter(v => !isNaN(v) && isFinite(v))
                    const minFlux = Math.min(...gasFluxValues)
                    const maxFlux = Math.max(...gasFluxValues)
                    const fluxUnit = selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'
                    
                    return (
                      <div className="flex items-center justify-center space-x-4 text-xs">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(240, 70%, 50%)' }}></div>
                          <span>Low: {minFlux.toFixed(2)} {fluxUnit}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(120, 70%, 50%)' }}></div>
                          <span>Mid: {((minFlux + maxFlux) / 2).toFixed(2)} {fluxUnit}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(0, 70%, 50%)' }}></div>
                          <span>High: {maxFlux.toFixed(2)} {fluxUnit}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* (ii) Chamber Pattern */}
            {viewMode === 'chamber' && (
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-4">
                  R² Performance by Chamber (Chambers 1-16)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Shows R² values for each chamber across all measurement dates. Color indicates flux magnitude.
                </p>
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart
                    data={chartData}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number"
                      dataKey="chamber"
                      name="Chamber"
                      label={{ value: 'Chamber Number', position: 'insideBottom', offset: -5 }}
                      domain={[0.5, 16.5]}
                      ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]}
                      tickFormatter={(value) => `C${String(value).padStart(2, '0')}`}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      type="number"
                      dataKey={`${selectedGas}_r2`}
                      name="R²"
                      label={{ value: 'R² Value', angle: -90, position: 'insideLeft' }}
                      domain={[0, 1]}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter
                      dataKey={`${selectedGas}_r2`}
                      name={`${selectedGas.toUpperCase()} R²`}
                      fill="#8884d8"
                      fillOpacity={0.7}
                      r={4}
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getFluxColor(entry[`${selectedGas}_flux`], selectedGas, chartData)} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-4">
                  <div className="text-sm text-gray-600 text-center mb-3">
                    Color scale: Blue = Low flux, Red = High flux • X-axis shows chamber numbers (C01-C16)
                  </div>
                  {/* Flux Color Legend */}
                  {chartData.length > 0 && (() => {
                    const gasFluxValues = chartData.map(d => d[`${selectedGas}_flux`]).filter(v => !isNaN(v) && isFinite(v))
                    const minFlux = Math.min(...gasFluxValues)
                    const maxFlux = Math.max(...gasFluxValues)
                    const fluxUnit = selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'
                    
                    return (
                      <div className="flex items-center justify-center space-x-4 text-xs mb-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(240, 70%, 50%)' }}></div>
                          <span>Low: {minFlux.toFixed(2)} {fluxUnit}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(120, 70%, 50%)' }}></div>
                          <span>Mid: {((minFlux + maxFlux) / 2).toFixed(2)} {fluxUnit}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(0, 70%, 50%)' }}></div>
                          <span>High: {maxFlux.toFixed(2)} {fluxUnit}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {/* (iii) R² vs Flux Correlation */}
            {viewMode === 'correlation' && (
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-4">
                  R² vs Flux Magnitude (colored by chamber)
                </h3>
                
                {/* Flux Range Controls */}
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={fluxRange.enabled}
                        onChange={(e) => setFluxRange(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700">Custom Flux Range</span>
                    </label>
                    
                    {fluxRange.enabled && (
                      <>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600">Min:</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={defaultMinFlux.toFixed(2)}
                            value={fluxRange.min}
                            onChange={(e) => setFluxRange(prev => ({ ...prev, min: e.target.value }))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-xs text-gray-500">{selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600">Max:</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={defaultMaxFlux.toFixed(2)}
                            value={fluxRange.max}
                            onChange={(e) => setFluxRange(prev => ({ ...prev, max: e.target.value }))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-xs text-gray-500">{selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'}</span>
                        </div>
                        
                        <button
                          onClick={() => setFluxRange({ min: '', max: '', enabled: false })}
                          className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Reset
                        </button>
                      </>
                    )}
                  </div>
                  
                  {fluxRange.enabled && (
                    <div className="mt-2 text-xs text-gray-600">
                      Showing {correlationData.length} of {chartData.length} data points
                      {fluxRange.min && fluxRange.max && (
                        <span> (flux range: {fluxRange.min} - {fluxRange.max} {selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'})</span>
                      )}
                    </div>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart
                    data={correlationData}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number"
                      dataKey={`${selectedGas}_flux`}
                      name="Flux"
                      label={{ 
                        value: `${selectedGas === 'co2' ? 'CO₂' : 'N₂O'} Flux (${selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'})`, 
                        position: 'insideBottom', 
                        offset: -5 
                      }}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.toFixed(2)}
                      domain={fluxRange.enabled && fluxRange.min !== '' && fluxRange.max !== '' 
                        ? [parseFloat(fluxRange.min), parseFloat(fluxRange.max)]
                        : ['dataMin', 'dataMax']
                      }
                    />
                    <YAxis 
                      type="number"
                      dataKey={`${selectedGas}_r2`}
                      name="R²"
                      label={{ value: 'R² Value', angle: -90, position: 'insideLeft' }}
                      domain={[0, 1]}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.toFixed(2)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter
                      name={`${selectedGas.toUpperCase()} Data`}
                      dataKey={`${selectedGas}_r2`}
                      fill="#8884d8"
                    >
                      {correlationData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getChamberColor(entry.chamber)} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(chamber => (
                    <div key={chamber} className="flex items-center space-x-1">
                      <div 
                        className="w-3 h-3 rounded" 
                        style={{ backgroundColor: getChamberColor(chamber) }}
                      />
                      <span className="text-xs text-gray-600">C{chamber}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No flux calculations available for the selected date range</p>
            <p className="text-sm text-gray-400 mt-2">Try adjusting the date range or ensure data has been processed</p>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      {chartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
            Quality Statistics Summary
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Total Calculations</p>
              <p className="text-2xl font-bold text-gray-900">{chartData.length}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">Average R²</p>
              <p className="text-2xl font-bold text-blue-700">
                {(chartData.reduce((sum, d) => sum + d[`${selectedGas}_r2`], 0) / chartData.length).toFixed(3)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">R² ≥ 0.6</p>
              <p className="text-2xl font-bold text-green-700">
                {chartData.filter(d => d[`${selectedGas}_r2`] >= 0.6).length}
              </p>
              <p className="text-xs text-green-600">
                {((chartData.filter(d => d[`${selectedGas}_r2`] >= 0.6).length / chartData.length) * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-600">R² &lt; 0.6</p>
              <p className="text-2xl font-bold text-yellow-700">
                {chartData.filter(d => d[`${selectedGas}_r2`] < 0.6).length}
              </p>
              <p className="text-xs text-yellow-600">
                {((chartData.filter(d => d[`${selectedGas}_r2`] < 0.6).length / chartData.length) * 100).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}