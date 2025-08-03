import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Settings, BarChart3, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar } from 'recharts'
import { Site } from '@/types'

interface QualityControlCriteria {
  co2_r2_min: number
  n2o_r2_min: number
  n2o_flux_min: number
  time_head: number
  time_tail: number
}

interface DailyTreatmentFlux {
  date: string
  treatment: string
  co2_flux_mean: number
  co2_flux_se: number
  n2o_flux_mean: number
  n2o_flux_se: number
  chamber_count: number
}

interface CumulativeTreatmentFlux {
  date: string
  treatment: string
  co2_flux_cumulative_mean: number
  co2_flux_cumulative_se: number
  n2o_flux_cumulative_mean: number
  n2o_flux_cumulative_se: number
  chamber_count: number
}

interface DailyCumulativeApiResponse {
  daily: DailyTreatmentFlux[]
  cumulative: CumulativeTreatmentFlux[]
  metadata: {
    total_interpolated_points: number
    daily_chamber_points: number
    measPerDay: number
    date_range: { startDate: string; endDate: string }
  }
}

interface TreatmentSummary {
  date: string
  dateNum: number // for chart x-axis
  [key: string]: any // treatment data will be added dynamically
}

interface DailyCumulativeFluxProps {
  siteId: string
  site?: Site
  qualityCriteria?: QualityControlCriteria
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


export default function DailyCumulativeFlux({ siteId, site, qualityCriteria: inheritedQualityCriteria }: DailyCumulativeFluxProps) {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0]
  })
  
  const [viewMode, setViewMode] = useState<'daily' | 'cumulative'>('daily')
  const [selectedGas, setSelectedGas] = useState<'co2' | 'n2o'>('co2')
  
  // Use inherited quality criteria from section (c), fallback to site defaults if not provided
  const qualityCriteria = inheritedQualityCriteria || {
    co2_r2_min: site?.qualityThresholds?.co2_r2_min || 0.6,
    n2o_r2_min: site?.qualityThresholds?.n2o_r2_min || 0.6,
    n2o_flux_min: site?.qualityThresholds?.n2o_flux_min || -5,
    time_head: 200,
    time_tail: 300
  }

  // Get daily/cumulative flux data using the new processing pipeline
  const { data: fluxData, isLoading } = useQuery<DailyCumulativeApiResponse>({
    queryKey: ['dailyCumulativeFlux', siteId, dateRange, qualityCriteria],
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

      const response = await fetch(`/api/sites/${siteId}/daily-cumulative-flux?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch daily cumulative flux data')
      
      return response.json()
    },
    enabled: !!siteId,
  })

  // Process data for chart display
  const chartData: TreatmentSummary[] = []
  let treatments: string[] = []
  
  if (fluxData) {
    const sourceData = viewMode === 'daily' ? fluxData.daily : fluxData.cumulative
    treatments = [...new Set(sourceData.map(d => d.treatment))]
    const dates = [...new Set(sourceData.map(d => d.date))].sort()
    
    dates.forEach((date, index) => {
      const dateEntry: TreatmentSummary = {
        date,
        dateNum: index
      }
      
      treatments.forEach(treatment => {
        const dayData = sourceData.find(d => d.date === date && d.treatment === treatment)
        
        if (dayData) {
          if (viewMode === 'daily') {
            const data = dayData as DailyTreatmentFlux
            dateEntry[`${treatment}_${selectedGas}`] = selectedGas === 'co2' ? data.co2_flux_mean : data.n2o_flux_mean
            dateEntry[`${treatment}_${selectedGas}_se`] = selectedGas === 'co2' ? data.co2_flux_se : data.n2o_flux_se
          } else {
            const data = dayData as CumulativeTreatmentFlux
            dateEntry[`${treatment}_${selectedGas}`] = selectedGas === 'co2' ? data.co2_flux_cumulative_mean : data.n2o_flux_cumulative_mean
            dateEntry[`${treatment}_${selectedGas}_se`] = selectedGas === 'co2' ? data.co2_flux_cumulative_se : data.n2o_flux_cumulative_se
          }
        }
      })
      
      chartData.push(dateEntry)
    })
  }
  const gasLabel = selectedGas === 'co2' ? 'CO₂' : 'N₂O'
  const gasUnit = selectedGas === 'co2' ? 'kg C/ha/d' : 'g N/ha/d'

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="w-5 h-5 mr-2 text-primary-600" />
          Daily/Cumulative Analysis Parameters
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


          {/* Analysis Controls */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Analysis Controls</h3>
            <div className="space-y-3">
              {/* Gas Selection */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Gas Type</label>
                <select
                  value={selectedGas}
                  onChange={(e) => setSelectedGas(e.target.value as 'co2' | 'n2o')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="co2">CO₂ (Carbon Dioxide)</option>
                  <option value="n2o">N₂O (Nitrous Oxide)</option>
                </select>
              </div>
              
              {/* Analysis Type */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Analysis Type</label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setViewMode('daily')}
                    className={`px-3 py-2 text-sm rounded-md transition-colors flex-1 ${
                      viewMode === 'daily'
                        ? 'bg-primary-100 text-primary-700 border border-primary-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setViewMode('cumulative')}
                    className={`px-3 py-2 text-sm rounded-md transition-colors flex-1 ${
                      viewMode === 'cumulative'
                        ? 'bg-primary-100 text-primary-700 border border-primary-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
                    }`}
                  >
                    Cumulative
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Processing Pipeline Info */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">Data Processing Pipeline</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>
              <Calendar className="inline w-4 h-4 mr-1" />
              <strong>Step 1:</strong> Linear interpolation per chamber between measurement cycles (run IDs) at {site?.chamberSpecs?.measPerDay || 6} points/day
            </p>
            <p>
              <strong>Step 2:</strong> Daily flux per chamber by averaging across interpolated measurement cycles
            </p>
            <p>
              <strong>Step 3:</strong> Treatment statistics calculated as mean ± SE across chamber replicates per day
            </p>
            <p>
              <strong>Cumulative:</strong> Daily flux accumulated per chamber, then treatment mean ± SE calculated
            </p>
            <p className="mt-2 text-xs">
              {inheritedQualityCriteria ? (
                <span className="text-green-700">
                  ✓ Quality criteria inherited from section (c): CO₂ R² ≥ {qualityCriteria.co2_r2_min}, N₂O R² ≥ {qualityCriteria.n2o_r2_min}, 
                  Time window: {qualityCriteria.time_head}s-{qualityCriteria.time_tail}s
                </span>
              ) : (
                <span className="text-orange-700">
                  ⚠ Using default quality criteria (set criteria in section c first): CO₂ R² ≥ {qualityCriteria.co2_r2_min}, N₂O R² ≥ {qualityCriteria.n2o_r2_min}, 
                  Time window: {qualityCriteria.time_head}s-{qualityCriteria.time_tail}s
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Visualization */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {viewMode === 'daily' ? 'Daily' : 'Cumulative'} {gasLabel} Flux by Treatment
          </h2>
          <div className="text-sm text-gray-600">
            Error bars show ± standard error
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Processing {viewMode} flux data...</p>
            </div>
          </div>
        ) : chartData.length > 0 ? (
          <div className="space-y-6">
            {/* Main Chart */}
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  label={{ value: 'Date', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ 
                    value: `${gasLabel} Flux (${gasUnit})${viewMode === 'cumulative' ? ' - Cumulative' : ''}`, 
                    angle: -90, 
                    position: 'insideLeft' 
                  }}
                />
                <Tooltip 
                  labelFormatter={(value) => `Date: ${new Date(value).toLocaleDateString()}`}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)} ± ${chartData[0]?.[`${name.split('_')[0]}_${selectedGas}_se`]?.toFixed(2) || '0'} ${gasUnit}`,
                    name.split('_')[0]
                  ]}
                />
                
                {/* Treatment Lines with Error Bars */}
                {treatments.map(treatment => (
                  <Line
                    key={treatment}
                    type="linear"
                    dataKey={`${treatment}_${selectedGas}`}
                    stroke={getTreatmentColor(treatment)}
                    strokeWidth={3}
                    name={treatment}
                    dot={{ r: 4 }}
                    connectNulls={false}
                  >
                    <ErrorBar 
                      dataKey={`${treatment}_${selectedGas}_se`} 
                      width={4}
                      stroke={getTreatmentColor(treatment)}
                      strokeWidth={1.5}
                    />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* Treatment Legend */}
            <div className="flex justify-center">
              <div className="flex flex-wrap gap-4">
                {treatments.map(treatment => (
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
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No {viewMode} flux data available</p>
              <p className="text-sm text-gray-400 mt-2">Check date range and ensure data has passed quality control</p>
            </div>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      {fluxData && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
            Treatment Summary Statistics
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {treatments.map(treatment => {
              const sourceData = viewMode === 'daily' ? fluxData.daily : fluxData.cumulative
              const treatmentData = sourceData.filter(d => d.treatment === treatment)
              
              let avgValue = 0
              if (treatmentData.length > 0) {
                if (viewMode === 'daily') {
                  const dailyData = treatmentData as DailyTreatmentFlux[]
                  avgValue = selectedGas === 'co2' 
                    ? dailyData.reduce((sum, d) => sum + d.co2_flux_mean, 0) / dailyData.length
                    : dailyData.reduce((sum, d) => sum + d.n2o_flux_mean, 0) / dailyData.length
                } else {
                  const cumulativeData = treatmentData as CumulativeTreatmentFlux[]
                  const lastData = cumulativeData[cumulativeData.length - 1]
                  avgValue = selectedGas === 'co2' ? lastData.co2_flux_cumulative_mean : lastData.n2o_flux_cumulative_mean
                }
              }
              
              return (
                <div key={treatment} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <div 
                      className="w-4 h-3 rounded"
                      style={{ backgroundColor: getTreatmentColor(treatment) }}
                    />
                    <p className="font-medium text-gray-800">{treatment}</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {avgValue.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-600">
                    {viewMode === 'daily' ? 'Avg Daily' : 'Total Cumulative'} {gasUnit}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {treatmentData.length} days of data
                  </p>
                </div>
              )
            })}
          </div>
          
          {/* Processing Metadata */}
          {fluxData.metadata && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
              <p>Processed {fluxData.metadata.total_interpolated_points} interpolated data points</p>
              <p>Generated {fluxData.metadata.daily_chamber_points} daily chamber measurements</p>
              <p>Interpolation rate: {fluxData.metadata.measPerDay} measurements per day</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}