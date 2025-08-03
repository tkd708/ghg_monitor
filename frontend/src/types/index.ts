export interface Site {
  id: string
  name: string
  description: string
  location: {
    latitude: number
    longitude: number
    region: string
    country: string
  }
  timezone: string
  chambers: number
  dataPath: string
  active: boolean
  treatments: Treatment[]
  chamberConfigs?: ChamberConfig[]
  qualityThresholds: QualityThresholds
  chamberSpecs?: {
    length: number
    width: number
    height: number
    volume?: number
    area?: number
    measPerDay: number
    hasVent: boolean
    hasFan: boolean
  }
}

export interface Treatment {
  name: string
  description: string
  chambers: number[]
  nrate?: number // N rate in kg/ha
}

export interface ChamberConfig {
  chamber: number
  plot?: number // Plot number (can be different from chamber)
  treatment: string
  replicate: number
  nrate?: number // Derived from treatment, but can be overridden
  description?: string
}

export interface QualityThresholds {
  co2_r2_min: number
  n2o_r2_min: number
  n2o_flux_min: number
}

export interface FluxData {
  datetime: string
  chamber: number
  chamber_label: string
  co2_ppm: number
  n2o_ppm: number
  h2o_ppm: number
  co2_flux: number
  n2o_flux: number
  co2_r2: number
  n2o_r2: number
  treatment?: string
}

export interface Photo {
  id: string
  filename: string
  path: string
  uploadDate: string
  description?: string
  tags?: string[]
  size: number
  mimeType: string
}

export interface User {
  id: string
  role: 'admin' | 'researcher' | 'viewer'
}