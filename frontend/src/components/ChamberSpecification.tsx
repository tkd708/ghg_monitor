import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings, Save, Plus, Trash2, Calculator } from 'lucide-react'
import { Site } from '@/types'

interface ChamberSpec {
  chamber: number
  length_cm?: number
  width_cm?: number
  height_cm?: number
  volume_cm3?: number
  area_cm2?: number
  measurement_frequency_hz?: number
  has_vent?: boolean
  has_fan?: boolean
  notes?: string
}

interface ChamberSpecificationProps {
  siteId: string
  site?: Site
}

export default function ChamberSpecification({ siteId, site }: ChamberSpecificationProps) {
  const [chamberSpecs, setChamberSpecs] = useState<ChamberSpec[]>([])
  const [editingChamber, setEditingChamber] = useState<number | null>(null)
  const [newChamber, setNewChamber] = useState<Partial<ChamberSpec>>({})

  const queryClient = useQueryClient()

  // Get existing chamber specifications
  const { data: existingSpecs, isLoading } = useQuery({
    queryKey: ['chamberSpecs', siteId],
    queryFn: async () => {
      const response = await fetch(`/api/sites/${siteId}/chamber-specs`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })
      if (!response.ok) {
        if (response.status === 404) return []
        throw new Error('Failed to fetch chamber specifications')
      }
      return response.json()
    },
    enabled: !!siteId,
  })

  // Save chamber specifications mutation
  const saveMutation = useMutation({
    mutationFn: async (specs: ChamberSpec[]) => {
      const response = await fetch(`/api/sites/${siteId}/chamber-specs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({ chamberSpecs: specs }),
      })
      if (!response.ok) throw new Error('Failed to save chamber specifications')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamberSpecs', siteId] })
      setEditingChamber(null)
    },
  })

  // Initialize chamber specs when data loads
  useEffect(() => {
    if (existingSpecs) {
      setChamberSpecs(existingSpecs)
    } else if (site?.chambers && chamberSpecs.length === 0) {
      // Initialize with default specs for all chambers
      const defaultSpecs = Array.from({ length: site.chambers }, (_, i) => ({
        chamber: i + 1,
        length_cm: 30,
        width_cm: 30,
        height_cm: 20,
        measurement_frequency_hz: 1,
        has_vent: false,
        has_fan: false,
      }))
      setChamberSpecs(defaultSpecs)
    }
  }, [existingSpecs, site?.chambers, chamberSpecs.length])

  // Calculate derived values
  const calculateDerived = (spec: Partial<ChamberSpec>) => {
    const derived = { ...spec }
    
    if (spec.length_cm && spec.width_cm && spec.height_cm) {
      derived.volume_cm3 = spec.length_cm * spec.width_cm * spec.height_cm
      derived.area_cm2 = spec.length_cm * spec.width_cm
    } else if (spec.volume_cm3 && spec.area_cm2) {
      derived.height_cm = spec.volume_cm3 / spec.area_cm2
    }
    
    return derived
  }

  const updateChamberSpec = (chamber: number, updates: Partial<ChamberSpec>) => {
    const calculated = calculateDerived(updates)
    setChamberSpecs(prev => 
      prev.map(spec => 
        spec.chamber === chamber 
          ? { ...spec, ...calculated }
          : spec
      )
    )
  }

  const addNewChamber = () => {
    if (!newChamber.chamber) return
    
    const calculated = calculateDerived(newChamber)
    setChamberSpecs(prev => [...prev, {
      chamber: newChamber.chamber!,
      length_cm: 30,
      width_cm: 30,
      height_cm: 20,
      measurement_frequency_hz: 1,
      has_vent: false,
      has_fan: false,
      ...calculated
    }])
    setNewChamber({})
  }

  const removeChamber = (chamber: number) => {
    setChamberSpecs(prev => prev.filter(spec => spec.chamber !== chamber))
  }

  const handleSave = () => {
    saveMutation.mutate(chamberSpecs)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading chamber specifications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-primary-600" />
              Chamber Specifications
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure physical dimensions and operating parameters for each chamber
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save All'}
          </button>
        </div>
      </div>

      {/* Chamber Specifications List */}
      <div className="grid grid-cols-1 gap-6">
        {chamberSpecs
          .sort((a, b) => a.chamber - b.chamber)
          .map((spec) => (
            <div key={spec.chamber} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-medium text-gray-800">
                  Chamber {spec.chamber}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingChamber(editingChamber === spec.chamber ? null : spec.chamber)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    {editingChamber === spec.chamber ? 'Done' : 'Edit'}
                  </button>
                  <button
                    onClick={() => removeChamber(spec.chamber)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {editingChamber === spec.chamber ? (
                <div className="space-y-4">
                  {/* Dimensions */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2 flex items-center">
                      <Calculator className="w-4 h-4 mr-2" />
                      Physical Dimensions
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Length (cm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={spec.length_cm || ''}
                          onChange={(e) => updateChamberSpec(spec.chamber, { 
                            length_cm: parseFloat(e.target.value) || undefined 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Width (cm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={spec.width_cm || ''}
                          onChange={(e) => updateChamberSpec(spec.chamber, { 
                            width_cm: parseFloat(e.target.value) || undefined 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Height (cm)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={spec.height_cm || ''}
                          onChange={(e) => updateChamberSpec(spec.chamber, { 
                            height_cm: parseFloat(e.target.value) || undefined 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculated Values */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Calculated Values</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Volume (cm³)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={spec.volume_cm3 || ''}
                          onChange={(e) => updateChamberSpec(spec.chamber, { 
                            volume_cm3: parseFloat(e.target.value) || undefined 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Area (cm²)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={spec.area_cm2 || ''}
                          onChange={(e) => updateChamberSpec(spec.chamber, { 
                            area_cm2: parseFloat(e.target.value) || undefined 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Operating Parameters */}
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Operating Parameters</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Measurement Frequency (Hz)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={spec.measurement_frequency_hz || ''}
                          onChange={(e) => updateChamberSpec(spec.chamber, { 
                            measurement_frequency_hz: parseFloat(e.target.value) || undefined 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div className="flex items-center space-x-4 pt-6">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={spec.has_vent || false}
                            onChange={(e) => updateChamberSpec(spec.chamber, { 
                              has_vent: e.target.checked 
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Has Vent</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={spec.has_fan || false}
                            onChange={(e) => updateChamberSpec(spec.chamber, { 
                              has_fan: e.target.checked 
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Has Fan</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={spec.notes || ''}
                      onChange={(e) => updateChamberSpec(spec.chamber, { 
                        notes: e.target.value 
                      })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Additional notes about this chamber..."
                    />
                  </div>
                </div>
              ) : (
                /* Summary View */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Dimensions:</span>
                    <p className="font-medium">
                      {spec.length_cm}×{spec.width_cm}×{spec.height_cm} cm
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Volume:</span>
                    <p className="font-medium">{spec.volume_cm3?.toLocaleString()} cm³</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Area:</span>
                    <p className="font-medium">{spec.area_cm2?.toLocaleString()} cm²</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Frequency:</span>
                    <p className="font-medium">{spec.measurement_frequency_hz} Hz</p>
                  </div>
                  {(spec.has_vent || spec.has_fan) && (
                    <div className="col-span-2">
                      <span className="text-gray-600">Features:</span>
                      <p className="font-medium">
                        {[spec.has_vent && 'Vent', spec.has_fan && 'Fan'].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  {spec.notes && (
                    <div className="col-span-full">
                      <span className="text-gray-600">Notes:</span>
                      <p className="font-medium">{spec.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Add New Chamber */}
      <div className="bg-gray-50 p-6 rounded-lg border-2 border-dashed border-gray-300">
        <h3 className="text-md font-medium text-gray-800 mb-4 flex items-center">
          <Plus className="w-5 h-5 mr-2" />
          Add New Chamber
        </h3>
        <div className="flex items-end space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Chamber Number
            </label>
            <input
              type="number"
              min="1"
              value={newChamber.chamber || ''}
              onChange={(e) => setNewChamber(prev => ({ 
                ...prev, 
                chamber: parseInt(e.target.value) || undefined 
              }))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., 17"
            />
          </div>
          <button
            onClick={addNewChamber}
            disabled={!newChamber.chamber}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            Add Chamber
          </button>
        </div>
      </div>

      {/* Save Status */}
      {saveMutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          Failed to save chamber specifications. Please try again.
        </div>
      )}
      {saveMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          Chamber specifications saved successfully!
        </div>
      )}
    </div>
  )
}