import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, AlertCircle, TrendingUp, BarChart3, Calculator } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ReferenceLine, Cell } from 'recharts'
import { Site } from '@/types'

interface DataFile {
  filename: string
  date: string
  time: string
  runId: string
  chambers: number[]
  recordCount: number
}

interface FluxRecord {
  datetime: string
  chamber: number
  co2_ppm: number
  n2o_ppb: number
  h2o_ppm: number
  status: string
}

interface ChamberData {
  chamber: number
  data: Array<{
    time_elapsed: number
    co2_ppm: number
    n2o_ppb: number
    h2o_ppm: number
    datetime: string
  }>
  start_time: string
  end_time: string
}

interface RegressionResult {
  slope: number
  intercept: number
  r_squared: number
  equation: string
  data_points: Array<{
    time_elapsed: number
    concentration: number
    included: boolean
  }>
}

interface IndividualFluxViewerProps {
  siteId: string
  site?: Site
}

export default function IndividualFluxViewer({ siteId }: IndividualFluxViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'chambers' | 'regression'>('overview')
  const [selectedGas, setSelectedGas] = useState<'co2' | 'n2o' | 'h2o'>('co2')
  const [selectedChamber, setSelectedChamber] = useState<number | null>(null)
  const [timeWindow, setTimeWindow] = useState({
    head: 200, // start time for analysis window (seconds)
    tail: 300  // end time for analysis window (seconds)
  })

  // Get available data files
  const { data: dataFiles, isLoading: filesLoading } = useQuery<DataFile[]>({
    queryKey: ['dataFiles', siteId],
    queryFn: async () => {
      const response = await fetch(`/api/sites/${siteId}/data-files`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch data files')
      return response.json()
    },
    enabled: !!siteId,
  })

  // Get individual file data
  const { data: fileData, isLoading: dataLoading } = useQuery<FluxRecord[]>({
    queryKey: ['fileData', siteId, selectedFile],
    queryFn: async () => {
      const response = await fetch(`/api/sites/${siteId}/raw-data?file=${selectedFile}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch file data')
      return response.json()
    },
    enabled: !!siteId && !!selectedFile,
  })

  // Auto-select first file when files load
  useEffect(() => {
    if (dataFiles && dataFiles.length > 0 && !selectedFile) {
      setSelectedFile(dataFiles[0].filename)
    }
  }, [dataFiles, selectedFile])

  // Process data for different visualizations
  const processedData = useMemo(() => {
    if (!fileData || fileData.length === 0) return null

    // Sort by datetime
    const sortedData = [...fileData].sort((a, b) => 
      new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    )

    // (i) Whole measurement cycle data
    const wholeSeriesData = sortedData.map((record, index) => ({
      ...record,
      time_elapsed: index + 1,
      displayTime: new Date(record.datetime).toLocaleTimeString(),
    }))

    // (ii) Chamber-separated data
    const chamberMap = new Map<number, ChamberData>()
    
    sortedData.forEach(record => {
      if (!chamberMap.has(record.chamber)) {
        chamberMap.set(record.chamber, {
          chamber: record.chamber,
          data: [],
          start_time: record.datetime,
          end_time: record.datetime
        })
      }
      
      const chamberData = chamberMap.get(record.chamber)!
      chamberData.data.push({
        time_elapsed: chamberData.data.length + 1,
        co2_ppm: record.co2_ppm,
        n2o_ppb: record.n2o_ppb,
        h2o_ppm: record.h2o_ppm,
        datetime: record.datetime
      })
      chamberData.end_time = record.datetime
    })

    const chamberDataArray = Array.from(chamberMap.values()).sort((a, b) => a.chamber - b.chamber)

    // Calculate gas concentration ranges for better axis scaling
    const gasRanges = {
      co2: { min: Infinity, max: -Infinity },
      n2o: { min: Infinity, max: -Infinity },
      h2o: { min: Infinity, max: -Infinity }
    }

    sortedData.forEach(record => {
      gasRanges.co2.min = Math.min(gasRanges.co2.min, record.co2_ppm)
      gasRanges.co2.max = Math.max(gasRanges.co2.max, record.co2_ppm)
      gasRanges.n2o.min = Math.min(gasRanges.n2o.min, record.n2o_ppb)
      gasRanges.n2o.max = Math.max(gasRanges.n2o.max, record.n2o_ppb)
      gasRanges.h2o.min = Math.min(gasRanges.h2o.min, record.h2o_ppm)
      gasRanges.h2o.max = Math.max(gasRanges.h2o.max, record.h2o_ppm)
    })

    // Add padding to ranges (5% margin)
    Object.values(gasRanges).forEach(range => {
      const padding = (range.max - range.min) * 0.05
      range.min = range.min - padding
      range.max = range.max + padding
    })

    // (iii) Combined chamber data for multi-chamber view
    const combinedChamberData: Array<{
      time_elapsed: number
      [key: string]: number
    }> = []

    // Get all unique time_elapsed values across all chambers
    const allTimePoints = new Set<number>()
    chamberDataArray.forEach(chamberData => {
      chamberData.data.forEach(point => {
        allTimePoints.add(point.time_elapsed)
      })
    })

    // Create combined data structure
    Array.from(allTimePoints).sort((a, b) => a - b).forEach(timePoint => {
      const dataPoint: any = { time_elapsed: timePoint }
      
      chamberDataArray.forEach(chamberData => {
        const point = chamberData.data.find(p => p.time_elapsed === timePoint)
        if (point) {
          dataPoint[`chamber_${chamberData.chamber}_co2`] = point.co2_ppm
          dataPoint[`chamber_${chamberData.chamber}_n2o`] = point.n2o_ppb
          dataPoint[`chamber_${chamberData.chamber}_h2o`] = point.h2o_ppm
        }
      })
      
      combinedChamberData.push(dataPoint)
    })

    return {
      wholeSeries: wholeSeriesData,
      chambers: chamberDataArray,
      combinedChamberData,
      availableChambers: chamberDataArray.map(c => c.chamber),
      gasRanges
    }
  }, [fileData])

  // Get backend linear regression analysis for all chambers
  const { data: allRegressionAnalysis, isLoading: regressionLoading } = useQuery({
    queryKey: ['allLinearRegression', siteId, selectedFile, selectedGas, timeWindow],
    queryFn: async () => {
      if (!processedData?.availableChambers) return []
      
      const regressionPromises = processedData.availableChambers.map(async (chamber) => {
        const response = await fetch(`/api/sites/${siteId}/linear-regression?file=${selectedFile}&chamber=${chamber}&gas=${selectedGas}&timeHead=${timeWindow.head}&timeTail=${timeWindow.tail}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
        })
        if (!response.ok) throw new Error(`Failed to fetch linear regression for chamber ${chamber}`)
        return response.json()
      })
      
      return await Promise.all(regressionPromises)
    },
    enabled: !!siteId && !!selectedFile && !!processedData?.availableChambers && viewMode === 'regression',
  })

  // Auto-select first chamber for regression analysis
  useEffect(() => {
    if (processedData && !selectedChamber && viewMode === 'regression') {
      setSelectedChamber(processedData.availableChambers[0])
    }
  }, [processedData, selectedChamber, viewMode])

  if (filesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading data files...</p>
        </div>
      </div>
    )
  }

  const gasConfig = {
    co2: { label: 'CO₂', unit: 'ppm', color: '#ef4444', dataKey: 'co2_ppm' },
    n2o: { label: 'N₂O', unit: 'ppb', color: '#22c55e', dataKey: 'n2o_ppb' },
    h2o: { label: 'H₂O', unit: 'ppm', color: '#3b82f6', dataKey: 'h2o_ppm' }
  }

  const currentGas = gasConfig[selectedGas]

  return (
    <div className="space-y-6">
      {/* File Selection */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-primary-600" />
          Data File Selection
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Available Data Files ({dataFiles?.length || 0})
            </label>
            <select
              value={selectedFile || ''}
              onChange={(e) => {
                setSelectedFile(e.target.value)
                setSelectedChamber(null) // Reset chamber selection
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select a data file...</option>
              {dataFiles?.map((file) => (
                <option key={file.filename} value={file.filename}>
                  {file.date} {file.time} - {file.chambers.length} chambers ({file.recordCount} records)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gas Selection
            </label>
            <select
              value={selectedGas}
              onChange={(e) => setSelectedGas(e.target.value as 'co2' | 'n2o' | 'h2o')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="co2">CO₂ (ppm)</option>
              <option value="n2o">N₂O (ppb)</option>
              <option value="h2o">H₂O (ppm)</option>
            </select>
          </div>
        </div>

        {selectedFile && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Run ID</p>
              <p className="font-medium">{dataFiles?.find(f => f.filename === selectedFile)?.runId}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Chambers</p>
              <p className="font-medium">{processedData?.availableChambers.length || 0}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Records</p>
              <p className="font-medium">{fileData?.length || 0}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Duration</p>
              <p className="font-medium">{Math.round((fileData?.length || 0) / 60)} min</p>
            </div>
          </div>
        )}
      </div>

      {/* View Mode Selection */}
      {selectedFile && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Visualization Mode</h2>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === 'overview'
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              (i) Whole Measurement Cycle
            </button>
            <button
              onClick={() => setViewMode('chambers')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === 'chambers'
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <BarChart3 className="w-4 h-4 inline mr-2" />
              (ii) Per-Chamber Analysis
            </button>
            <button
              onClick={() => setViewMode('regression')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                viewMode === 'regression'
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <Calculator className="w-4 h-4 inline mr-2" />
              (iii) Linear Regression
            </button>
          </div>

          {/* Regression Controls */}
          {viewMode === 'regression' && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Time (s) - Analysis window start
                </label>
                <input
                  type="number"
                  min="0"
                  value={timeWindow.head}
                  onChange={(e) => setTimeWindow(prev => ({ ...prev, head: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Time (s) - Analysis window end
                </label>
                <input
                  type="number"
                  min="0"
                  value={timeWindow.tail}
                  onChange={(e) => setTimeWindow(prev => ({ ...prev, tail: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Visualization */}
      {selectedFile && processedData && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {currentGas.label} Concentration Analysis ({currentGas.unit})
          </h2>

          {dataLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* (i) Whole Measurement Cycle */}
              {viewMode === 'overview' && (
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-4">
                    (i) {currentGas.label} Concentration Throughout Entire Measurement Cycle
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Showing {currentGas.label} concentration over time for all {processedData.availableChambers.length} chambers in sequence
                  </p>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={processedData.wholeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time_elapsed"
                        label={{ value: 'Time Elapsed (seconds)', position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        label={{ value: `${currentGas.label} (${currentGas.unit})`, angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => Math.round(value).toString()}
                        domain={[processedData.gasRanges[selectedGas].min, processedData.gasRanges[selectedGas].max]}
                      />
                      <Tooltip 
                        labelFormatter={(value) => `Time: ${value}s`}
                        formatter={(value: number) => [
                          `${value.toFixed(2)} ${currentGas.unit}`,
                          `${currentGas.label}`
                        ]}
                        contentStyle={{ fontSize: '12px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey={currentGas.dataKey}
                        stroke={currentGas.color}
                        strokeWidth={1.5}
                        dot={false}
                        name={currentGas.label}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* (ii) Per-Chamber Analysis */}
              {viewMode === 'chambers' && (
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-4">
                    (ii) {currentGas.label} Concentration by Chamber - All Chambers Combined
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    All chamber measurements displayed in one panel with different colors per chamber
                  </p>
                  <ResponsiveContainer width="100%" height={500}>
                    <LineChart data={processedData.combinedChamberData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="time_elapsed"
                        label={{ value: 'Time Elapsed (seconds)', position: 'insideBottom', offset: -5 }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        label={{ value: `${currentGas.label} (${currentGas.unit})`, angle: -90, position: 'insideLeft' }}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => Math.round(value).toString()}
                        domain={[processedData.gasRanges[selectedGas].min, processedData.gasRanges[selectedGas].max]}
                      />
                      <Tooltip 
                        labelFormatter={(value) => `Time: ${value}s`}
                        formatter={(value: number, name: string) => {
                          // Extract chamber number from name like "chamber_1_co2"
                          const match = name.match(/chamber_(\d+)_/)
                          const chamberNum = match ? match[1] : name
                          return [
                            `${value?.toFixed(2) || 'N/A'} ${currentGas.unit}`,
                            `Chamber ${chamberNum}`
                          ]
                        }}
                        contentStyle={{ fontSize: '12px' }}
                      />
                      {processedData.chambers.map((chamberData, index) => {
                        const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#f43f5e', '#8b5a2b', '#64748b', '#0ea5e9', '#a855f7']
                        const gasDataKey = `chamber_${chamberData.chamber}_${selectedGas === 'co2' ? 'co2' : selectedGas === 'n2o' ? 'n2o' : 'h2o'}`
                        
                        return (
                          <Line
                            key={chamberData.chamber}
                            type="monotone"
                            dataKey={gasDataKey}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2}
                            dot={{ r: 1, fill: colors[index % colors.length], fillOpacity: 0.7 }}
                            name={gasDataKey}
                            connectNulls={false}
                          />
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Legend</h4>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-xs">
                      {processedData.chambers.map((chamberData, index) => {
                        const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#f43f5e', '#8b5a2b', '#64748b', '#0ea5e9', '#a855f7']
                        return (
                          <div key={chamberData.chamber} className="flex items-center">
                            <div 
                              className="w-3 h-3 rounded mr-1" 
                              style={{ backgroundColor: colors[index % colors.length] }}
                            ></div>
                            <span>C{chamberData.chamber}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* (iii) Linear Regression Analysis */}
              {viewMode === 'regression' && (
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-4">
                    (iii) Linear Regression Analysis - All Chambers
                  </h3>
                  
                  {regressionLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : allRegressionAnalysis && allRegressionAnalysis.length > 0 ? (
                    <>
                      {/* Regression Summary for All Chambers */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-blue-900 mb-3">Backend Linear Regression Results - All Chambers</h4>
                        <div className="max-h-60 overflow-y-auto">
                          <div className="grid grid-cols-1 gap-3">
                            {allRegressionAnalysis.map((regression: any, index: number) => {
                              const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#f43f5e', '#8b5a2b', '#64748b', '#0ea5e9', '#a855f7']
                              return (
                                <div key={regression.chamber} className="border border-blue-300 rounded p-3 bg-white">
                                  <div className="flex items-center mb-2">
                                    <div 
                                      className="w-3 h-3 rounded mr-2" 
                                      style={{ backgroundColor: colors[index % colors.length] }}
                                    ></div>
                                    <h5 className="font-medium text-blue-900">Chamber {regression.chamber}</h5>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div>
                                      <span className="text-blue-700 font-medium">Slope:</span>
                                      <p className="font-mono text-blue-900">{regression.regression.slope.toFixed(6)} {currentGas.unit}/s</p>
                                    </div>
                                    <div>
                                      <span className="text-blue-700 font-medium">R²:</span>
                                      <p className="font-mono text-blue-900">{regression.regression.r_squared.toFixed(4)}</p>
                                    </div>
                                    {regression.flux_rate && (
                                      <div>
                                        <span className="text-blue-700 font-medium">Flux:</span>
                                        <p className="font-mono text-blue-900">{regression.flux_rate.toFixed(2)} {regression.flux_units}</p>
                                      </div>
                                    )}
                                    <div>
                                      <span className="text-blue-700 font-medium">Points:</span>
                                      <p className="font-mono text-blue-900">{regression.measurement_window.points_used}/{regression.measurement_window.total_points}</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-blue-700">
                          Analysis window: {timeWindow.head}s to {timeWindow.tail}s
                        </div>
                      </div>

                      {/* Combined Regression Plot */}
                      <ResponsiveContainer width="100%" height={500}>
                        <ScatterChart
                          data={(() => {
                            // Combine all data points from all chambers into a single array
                            const allPoints: any[] = []
                            allRegressionAnalysis.forEach((regression: any) => {
                              regression.regression.data_points
                                .filter((p: any) => p.x >= timeWindow.head && p.x <= timeWindow.tail)
                                .forEach((point: any) => {
                                  allPoints.push({
                                    x: point.x,
                                    y: point.y,
                                    chamber: regression.chamber,
                                    included: point.included
                                  })
                                })
                            })
                            return allPoints
                          })()}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            type="number"
                            dataKey="x"
                            label={{ value: 'Time Elapsed (seconds)', position: 'insideBottom', offset: -5 }}
                            tick={{ fontSize: 12 }}
                            domain={[timeWindow.head, timeWindow.tail]}
                          />
                          <YAxis 
                            type="number"
                            dataKey="y"
                            label={{ value: `${currentGas.label} (${currentGas.unit})`, angle: -90, position: 'insideLeft' }}
                            tick={{ fontSize: 12 }}
                            tickFormatter={(value) => Math.round(value).toString()}
                            domain={[processedData.gasRanges[selectedGas].min, processedData.gasRanges[selectedGas].max]}
                          />
                          <Tooltip 
                            labelFormatter={(value) => `Time: ${value}s`}
                            formatter={(value: number, name, props: any) => [
                              `${value?.toFixed(2) || 'N/A'} ${currentGas.unit}`,
                              `Chamber ${props.payload?.chamber || 'Unknown'}`
                            ]}
                            contentStyle={{ fontSize: '12px' }}
                          />
                          
                          {/* Single scatter plot with all points, colored by chamber */}
                          <Scatter
                            dataKey="y"
                            fill="#8884d8"
                            fillOpacity={0.7}
                            r={1}
                          >
                            {(() => {
                              const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#f43f5e', '#8b5a2b', '#64748b', '#0ea5e9', '#a855f7']
                              let pointIndex = 0
                              const cells: any[] = []
                              
                              allRegressionAnalysis.forEach((regression: any) => {
                                const chamberIndex = allRegressionAnalysis.findIndex((r: any) => r.chamber === regression.chamber)
                                const color = colors[chamberIndex % colors.length]
                                const pointsCount = regression.regression.data_points.filter((p: any) => p.x >= timeWindow.head && p.x <= timeWindow.tail).length
                                
                                for (let i = 0; i < pointsCount; i++) {
                                  cells.push(
                                    <Cell key={`cell-${pointIndex}`} fill={color} />
                                  )
                                  pointIndex++
                                }
                              })
                              
                              return cells
                            })()}
                          </Scatter>
                          
                          {/* Regression lines for each chamber */}
                          {allRegressionAnalysis.map((regression: any, index: number) => {
                            const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#f43f5e', '#8b5a2b', '#64748b', '#0ea5e9', '#a855f7']
                            const color = colors[index % colors.length]
                            
                            return regression.regression.slope ? (
                              <ReferenceLine 
                                key={`line-${regression.chamber}`}
                                segment={[
                                  { 
                                    x: timeWindow.head, 
                                    y: regression.regression.slope * timeWindow.head + regression.regression.intercept 
                                  },
                                  { 
                                    x: timeWindow.tail, 
                                    y: regression.regression.slope * timeWindow.tail + regression.regression.intercept 
                                  }
                                ]}
                                stroke={color}
                                strokeWidth={3}
                                strokeDasharray="5 5"
                              />
                            ) : null
                          })}
                        </ScatterChart>
                      </ResponsiveContainer>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No regression data available
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No Data State */}
      {selectedFile && (!processedData || processedData.wholeSeries.length === 0) && !dataLoading && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No data available for the selected file</p>
          </div>
        </div>
      )}
    </div>
  )
}