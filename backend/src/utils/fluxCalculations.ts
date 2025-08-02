import { parse } from 'csv-parse/sync'

export interface RawMeasurement {
  datetime: string
  chamber: number
  co2_ppm: number
  n2o_ppb: number
  h2o_ppm: number
  status: string
  time_elapsed?: number
}

export interface ChamberMeasurement {
  chamber: number
  measurements: RawMeasurement[]
  start_time: string
  end_time: string
  duration_seconds: number
}

export interface FluxResult {
  datetime: string
  run_id: string
  chamber: number
  treatment: string
  replicate: number
  co2_flux: number // kg C/ha/d
  n2o_flux: number // g N/ha/d
  h2o_avg: number // ppm
  co2_r2: number
  n2o_r2: number
  co2_slope: number // ppm/s
  n2o_slope: number // ppb/s
  measurement_start_time: string
  duration_seconds: number
  quality_flag: 'good' | 'poor' | 'failed'
  points_used: number
  points_total: number
}

export interface QualityControlCriteria {
  co2_r2_min: number
  n2o_r2_min: number
  n2o_flux_min: number
  time_head: number
  time_tail: number
}

export interface LinearRegressionResult {
  slope: number
  intercept: number
  r_squared: number
  points_used: number
  data_points: Array<{
    x: number
    y: number
    included: boolean
  }>
}

/**
 * Calculate linear regression for concentration vs time
 */
export function calculateLinearRegression(
  measurements: RawMeasurement[], 
  gasField: 'co2_ppm' | 'n2o_ppb' | 'h2o_ppm',
  timeHead: number = 200,
  timeTail: number = 300
): LinearRegressionResult {
  if (measurements.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      r_squared: 0,
      points_used: 0,
      data_points: []
    }
  }

  // Apply time window filtering (use timeHead as start time and timeTail as end time)
  const data_points = measurements.map((measurement, index) => {
    const timeElapsed = measurement.time_elapsed || index + 1
    return {
      x: timeElapsed,
      y: measurement[gasField],
      included: timeElapsed >= timeHead && timeElapsed <= timeTail
    }
  })

  const includedPoints = data_points.filter(p => p.included)
  
  if (includedPoints.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      r_squared: 0,
      points_used: 0,
      data_points
    }
  }

  // Calculate linear regression
  const n = includedPoints.length
  const sumX = includedPoints.reduce((sum, p) => sum + p.x, 0)
  const sumY = includedPoints.reduce((sum, p) => sum + p.y, 0)
  const sumXY = includedPoints.reduce((sum, p) => sum + (p.x * p.y), 0)
  const sumX2 = includedPoints.reduce((sum, p) => sum + (p.x * p.x), 0)
  // const sumY2 = includedPoints.reduce((sum, p) => sum + (p.y * p.y), 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  // Calculate R-squared
  const meanY = sumY / n
  const ssRes = includedPoints.reduce((sum, p) => {
    const predicted = slope * p.x + intercept
    return sum + Math.pow(p.y - predicted, 2)
  }, 0)
  const ssTot = includedPoints.reduce((sum, p) => {
    return sum + Math.pow(p.y - meanY, 2)
  }, 0)
  
  const r_squared = ssTot === 0 ? 1 : 1 - (ssRes / ssTot)

  return {
    slope: isNaN(slope) ? 0 : slope,
    intercept: isNaN(intercept) ? 0 : intercept,
    r_squared: isNaN(r_squared) ? 0 : Math.max(0, Math.min(1, r_squared)),
    points_used: n,
    data_points
  }
}

/**
 * Convert concentration slope to flux rate
 * CO2: ppm/s -> kg C/ha/d
 * N2O: ppb/s -> g N/ha/d
 */
export function convertToFlux(
  slope: number, 
  gasType: 'co2' | 'n2o', 
  chamberHeight_cm: number = 15, 
  temperature_C: number = 25, 
  pressure_kPa: number = 101.325
): number {
  const chamberHeight = chamberHeight_cm / 100 // convert cm to meters
  
  // Calculate temperature and pressure corrected molar volume
  // Ideal gas law: V = nRT/P
  // At STP (0°C, 101.325 kPa): V = 22.4 L/mol
  // At measurement conditions: V = 22.4 * (T_measurement/T_STP) * (P_STP/P_measurement)
  const T_STP = 273.15 // 0°C in Kelvin
  const P_STP = 101.325 // kPa
  const T_measurement = temperature_C + 273.15 // Convert to Kelvin
  const P_measurement = pressure_kPa
  
  const molarVolume_STP = 22.4 // L/mol at STP
  const molarVolume = molarVolume_STP * (T_measurement / T_STP) * (P_STP / P_measurement)
  
  if (gasType === 'co2') {
    // CO2: ppm/s -> kg C/ha/d
    // - Molecular weight CO2: 44.01 g/mol
    // - Carbon fraction in CO2: 12.01/44.01 = 0.273
    
    const molarMassCO2 = 44.01 // g/mol
    const carbonFraction = 12.01 / 44.01
    const secondsPerDay = 86400
    const m2PerHa = 10000
    
    // Convert ppm/s to kg C/ha/d (divide by 1000000 instead of 1000 to get kg instead of g)
    const fluxRate = slope * chamberHeight * m2PerHa * (molarMassCO2 / molarVolume) * carbonFraction * secondsPerDay / 1000000
    
    return fluxRate
  } else {
    // N2O: ppb/s -> gN/ha/d
    // - Molecular weight N2O: 44.013 g/mol
    // - Nitrogen fraction in N2O: 28.014/44.013 = 0.636
    
    const molarMassN2O = 44.013 // g/mol
    const nitrogenFraction = 28.014 / 44.013
    const secondsPerDay = 86400
    const m2PerHa = 10000
    const ppbToPpm = 1000 // conversion factor
    
    // Convert ppb/s to gN/ha/d
    const fluxRate = (slope / ppbToPpm) * chamberHeight * m2PerHa * (molarMassN2O / molarVolume) * nitrogenFraction * secondsPerDay / 1000
    
    return fluxRate
  }
}

