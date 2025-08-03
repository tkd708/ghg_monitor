import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Clock, Settings, BarChart3 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar } from 'recharts'
import { Site } from '@/types'

interface QualityControlCriteria {
  co2_r2_min: number
  n2o_r2_min: number
  n2o_flux_min: number
  time_head: number
  time_tail: number
}

interface FilteredFluxData {
  datetime: string
  run_id: string
  measurement_start_time: string // HH:MM format
  chamber: number
  treatment: string
  co2_flux: number
  n2o_flux: number
  h2o_avg: number
  co2_r2: number
  n2o_r2: number
  passed_qc: boolean
}

// DiurnalAverage interface removed - no longer needed

interface TreatmentTimePoint {
  datetime: string
  run_id: string
  timestamp: number
  treatment: string
  co2_flux_mean: number
  co2_flux_se: number
  n2o_flux_mean: number
  n2o_flux_se: number
  h2o_avg_mean: number
  h2o_avg_se: number
  replicate_count: number
  chamber_list: number[]
}

interface SubdailyFluxDynamicsProps {
  siteId: string
  site?: Site
  onQualityCriteriaChange?: (criteria: QualityControlCriteria) => void
}

// Helper function to get treatment color
const getTreatmentColor = (treatment: string) => {
  const colors: Record<string, string> = {
    'N0': '#6b7280',      // Gray for control
    'N200': '#3b82f6',    // Blue for standard N
    'eNPower': '#10b981', // Green for enhanced efficiency
    'Centuro': '#f59e0b'  // Amber for nitrification inhibitor
  }
  return colors[treatment] || '#64748b'
}

// Helper function to calculate mean
const calculateMean = (values: number[]): number => {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

// Helper function to calculate standard error
const calculateStandardError = (values: number[]): number => {
  if (values.length <= 1) return 0
  const mean = calculateMean(values)
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1)
  return Math.sqrt(variance / values.length)
}

