import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Plus, Settings, AlertCircle, Download, FileText } from 'lucide-react'
import { ChamberConfig, Site } from '@/types'
import { useSite } from '@/context/SiteContext'

export default function ChamberConfigPage() {
  const { siteId } = useParams<{ siteId: string }>()
  const { currentSite } = useSite()
  const queryClient = useQueryClient()
  const [configs, setConfigs] = useState<ChamberConfig[]>([])
  const [numberOfChambers, setNumberOfChambers] = useState(16)
  const [availableTreatments, setAvailableTreatments] = useState<string[]>([])
  const [treatmentNRates, setTreatmentNRates] = useState<Record<string, number>>({})
  const [chamberSpecs, setChamberSpecs] = useState({
    length: 20,
    width: 40,
    height: 15,
    measPerDay: 6,
    hasVent: false,
    hasFan: false
  })

  // Load site data to get current chamber configs
  const { data: site, isLoading, error } = useQuery<Site>({
    queryKey: ['site', siteId],
    queryFn: async () => {
      const response = await fetch(`/api/sites/${siteId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch site')
      return response.json()
    },
    enabled: !!siteId,
  })

  // Initialize state when site data loads
  useEffect(() => {
    if (site) {
      setNumberOfChambers(site.chambers)
      
      // Extract treatment names and N-rates
      const treatments = site.treatments.map(t => t.name)
      setAvailableTreatments(treatments)
      
      // Extract N-rates for treatments
      const nrates: Record<string, number> = {}
      site.treatments.forEach(treatment => {
        nrates[treatment.name] = treatment.nrate || 0
      })
      setTreatmentNRates(nrates)

      // Load chamber specifications
      if (site.chamberSpecs) {
        setChamberSpecs({
          length: site.chamberSpecs.length || 20,
          width: site.chamberSpecs.width || 40,
          height: site.chamberSpecs.height || 15,
          measPerDay: site.chamberSpecs.measPerDay || site.chamberSpecs.measPerDay || 6,
          hasVent: site.chamberSpecs.hasVent || false,
          hasFan: site.chamberSpecs.hasFan || false
        })
      }
      
      // Initialize chamber configs
      if (site.chamberConfigs && site.chamberConfigs.length > 0) {
        setConfigs(site.chamberConfigs)
      } else {
        // Generate default configs from existing treatments data
        const defaultConfigs: ChamberConfig[] = []
        site.treatments.forEach((treatment) => {
          treatment.chambers.forEach((chamberNum, chamberIndex) => {
            defaultConfigs.push({
              chamber: chamberNum,
              plot: chamberNum, // Default plot = chamber
              treatment: treatment.name,
              replicate: chamberIndex + 1,
              nrate: treatment.nrate || 0,
            })
          })
        })
        setConfigs(defaultConfigs)
      }
    }
  }, [site])

  // Save chamber configuration
  const saveMutation = useMutation({
    mutationFn: async (configData: { chambers: number; configs: ChamberConfig[]; chamberSpecs: any }) => {
      // Save chamber config
      const configResponse = await fetch(`/api/sites/${siteId}/chamber-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ chambers: configData.chambers, configs: configData.configs }),
      })
      if (!configResponse.ok) throw new Error('Failed to save chamber configuration')

      // Save chamber specs
      const specsResponse = await fetch(`/api/sites/${siteId}/chamber-specs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ chamberSpecs: configData.chamberSpecs }),
      })
      if (!specsResponse.ok) throw new Error('Failed to save chamber specifications')

      return { config: await configResponse.json(), specs: await specsResponse.json() }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site', siteId] })
    },
  })

  const handleChamberCountChange = (newCount: number) => {
    setNumberOfChambers(newCount)
    
    // Adjust configs array
    const currentConfigs = [...configs]
    
    if (newCount > configs.length) {
      // Add new chambers
      for (let i = configs.length + 1; i <= newCount; i++) {
        const defaultTreatment = availableTreatments[0] || 'Control'
        currentConfigs.push({
          chamber: i,
          plot: i, // Default plot = chamber
          treatment: defaultTreatment,
          replicate: 1,
          nrate: treatmentNRates[defaultTreatment] || 0,
        })
      }
    } else if (newCount < configs.length) {
      // Remove chambers beyond the new count
      currentConfigs.splice(newCount)
    }
    
    setConfigs(currentConfigs)
  }

  const updateConfig = (index: number, field: keyof ChamberConfig, value: string | number) => {
    const newConfigs = [...configs]
    newConfigs[index] = { ...newConfigs[index], [field]: value }
    
    // If treatment is changed, update nrate automatically
    if (field === 'treatment' && typeof value === 'string') {
      newConfigs[index].nrate = treatmentNRates[value] || 0
    }
    
    setConfigs(newConfigs)
  }

  const updateTreatmentNRate = (treatment: string, nrate: number) => {
    const newNRates = { ...treatmentNRates, [treatment]: nrate }
    setTreatmentNRates(newNRates)
    
    // Update all chambers with this treatment
    const newConfigs = configs.map(config => 
      config.treatment === treatment 
        ? { ...config, nrate } 
        : config
    )
    setConfigs(newConfigs)
  }

  const addTreatment = () => {
    const newTreatment = prompt('Enter treatment name:')
    if (newTreatment && !availableTreatments.includes(newTreatment)) {
      setAvailableTreatments([...availableTreatments, newTreatment])
      setTreatmentNRates({ ...treatmentNRates, [newTreatment]: 0 })
    }
  }

  // Export experimental metadata (equivalent to R's df_plot)
  const exportExperimentalMetadata = () => {
    const metadata = configs.map(config => ({
      chamber: config.chamber,
      plot: config.plot || config.chamber,
      nrate: config.nrate || 0,
      treatment: config.treatment,
      rep: config.replicate,
    }))
    
    const csvContent = [
      ['chamber', 'plot', 'nrate', 'treatment', 'rep'].join(','),
      ...metadata.map(row => [
        row.chamber,
        row.plot,
        row.nrate,
        row.treatment,
        row.rep
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${siteId}_experimental_metadata.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export as JSON for Python processing
  const exportAsJSON = () => {
    const data = {
      site_id: siteId,
      chambers: numberOfChambers,
      treatments: availableTreatments.map(name => ({
        name,
        nrate: treatmentNRates[name] || 0
      })),
      chamber_configs: configs
    }
    
    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${siteId}_chamber_config.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Helper functions for chamber specifications
  const updateChamberSpecs = (field: string, value: any) => {
    setChamberSpecs(prev => ({ ...prev, [field]: value }))
  }

  const calculateVolume = () => {
    return (chamberSpecs.length * chamberSpecs.width * chamberSpecs.height).toLocaleString()
  }

  const calculateArea = () => {
    return (chamberSpecs.length * chamberSpecs.width).toLocaleString()
  }

  const handleSave = () => {
    saveMutation.mutate({
      chambers: numberOfChambers,
      configs: configs,
      chamberSpecs: chamberSpecs,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chamber configuration...</p>
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
            <h3 className="text-sm font-medium text-red-800">Error loading site</h3>
            <p className="mt-1 text-sm text-red-700">{(error as Error).message}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Settings className="w-8 h-8 mr-3 text-primary-600" />
            Chamber Configuration
          </h1>
          <p className="text-gray-600">
            Configure chamber treatments and replicates for {currentSite?.name}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <button
              onClick={exportExperimentalMetadata}
              className="flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </button>
            <button
              onClick={exportAsJSON}
              className="flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <FileText className="w-4 h-4 mr-1" />
              Export JSON
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* General Settings with Chamber Specifications */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h2>
        <div className="space-y-6">
          {/* Basic Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Chambers
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={numberOfChambers}
                onChange={(e) => handleChamberCountChange(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Treatments
              </label>
              <div className="flex items-center space-x-2">
                <div className="flex flex-wrap gap-1">
                  {availableTreatments.map((treatment) => (
                    <span
                      key={treatment}
                      className="px-2 py-1 bg-primary-100 text-primary-800 text-xs rounded"
                    >
                      {treatment} ({treatmentNRates[treatment] || 0} kg N/ha)
                    </span>
                  ))}
                </div>
                <button
                  onClick={addTreatment}
                  className="flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Chamber Specifications */}
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-3">Chamber Specifications (Applied to All Chambers)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Length (cm)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={chamberSpecs.length}
                  onChange={(e) => updateChamberSpecs('length', parseFloat(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width (cm)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={chamberSpecs.width}
                  onChange={(e) => updateChamberSpecs('width', parseFloat(e.target.value) || 30)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={chamberSpecs.height}
                  onChange={(e) => updateChamberSpecs('height', parseFloat(e.target.value) || 20)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Volume (cm³)
                </label>
                <input
                  type="number"
                  min="0"
                  value={calculateVolume()}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Area (cm²)
                </label>
                <input
                  type="number"
                  min="0"
                  value={calculateArea()}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Measurements per Day
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={chamberSpecs.measPerDay}
                  onChange={(e) => updateChamberSpecs('measPerDay', parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            
            {/* Features */}
            <div className="mt-4 flex items-center space-x-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={chamberSpecs.hasVent}
                  onChange={(e) => updateChamberSpecs('hasVent', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Chambers have vents</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={chamberSpecs.hasFan}
                  onChange={(e) => updateChamberSpecs('hasFan', e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Chambers have fans</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Treatment N-Rate Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Treatment N-Rates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableTreatments.map((treatment) => (
            <div key={treatment} className="flex items-center space-x-2">
              <label className="block text-sm font-medium text-gray-700 min-w-20">
                {treatment}:
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={treatmentNRates[treatment] || 0}
                onChange={(e) => updateTreatmentNRate(treatment, parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-500">kg N/ha</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chamber Configuration Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Chamber Assignments</h2>
          <p className="text-sm text-gray-600">Configure treatment and replicate for each chamber</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chamber
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Treatment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  N-Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Replicate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {configs.map((config, index) => (
                <tr key={config.chamber} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">
                      {config.chamber}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min="1"
                      value={config.plot || config.chamber}
                      onChange={(e) => updateConfig(index, 'plot', parseInt(e.target.value) || config.chamber)}
                      className="w-20 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={config.treatment}
                      onChange={(e) => updateConfig(index, 'treatment', e.target.value)}
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {availableTreatments.map((treatment) => (
                        <option key={treatment} value={treatment}>
                          {treatment}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="0"
                        value={config.nrate || 0}
                        onChange={(e) => updateConfig(index, 'nrate', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-xs text-gray-500">kg/ha</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="number"
                      min="1"
                      value={config.replicate}
                      onChange={(e) => updateConfig(index, 'replicate', parseInt(e.target.value) || 1)}
                      className="w-16 px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={config.description || ''}
                      onChange={(e) => updateConfig(index, 'description', e.target.value)}
                      placeholder="Optional description"
                      className="w-full px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Chambers</p>
            <p className="text-2xl font-bold text-gray-900">{numberOfChambers}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Treatments</p>
            <p className="text-2xl font-bold text-gray-900">{availableTreatments.length}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Max Replicates</p>
            <p className="text-2xl font-bold text-gray-900">
              {Math.max(...configs.map(c => c.replicate), 0)}
            </p>
          </div>
        </div>
        
        {/* Treatment breakdown */}
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Chambers per Treatment</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {availableTreatments.map((treatment) => {
              const count = configs.filter(c => c.treatment === treatment).length
              return (
                <div key={treatment} className="flex justify-between text-sm">
                  <span className="text-gray-600">{treatment}:</span>
                  <span className="font-medium">{count} chambers</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}