/**
 * Parse CSV file and group measurements by chamber
 */
export function parseAndGroupByChamber(csvContent: string): ChamberMeasurement[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  })

  const chamberGroups = new Map<number, RawMeasurement[]>()

  // Group measurements by chamber
  records.forEach((record: any) => {
    if (!record['chamber id'] || record['chamber id'] === '') return
    
    const chamber = parseInt(record['chamber id'])
    if (isNaN(chamber)) return

    // Handle DD/MM/YYYY date format
    const [day, month, year] = record.date.split('/')
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    
    const measurement: RawMeasurement = {
      datetime: `${isoDate} ${record.time}`,
      chamber,
      co2_ppm: parseFloat(record['co2[ppm]']) || 0,
      n2o_ppb: parseFloat(record['n2o avg [ppb]']) || 0,
      h2o_ppm: parseFloat(record['h2o avg[ppm]']) || 0,
      status: record.status || '0'
    }

    if (!chamberGroups.has(chamber)) {
      chamberGroups.set(chamber, [])
    }
    chamberGroups.get(chamber)!.push(measurement)
  })

  // Convert to ChamberMeasurement array
  const chamberMeasurements: ChamberMeasurement[] = []

  chamberGroups.forEach((measurements, chamber) => {
    if (measurements.length === 0) return

    // Sort by datetime and assign time_elapsed
    measurements.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    
    const startTime = new Date(measurements[0].datetime).getTime()
    measurements.forEach((measurement) => {
      const currentTime = new Date(measurement.datetime).getTime()
      measurement.time_elapsed = Math.round((currentTime - startTime) / 1000) // seconds since start
    })

    chamberMeasurements.push({
      chamber,
      measurements,
      start_time: measurements[0].datetime,
      end_time: measurements[measurements.length - 1].datetime,
      duration_seconds: measurements.length
    })
  })

  return chamberMeasurements.sort((a, b) => a.chamber - b.chamber)
}

/**
 * Calculate flux for a single chamber measurement
 */
export function calculateChamberFlux(
  chamberMeasurement: ChamberMeasurement,
  treatmentInfo: { treatment: string; replicate: number },
  qualityCriteria: QualityControlCriteria,
  runId: string,
  chamberHeight_cm: number = 15
): FluxResult {
  const { chamber, measurements, start_time, duration_seconds } = chamberMeasurement
  
  // Calculate regressions for each gas
  const co2Regression = calculateLinearRegression(measurements, 'co2_ppm', qualityCriteria.time_head, qualityCriteria.time_tail)
  const n2oRegression = calculateLinearRegression(measurements, 'n2o_ppb', qualityCriteria.time_head, qualityCriteria.time_tail)
  // const h2oRegression = calculateLinearRegression(measurements, 'h2o_ppm', qualityCriteria.time_head, qualityCriteria.time_tail)

  // Convert slopes to flux rates
  const co2_flux = convertToFlux(co2Regression.slope, 'co2', chamberHeight_cm)
  const n2o_flux = convertToFlux(n2oRegression.slope, 'n2o', chamberHeight_cm)

  // Calculate average H2O
  const h2o_avg = measurements.reduce((sum, m) => sum + m.h2o_ppm, 0) / measurements.length

  // Determine quality flag
  let quality_flag: 'good' | 'poor' | 'failed' = 'failed'
  
  const co2QualityOk = co2Regression.r_squared >= qualityCriteria.co2_r2_min
  const n2oQualityOk = n2oRegression.r_squared >= qualityCriteria.n2o_r2_min
  const n2oFluxOk = n2o_flux >= qualityCriteria.n2o_flux_min

  if (co2QualityOk && n2oQualityOk && n2oFluxOk) {
    quality_flag = 'good'
  } else if (co2QualityOk) {
    quality_flag = 'poor'
  }

  return {
    datetime: start_time,
    run_id: runId,
    chamber,
    treatment: treatmentInfo.treatment,
    replicate: treatmentInfo.replicate,
    co2_flux,
    n2o_flux,
    h2o_avg,
    co2_r2: co2Regression.r_squared,
    n2o_r2: n2oRegression.r_squared,
    co2_slope: co2Regression.slope,
    n2o_slope: n2oRegression.slope,
    measurement_start_time: new Date(start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // HH:MM format
    duration_seconds,
    quality_flag,
    points_used: Math.min(co2Regression.points_used, n2oRegression.points_used),
    points_total: measurements.length
  }
}

/**
 * Process entire CSV file and calculate all chamber fluxes
 */
export function processFluxFile(
  csvContent: string,
  chamberConfigs: Array<{ chamber: number; treatment: string; replicate: number }>,
  qualityCriteria: QualityControlCriteria,
  runId: string,
  chamberHeight_cm: number = 15
): FluxResult[] {
  const chamberMeasurements = parseAndGroupByChamber(csvContent)
  const results: FluxResult[] = []

  chamberMeasurements.forEach(chamberMeasurement => {
    const config = chamberConfigs.find(c => c.chamber === chamberMeasurement.chamber)
    if (!config) return

    const treatmentInfo = {
      treatment: config.treatment,
      replicate: config.replicate
    }

    const fluxResult = calculateChamberFlux(chamberMeasurement, treatmentInfo, qualityCriteria, runId, chamberHeight_cm)
    results.push(fluxResult)
  })

  return results
}