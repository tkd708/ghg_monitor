import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, FileText, Calendar, Filter, CheckCircle, TrendingUp, BarChart } from 'lucide-react'
import { Site } from '@/types'
import { useSite } from '@/context/SiteContext'
import IndividualFluxViewer from '@/components/IndividualFluxViewer'
import FluxQualityCheck from '@/components/FluxQualityCheck'
import SubdailyFluxDynamics from '@/components/SubdailyFluxDynamics'
import DailyCumulativeFlux from '@/components/DailyCumulativeFlux'

interface QualityControlCriteria {
  co2_r2_min: number
  n2o_r2_min: number
  n2o_flux_min: number
  time_head: number
  time_tail: number
}

export default function Analysis() {
  const { siteId } = useParams<{ siteId: string }>()
  const { currentSite } = useSite()
  const [activeTab, setActiveTab] = useState<'individual' | 'quality' | 'subdaily' | 'daily'>('individual')
  
  // Shared quality control criteria state between sections (c) and (d)
  const [sharedQualityCriteria, setSharedQualityCriteria] = useState<QualityControlCriteria | undefined>(undefined)

  // Load site data for configuration
  const { data: site } = useQuery<Site>({
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

  const tabs = [
    {
      id: 'individual' as const,
      label: '(a) Individual Cycle Data',
      icon: FileText,
      description: 'View raw flux measurements by data file'
    },
    {
      id: 'quality' as const,
      label: '(b) Flux Quality Check',
      icon: CheckCircle,
      description: 'Flux calculation results with quality control assessment'
    },
    {
      id: 'subdaily' as const,
      label: '(c) Subdaily Flux Dynamics',
      icon: TrendingUp,
      description: 'Filtered flux dynamics throughout the day'
    },
    {
      id: 'daily' as const,
      label: '(d) Daily/Cumulative Flux',
      icon: BarChart,
      description: 'Daily totals and cumulative flux per treatment'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <BarChart3 className="w-8 h-8 mr-3 text-primary-600" />
          Flux Data Analysis
        </h1>
        <p className="text-gray-600">
          Analyze flux measurements for {currentSite?.name}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          {tabs.find(tab => tab.id === activeTab)?.icon && (
            <div className="mr-3">
              {activeTab === 'individual' && <Calendar className="h-5 w-5 text-blue-400 mt-0.5" />}
              {activeTab === 'quality' && <CheckCircle className="h-5 w-5 text-blue-400 mt-0.5" />}
              {activeTab === 'subdaily' && <TrendingUp className="h-5 w-5 text-blue-400 mt-0.5" />}
              {activeTab === 'daily' && <Filter className="h-5 w-5 text-blue-400 mt-0.5" />}
            </div>
          )}
          <div>
            <p className="text-sm text-blue-800">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'individual' && (
          <IndividualFluxViewer siteId={siteId!} site={site} />
        )}
        {activeTab === 'quality' && (
          <FluxQualityCheck siteId={siteId!} site={site} />
        )}
        {activeTab === 'subdaily' && (
          <SubdailyFluxDynamics 
            siteId={siteId!} 
            site={site} 
            onQualityCriteriaChange={setSharedQualityCriteria}
          />
        )}
        {activeTab === 'daily' && (
          <DailyCumulativeFlux 
            siteId={siteId!} 
            site={site} 
            qualityCriteria={sharedQualityCriteria}
          />
        )}
      </div>
    </div>
  )
}