export default function SubdailyFluxDynamics({ siteId, site, onQualityCriteriaChange }: SubdailyFluxDynamicsProps) {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  const [qualityCriteria, setQualityCriteria] = useState<QualityControlCriteria>({
    co2_r2_min: site?.qualityThresholds?.co2_r2_min || 0.6,
    n2o_r2_min: site?.qualityThresholds?.n2o_r2_min || 0.6,
    n2o_flux_min: site?.qualityThresholds?.n2o_flux_min || -5,
    time_head: 200,
    time_tail: 300
  })

  // Only time-series view mode - diurnal averages removed as requested
  const [selectedGas, setSelectedGas] = useState<'co2' | 'n2o'>('co2')

  // Notify parent component when quality criteria change
  useEffect(() => {
    if (onQualityCriteriaChange) {
      onQualityCriteriaChange(qualityCriteria)
    }
  }, [qualityCriteria, onQualityCriteriaChange])

  // Get filtered flux data
  const { data: fluxData, isLoading, refetch } = useQuery<FilteredFluxData[]>({
    queryKey: ['filteredFluxData', siteId, dateRange, qualityCriteria],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        co2_r2_min: qualityCriteria.co2_r2_min.toString(),
        n2o_r2_min: qualityCriteria.n2o_r2_min.toString(),
        n2o_flux_min: qualityCriteria.n2o_flux_min.toString(),
        time_head: qualityCriteria.time_head.toString(),
        time_tail: qualityCriteria.time_tail.toString()
      })

      const response = await fetch(`/api/sites/${siteId}/filtered-flux?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch filtered flux data')
      
      return response.json()
    },
    enabled: !!siteId,
  })

  // Diurnal averages section removed as requested

  // Calculate treatment statistics by run_id (mean and SE across replicates)
  const treatmentTimePoints: TreatmentTimePoint[] = []
  
  if (fluxData) {
    // Group data by treatment and run_id (measurement cycle)
    const treatmentRunGroups = new Map<string, FilteredFluxData[]>()
    
    fluxData.forEach(d => {
      const key = `${d.treatment}_${d.run_id}`
      if (!treatmentRunGroups.has(key)) {
        treatmentRunGroups.set(key, [])
      }
      treatmentRunGroups.get(key)!.push(d)
    })
    
    // Calculate statistics for each treatment-run_id combination
    treatmentRunGroups.forEach((dataPoints, key) => {
      const parts = key.split('_')
      const treatment = parts[0]
      const runId = parts.slice(1).join('_') // Rejoin in case run_id contains underscores
      
      // Use the datetime from the first data point as the measurement cycle start time
      const datetime = dataPoints[0].datetime
      
      // Extract values for statistical calculation
      const co2FluxValues = dataPoints.map(d => d.co2_flux)
      const n2oFluxValues = dataPoints.map(d => d.n2o_flux)
      const h2oValues = dataPoints.map(d => d.h2o_avg)
      const chambers = dataPoints.map(d => d.chamber)
      
      treatmentTimePoints.push({
        datetime,
        run_id: runId,
        timestamp: new Date(datetime).getTime(),
        treatment,
        co2_flux_mean: calculateMean(co2FluxValues),
        co2_flux_se: calculateStandardError(co2FluxValues),
        n2o_flux_mean: calculateMean(n2oFluxValues),
        n2o_flux_se: calculateStandardError(n2oFluxValues),
        h2o_avg_mean: calculateMean(h2oValues),
        h2o_avg_se: calculateStandardError(h2oValues),
        replicate_count: dataPoints.length,
        chamber_list: chambers.sort((a, b) => a - b)
      })
    })
    
    // Sort by timestamp
    treatmentTimePoints.sort((a, b) => a.timestamp - b.timestamp)
  }

  // Group treatment time points by treatment for charting
  const treatmentStatGroups = treatmentTimePoints.reduce((acc, point) => {
    if (!acc[point.treatment]) acc[point.treatment] = []
    acc[point.treatment].push(point)
    return acc
  }, {} as Record<string, TreatmentTimePoint[]>)

  // Get unique data for UI
  const uniqueTreatments = Object.keys(treatmentStatGroups)

  // Create combined dataset with all treatments at each timestamp for proper alignment
  const chartData: any[] = []
  if (treatmentTimePoints.length > 0) {
    // Get all unique timestamps
    const timestamps = [...new Set(treatmentTimePoints.map(p => p.timestamp))].sort()
    
    timestamps.forEach(timestamp => {
      const dataPoint: any = { timestamp }
      
      uniqueTreatments.forEach(treatment => {
        const point = treatmentTimePoints.find(p => p.timestamp === timestamp && p.treatment === treatment)
        if (point) {
          dataPoint[`${treatment}_${selectedGas}_mean`] = selectedGas === 'co2' ? point.co2_flux_mean : point.n2o_flux_mean
          dataPoint[`${treatment}_${selectedGas}_se`] = selectedGas === 'co2' ? point.co2_flux_se : point.n2o_flux_se
          dataPoint[`${treatment}_replicate_count`] = point.replicate_count
          dataPoint[`${treatment}_datetime`] = point.datetime
        }
      })
      
      chartData.push(dataPoint)
    })
  }

  return (
    <div className="space-y-6">
      {/* Quality Control Criteria */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-primary-600" />
          Quality Control Criteria
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Date Range */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Date Range Selection</h3>
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

          {/* Quality Thresholds */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Quality Thresholds</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min CO₂ R²</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={qualityCriteria.co2_r2_min}
                  onChange={(e) => setQualityCriteria(prev => ({ ...prev, co2_r2_min: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min N₂O R²</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={qualityCriteria.n2o_r2_min}
                  onChange={(e) => setQualityCriteria(prev => ({ ...prev, n2o_r2_min: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min N₂O Flux</label>
                <input
                  type="number"
                  step="0.1"
                  value={qualityCriteria.n2o_flux_min}
                  onChange={(e) => setQualityCriteria(prev => ({ ...prev, n2o_flux_min: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Time Head (s)</label>
                <input
                  type="number"
                  min="0"
                  value={qualityCriteria.time_head}
                  onChange={(e) => setQualityCriteria(prev => ({ ...prev, time_head: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Time Tail (s)</label>
                <input
                  type="number"
                  min="0"
                  value={qualityCriteria.time_tail}
                  onChange={(e) => setQualityCriteria(prev => ({ ...prev, time_tail: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => refetch()}
                  className="w-full px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Subdaily Flux Dynamics
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Treatment means ± standard error across replicates over time
          </p>
        </div>

        {/* Charts */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading filtered flux data...</p>
            </div>
          </div>
        ) : fluxData && fluxData.length > 0 ? (
          <div>
            {/* Time-Series Dynamics */}
              <div className="space-y-6">
                <h3 className="text-md font-medium text-gray-700">
                  Flux dynamics over time (filtered by quality criteria) - {dateRange.startDate} to {dateRange.endDate}
                </h3>
                
                {/* Gas Selection */}
                <div className="flex items-center space-x-4 mb-4">
                  <label className="text-sm font-medium text-gray-700">Gas Type:</label>
                  <select
                    value={selectedGas}
                    onChange={(e) => setSelectedGas(e.target.value as 'co2' | 'n2o')}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="co2">CO₂ Flux</option>
                    <option value="n2o">N₂O Flux</option>
                  </select>
                </div>

                {/* Time-Series Chart by Treatment */}
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">
                    {selectedGas === 'co2' ? 'CO₂ Flux (kg C/ha/d)' : 'N₂O Flux (g N/ha/d)'} by Treatment
                  </h4>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={chartData}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(timestamp) => {
                          const date = new Date(timestamp)
                          return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
                        }}
                        label={{ 
                          value: 'Date/Time', 
                          position: 'insideBottom', 
                          offset: -5 
                        }}
                        tick={{ fontSize: 11 }}
                        allowDataOverflow={false}
                      />
                      <YAxis 
                        label={{ 
                          value: selectedGas === 'co2' ? 'CO₂ Flux (kg C/ha/d)' : 'N₂O Flux (g N/ha/d)', 
                          angle: -90, 
                          position: 'insideLeft' 
                        }}
                        tickFormatter={(value) => value.toFixed(2)}
                      />
                      <Tooltip 
                        labelFormatter={(timestamp) => {
                          const date = new Date(timestamp)
                          return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
                        }}
                        formatter={(value: number, name: string, props: any) => {
                          const payload = props.payload
                          const treatment = name // treatment name from Line component
                          const seValue = payload[`${treatment}_${selectedGas}_se`]
                          const sampleCount = payload[`${treatment}_replicate_count`]
                          const gasUnit = selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'
                          
                          return [
                            `${value.toFixed(2)} ± ${seValue?.toFixed(2) || '0'} ${gasUnit}\n(n=${sampleCount || 0})`,
                            treatment
                          ]
                        }}
                      />
                      {uniqueTreatments.map(treatment => {
                        return (
                          <Line
                            key={`line-${treatment}`}
                            type="linear"
                            dataKey={`${treatment}_${selectedGas}_mean`}
                            stroke={getTreatmentColor(treatment)}
                            strokeWidth={2}
                            dot={{
                              r: 2,
                              fill: getTreatmentColor(treatment),
                              stroke: getTreatmentColor(treatment),
                              strokeWidth: 1,
                              fillOpacity: 0.7,
                              strokeOpacity: 0.7
                            }}
                            name={treatment}
                            connectNulls={false}
                          >
                            <ErrorBar 
                              dataKey={`${treatment}_${selectedGas}_se`} 
                              width={4}
                              stroke={getTreatmentColor(treatment)}
                              strokeWidth={1.5}
                            />
                          </Line>
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                  
                  {/* Treatment Legend */}
                  <div className="mt-4 flex justify-center">
                    <div className="flex flex-wrap gap-4">
                      {uniqueTreatments.map(treatment => (
                        <div key={treatment} className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-3 rounded"
                            style={{ backgroundColor: getTreatmentColor(treatment) }}
                          />
                          <span className="text-sm font-medium text-gray-700">{treatment}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Statistical Summary Info */}
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-600">
                  <p>Showing {treatmentTimePoints.length} time points with treatment means ± standard error across {uniqueTreatments.length} treatments</p>
                  <p>Based on {fluxData?.length || 0} quality-filtered flux measurements from chambers with replicates</p>
                  <p>Date range: {dateRange.startDate} to {dateRange.endDate}</p>
                  {treatmentTimePoints.length > 0 && (
                    <p className="mt-1">
                      Replicate counts per time point: {Math.min(...treatmentTimePoints.map(p => p.replicate_count))} - {Math.max(...treatmentTimePoints.map(p => p.replicate_count))} chambers
                    </p>
                  )}
                </div>
              </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No data passed quality control criteria</p>
              <p className="text-sm text-gray-400 mt-2">Try adjusting the quality thresholds</p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      {fluxData && fluxData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
            Filtered Data Summary
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">Filtered Records</p>
              <p className="text-2xl font-bold text-blue-700">{fluxData.length}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">Avg CO₂ Flux</p>
              <p className="text-2xl font-bold text-green-700">
                {(fluxData.reduce((sum, d) => sum + d.co2_flux, 0) / fluxData.length).toFixed(2)}
              </p>
              <p className="text-xs text-green-600">kg C/ha/d</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-600">Avg N₂O Flux</p>
              <p className="text-2xl font-bold text-yellow-700">
                {(fluxData.reduce((sum, d) => sum + d.n2o_flux, 0) / fluxData.length).toFixed(2)}
              </p>
              <p className="text-xs text-yellow-600">g N/ha/d</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600">Avg H₂O</p>
              <p className="text-2xl font-bold text-purple-700">
                {Math.round(fluxData.reduce((sum, d) => sum + d.h2o_avg, 0) / fluxData.length)}
              </p>
              <p className="text-xs text-purple-600">ppm</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}