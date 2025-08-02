import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { authenticate } from '../middleware/auth'
import { logger } from '../utils/logger'
import { 
  processFluxFile, 
  QualityControlCriteria, 
  FluxResult,
  parseAndGroupByChamber,
  calculateLinearRegression,
  convertToFlux
} from '../utils/fluxCalculations'

const router = Router()

// Get flux data for a site
router.get('/:siteId/data', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { startDate, endDate, chamber } = req.query

    // Read site registry to get data path
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Read CSV files from site data directory
    const dataPath = path.join(__dirname, '../../../', site.dataPath)
    const files = await fs.readdir(dataPath)
    const csvFiles = files.filter(f => f.endsWith('.csv'))

    let allData: any[] = []

    for (const file of csvFiles) {
      try {
        const filePath = path.join(dataPath, file)
        const fileContent = await fs.readFile(filePath, 'utf-8')
        
        const records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
        })

        // Process each record
        for (const record of records) {
          // Skip records with invalid chamber IDs
          const chamberIdRaw = record['chamber id']
          if (!chamberIdRaw || chamberIdRaw === '' || chamberIdRaw.toLowerCase() === 'na' || chamberIdRaw.toLowerCase() === 'n/a') {
            continue
          }
          
          const chamberId = parseInt(chamberIdRaw)
          if (isNaN(chamberId) || chamberId <= 0) {
            continue
          }

          // Handle DD/MM/YYYY date format
          const [day, month, year] = record.date.split('/')
          const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
          const datetime = new Date(`${isoDate} ${record.time}`)
          
          // Apply filters
          if (startDate && datetime < new Date(startDate as string)) continue
          if (endDate && datetime > new Date(endDate as string)) continue
          if (chamber && chamberIdRaw !== chamber) continue

          // Add processed data
          allData.push({
            datetime: datetime.toISOString(),
            chamber: chamberId,
            chamber_label: `C${String(chamberId).padStart(2, '0')}`,
            co2_ppm: parseFloat(record['co2[ppm]']) || 0,
            n2o_ppb: parseFloat(record['n2o avg [ppb]']) || 0,
            n2o_ppm: (parseFloat(record['n2o avg [ppb]']) || 0) / 1000,
            h2o_ppm: parseFloat(record['h2o avg[ppm]']) || 0,
            status: record.status || '0',
            pair_kpa: parseFloat(record['pair[kpa]']) || 0,
            temp_c: parseFloat(record['temp[c]'] || record['temperature[c]'] || record['temp']) || null,
            run_id: record['run id'] || '',
            site_id: record['site id'] || '',
            filename: file // Add filename to track which file each record came from
          })
        }
      } catch (fileError) {
        logger.warn(`Error processing file ${file}:`, fileError)
      }
    }

    // Sort by datetime
    allData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())

    // Find most recent file and its metadata
    let mostRecentFile = null
    let mostRecentRecord = null
    let avgTemp = null
    let avgPressure = null
    let statusCounts = {}

    if (allData.length > 0) {
      mostRecentRecord = allData[allData.length - 1]
      mostRecentFile = mostRecentRecord.filename
      
      // Calculate averages for the most recent file
      const recentFileData = allData.filter(d => d.filename === mostRecentFile)
      
      const validTemps = recentFileData.filter(d => d.temp_c !== null).map(d => d.temp_c)
      const validPressures = recentFileData.filter(d => d.pair_kpa > 0).map(d => d.pair_kpa)
      
      avgTemp = validTemps.length > 0 ? validTemps.reduce((sum, t) => sum + t, 0) / validTemps.length : null
      avgPressure = validPressures.length > 0 ? validPressures.reduce((sum, p) => sum + p, 0) / validPressures.length : null
      
      // Count status occurrences
      statusCounts = recentFileData.reduce((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    res.json({
      data: allData,
      totalRecords: allData.length,
      site: site.name,
      mostRecentFile: {
        filename: mostRecentFile,
        datetime: mostRecentRecord?.datetime,
        recordCount: allData.filter(d => d.filename === mostRecentFile).length,
        avgTemperature: avgTemp,
        avgPressure: avgPressure,
        statusCounts: statusCounts
      }
    })
  } catch (error) {
    logger.error('Error reading flux data:', error)
    res.status(500).json({ error: 'Failed to load flux data' })
  }
})

// Get available data files for a site
router.get('/:siteId/data-files', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params

    // Read site registry to get data path
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Read CSV files from site data directory
    const dataPath = path.join(__dirname, '../../../', site.dataPath)
    const files = await fs.readdir(dataPath)
    const csvFiles = files.filter(f => f.endsWith('.csv'))

    const dataFiles = []

    for (const file of csvFiles) {
      try {
        const filePath = path.join(dataPath, file)
        const fileContent = await fs.readFile(filePath, 'utf-8')
        
        const lines = fileContent.split('\n')
        if (lines.length < 2) continue

        
        // Extract metadata from filename and first data row
        const filenameParts = file.replace('.csv', '').split('_')
        let runId = '', date = '', time = ''
        
        if (filenameParts.length >= 3) {
          runId = `${filenameParts[1]}_${filenameParts[2]}`
          const dateStr = filenameParts[1]
          const timeStr = filenameParts[2]
          
          // Parse date (format: DDMMYYYY)
          if (dateStr.length === 8) {
            const day = dateStr.substring(0, 2)
            const month = dateStr.substring(2, 4)
            const year = dateStr.substring(4, 8)
            date = `${year}-${month}-${day}`
          }
          
          // Parse time (format: HHMM)
          if (timeStr.length === 4) {
            const hour = timeStr.substring(0, 2)
            const minute = timeStr.substring(2, 4)
            time = `${hour}:${minute}`
          }
        }

        // Count records and unique chambers
        const recordCount = lines.length - 1 // minus header
        const chambersSet = new Set<number>()
        
        // Parse the CSV properly to count all unique chambers
        const records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
        })
        
        for (const record of records) {
          if (record['chamber id']) {
            const chamber = parseInt(record['chamber id'])
            if (!isNaN(chamber)) {
              chambersSet.add(chamber)
            }
          }
        }
        
        const chambers = Array.from(chambersSet).sort((a, b) => a - b)

        dataFiles.push({
          filename: file,
          date,
          time,
          runId,
          chambers: chambers.sort(),
          recordCount
        })
      } catch (fileError) {
        logger.warn(`Error processing file ${file}:`, fileError)
      }
    }

    // Sort by date and time (most recent first)
    dataFiles.sort((a, b) => {
      const dateTimeA = new Date(`${a.date} ${a.time}`)
      const dateTimeB = new Date(`${b.date} ${b.time}`)
      return dateTimeB.getTime() - dateTimeA.getTime()
    })

    res.json(dataFiles)
  } catch (error) {
    logger.error('Error reading data files:', error)
    res.status(500).json({ error: 'Failed to load data files' })
  }
})

// Get raw data from a specific file
router.get('/:siteId/raw-data', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { file } = req.query

    if (!file) {
      res.status(400).json({ error: 'File parameter is required' })
      return
    }

    // Read site registry to get data path
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Read specific CSV file
    const dataPath = path.join(__dirname, '../../../', site.dataPath)
    const filePath = path.join(dataPath, file as string)
    
    // Security check - ensure file is within data directory
    if (!filePath.startsWith(dataPath)) {
      res.status(400).json({ error: 'Invalid file path' })
      return
    }

    const fileContent = await fs.readFile(filePath, 'utf-8')
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    })

    // Process records with proper date parsing
    const processedData = records.map((record: any) => {
      // Handle DD/MM/YYYY date format
      const [day, month, year] = record.date.split('/')
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      
      return {
        datetime: new Date(`${isoDate} ${record.time}`).toISOString(),
        chamber: parseInt(record['chamber id']) || 0,
        co2_ppm: parseFloat(record['co2[ppm]']) || 0,
        n2o_ppb: parseFloat(record['n2o avg [ppb]']) || 0,
        h2o_ppm: parseFloat(record['h2o avg[ppm]']) || 0,
        status: record.status || '0',
      }
    })

    res.json(processedData)
  } catch (error) {
    logger.error('Error reading raw data:', error)
    res.status(500).json({ error: 'Failed to load raw data' })
  }
})

// Get calculated flux summary with quality control
router.get('/:siteId/flux-summary', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { 
      co2_r2_min = '0.6', 
      n2o_r2_min = '0.6', 
      n2o_flux_min = '-5'
    } = req.query

    // Read site registry to get data path and chamber configs
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // For now, return mock flux summary data
    // This will be replaced with actual flux calculation logic
    const mockFluxSummary = [
      {
        datetime: '2025-08-01T10:00:00Z',
        chamber: 1,
        chamber_label: 'C01',
        treatment: 'N0',
        replicate: 1,
        co2_flux: 45.2,
        n2o_flux: 0.8,
        h2o_avg: 12500,
        co2_r2: 0.92,
        n2o_r2: 0.75,
        quality_flag: 'good' as 'good' | 'poor' | 'failed'
      },
      {
        datetime: '2025-08-01T14:00:00Z',
        chamber: 2,
        chamber_label: 'C02',
        treatment: 'eNPower',
        replicate: 1,
        co2_flux: 52.8,
        n2o_flux: 1.2,
        h2o_avg: 13200,
        co2_r2: 0.88,
        n2o_r2: 0.68,
        quality_flag: 'good' as 'good' | 'poor' | 'failed'
      },
      {
        datetime: '2025-08-01T18:00:00Z',
        chamber: 3,
        chamber_label: 'C03',
        treatment: 'N200',
        replicate: 1,
        co2_flux: 38.5,
        n2o_flux: 2.1,
        h2o_avg: 11800,
        co2_r2: 0.95,
        n2o_r2: 0.82,
        quality_flag: 'good' as 'good' | 'poor' | 'failed'
      }
    ]

    // Apply quality filters
    const filteredData = mockFluxSummary.filter(d => {
      const co2QualityOk = d.co2_r2 >= parseFloat(co2_r2_min as string)
      const n2oQualityOk = d.n2o_r2 >= parseFloat(n2o_r2_min as string)
      const n2oFluxOk = d.n2o_flux >= parseFloat(n2o_flux_min as string)
      
      if (co2QualityOk && n2oQualityOk && n2oFluxOk) {
        return true
      } else if (co2QualityOk) {
        (d as any).quality_flag = 'poor'
        return true
      } else {
        (d as any).quality_flag = 'failed'
        return false
      }
    })

    res.json(filteredData)
  } catch (error) {
    logger.error('Error calculating flux summary:', error)
    res.status(500).json({ error: 'Failed to calculate flux summary' })
  }
})

// Get all flux calculations (Section b - Quality Check)
router.get('/:siteId/flux-calculations', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { 
      startDate,
      endDate
    } = req.query

    // Read site registry to get data path and chamber configs
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Default quality criteria (no filtering for quality check section)
    const qualityCriteria: QualityControlCriteria = {
      co2_r2_min: 0,
      n2o_r2_min: 0,
      n2o_flux_min: -999,
      time_head: 200,
      time_tail: 300
    }

    const dataPath = path.join(__dirname, '../../../', site.dataPath)
    const files = await fs.readdir(dataPath)
    const csvFiles = files.filter(f => f.endsWith('.csv'))

    let allFluxResults: FluxResult[] = []

    // Process each CSV file
    for (const file of csvFiles) {
      try {
        const filePath = path.join(dataPath, file)
        const fileContent = await fs.readFile(filePath, 'utf-8')
        
        // Extract date and run_id from filename for filtering
        const filenameParts = file.replace('.csv', '').split('_')
        let fileDate = ''
        let runId = ''
        if (filenameParts.length >= 3) {
          const dateStr = filenameParts[1]
          const timeStr = filenameParts[2]
          runId = `${dateStr}_${timeStr}`
          
          if (dateStr.length === 8) {
            const day = dateStr.substring(0, 2)
            const month = dateStr.substring(2, 4)
            const year = dateStr.substring(4, 8)
            fileDate = `${year}-${month}-${day}`
          }
        }

        // Apply date filtering
        if (startDate && fileDate && fileDate < startDate) continue
        if (endDate && fileDate && fileDate > endDate) continue

        // Get chamber configurations (use default if not available)
        const chamberConfigs = site.chamberConfigs || [
          { chamber: 1, treatment: 'N0', replicate: 1 },
          { chamber: 2, treatment: 'eNPower', replicate: 1 },
          { chamber: 3, treatment: 'N200', replicate: 1 },
          { chamber: 4, treatment: 'Centuro', replicate: 1 },
          { chamber: 5, treatment: 'N0', replicate: 2 },
          { chamber: 6, treatment: 'eNPower', replicate: 2 },
          { chamber: 7, treatment: 'N200', replicate: 2 },
          { chamber: 8, treatment: 'Centuro', replicate: 2 },
          { chamber: 9, treatment: 'N0', replicate: 3 },
          { chamber: 10, treatment: 'eNPower', replicate: 3 },
          { chamber: 11, treatment: 'N200', replicate: 3 },
          { chamber: 12, treatment: 'Centuro', replicate: 3 },
          { chamber: 13, treatment: 'N0', replicate: 4 },
          { chamber: 14, treatment: 'eNPower', replicate: 4 },
          { chamber: 15, treatment: 'N200', replicate: 4 },
          { chamber: 16, treatment: 'Centuro', replicate: 4 }
        ]

        // Get chamber specifications for accurate flux calculation
        let chamberHeight = 15 // default 15cm
        if (site.chamberSpecs && site.chamberSpecs.height_cm) {
          chamberHeight = site.chamberSpecs.height_cm
        }

        const fileResults = processFluxFile(fileContent, chamberConfigs, qualityCriteria, runId, chamberHeight)
        allFluxResults.push(...fileResults)

      } catch (fileError) {
        logger.warn(`Error processing flux file ${file}:`, fileError)
      }
    }

    // Sort by datetime
    allFluxResults.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())

    res.json(allFluxResults)
  } catch (error) {
    logger.error('Error calculating flux data:', error)
    res.status(500).json({ error: 'Failed to calculate flux data' })
  }
})

// Get filtered flux data (Section c - Subdaily Dynamics)
router.get('/:siteId/filtered-flux', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { 
      startDate,
      endDate,
      co2_r2_min = '0.6',
      n2o_r2_min = '0.6',
      n2o_flux_min = '-5',
      time_head = '200',
      time_tail = '300'
    } = req.query

    // Read site registry
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Apply quality criteria from user input
    const qualityCriteria: QualityControlCriteria = {
      co2_r2_min: parseFloat(co2_r2_min as string),
      n2o_r2_min: parseFloat(n2o_r2_min as string),
      n2o_flux_min: parseFloat(n2o_flux_min as string),
      time_head: parseInt(time_head as string),
      time_tail: parseInt(time_tail as string)
    }

    const dataPath = path.join(__dirname, '../../../', site.dataPath)
    const files = await fs.readdir(dataPath)
    const csvFiles = files.filter(f => f.endsWith('.csv'))

    let allFluxResults: FluxResult[] = []

    // Process each CSV file
    for (const file of csvFiles) {
      try {
        const filePath = path.join(dataPath, file)
        const fileContent = await fs.readFile(filePath, 'utf-8')
        
        // Extract date and run_id from filename for filtering
        const filenameParts = file.replace('.csv', '').split('_')
        let fileDate = ''
        let runId = ''
        if (filenameParts.length >= 3) {
          const dateStr = filenameParts[1]
          const timeStr = filenameParts[2]
          runId = `${dateStr}_${timeStr}`
          
          if (dateStr.length === 8) {
            const day = dateStr.substring(0, 2)
            const month = dateStr.substring(2, 4)
            const year = dateStr.substring(4, 8)
            fileDate = `${year}-${month}-${day}`
          }
        }

        // Apply date filtering
        if (startDate && fileDate && fileDate < startDate) continue
        if (endDate && fileDate && fileDate > endDate) continue

        // Get chamber configurations
        const chamberConfigs = site.chamberConfigs || [
          { chamber: 1, treatment: 'N0', replicate: 1 },
          { chamber: 2, treatment: 'eNPower', replicate: 1 },
          { chamber: 3, treatment: 'N200', replicate: 1 },
          { chamber: 4, treatment: 'Centuro', replicate: 1 },
          { chamber: 5, treatment: 'N0', replicate: 2 },
          { chamber: 6, treatment: 'eNPower', replicate: 2 },
          { chamber: 7, treatment: 'N200', replicate: 2 },
          { chamber: 8, treatment: 'Centuro', replicate: 2 },
          { chamber: 9, treatment: 'N0', replicate: 3 },
          { chamber: 10, treatment: 'eNPower', replicate: 3 },
          { chamber: 11, treatment: 'N200', replicate: 3 },
          { chamber: 12, treatment: 'Centuro', replicate: 3 },
          { chamber: 13, treatment: 'N0', replicate: 4 },
          { chamber: 14, treatment: 'eNPower', replicate: 4 },
          { chamber: 15, treatment: 'N200', replicate: 4 },
          { chamber: 16, treatment: 'Centuro', replicate: 4 }
        ]

        // Get chamber specifications for accurate flux calculation
        let chamberHeight = 15 // default 15cm
        if (site.chamberSpecs && site.chamberSpecs.height_cm) {
          chamberHeight = site.chamberSpecs.height_cm
        }

        const fileResults = processFluxFile(fileContent, chamberConfigs, qualityCriteria, runId, chamberHeight)
        
        // Filter by quality flag
        const filteredResults = fileResults.filter(result => result.quality_flag === 'good')
        allFluxResults.push(...filteredResults)

      } catch (fileError) {
        logger.warn(`Error processing filtered flux file ${file}:`, fileError)
      }
    }

    // Sort by datetime
    allFluxResults.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())

    // Transform for frontend format
    const transformedResults = allFluxResults.map(result => ({
      datetime: result.datetime,
      run_id: result.run_id,
      measurement_start_time: result.measurement_start_time,
      chamber: result.chamber,
      treatment: result.treatment,
      co2_flux: result.co2_flux,
      n2o_flux: result.n2o_flux,
      h2o_avg: result.h2o_avg,
      co2_r2: result.co2_r2,
      n2o_r2: result.n2o_r2,
      passed_qc: result.quality_flag === 'good'
    }))

    res.json(transformedResults)
  } catch (error) {
    logger.error('Error filtering flux data:', error)
    res.status(500).json({ error: 'Failed to filter flux data' })
  }
})

// Helper interfaces for daily/cumulative processing
interface InterpolatedFluxPoint {
  chamber: number
  treatment: string
  datetime: string
  timestamp: number
  co2_flux: number
  n2o_flux: number
  h2o_avg: number
  interpolated: boolean
}

interface DailyFluxPerChamber {
  chamber: number
  treatment: string
  date: string
  co2_flux_daily: number
  n2o_flux_daily: number
  h2o_avg_daily: number
  measurement_count: number
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

// Step 1: Linear interpolation per chamber between measurement cycles
function interpolateFluxPerChamber(
  fluxData: FluxResult[], 
  startDate: string, 
  endDate: string, 
  measurementsPerDay: number
): InterpolatedFluxPoint[] {
  const interpolatedPoints: InterpolatedFluxPoint[] = []
  
  // Group by chamber
  const chamberGroups = new Map<number, FluxResult[]>()
  fluxData.forEach(result => {
    if (!chamberGroups.has(result.chamber)) {
      chamberGroups.set(result.chamber, [])
    }
    chamberGroups.get(result.chamber)!.push(result)
  })

  // Process each chamber
  chamberGroups.forEach((chamberData, chamber) => {
    // Sort by datetime
    chamberData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    
    if (chamberData.length === 0) return
    
    const treatment = chamberData[0].treatment
    
    // Generate target timestamps for interpolation
    const start = new Date(startDate)
    const end = new Date(endDate)
    const millisecondsPerDay = 24 * 60 * 60 * 1000
    const intervalMs = millisecondsPerDay / measurementsPerDay
    
    const targetTimestamps: number[] = []
    for (let current = start.getTime(); current <= end.getTime(); current += intervalMs) {
      targetTimestamps.push(current)
    }
    
    // Interpolate for each target timestamp
    targetTimestamps.forEach(targetTimestamp => {
      const targetDate = new Date(targetTimestamp)
      
      // Find surrounding data points
      let beforePoint: FluxResult | null = null
      let afterPoint: FluxResult | null = null
      
      for (let i = 0; i < chamberData.length; i++) {
        const dataTime = new Date(chamberData[i].datetime).getTime()
        if (dataTime <= targetTimestamp) {
          beforePoint = chamberData[i]
        }
        if (dataTime >= targetTimestamp && !afterPoint) {
          afterPoint = chamberData[i]
          break
        }
      }
      
      let co2_flux: number
      let n2o_flux: number  
      let h2o_avg: number
      let interpolated = false
      
      if (beforePoint && afterPoint && beforePoint !== afterPoint) {
        // Linear interpolation
        const beforeTime = new Date(beforePoint.datetime).getTime()
        const afterTime = new Date(afterPoint.datetime).getTime()
        const ratio = (targetTimestamp - beforeTime) / (afterTime - beforeTime)
        
        co2_flux = beforePoint.co2_flux + (afterPoint.co2_flux - beforePoint.co2_flux) * ratio
        n2o_flux = beforePoint.n2o_flux + (afterPoint.n2o_flux - beforePoint.n2o_flux) * ratio
        h2o_avg = beforePoint.h2o_avg + (afterPoint.h2o_avg - beforePoint.h2o_avg) * ratio
        interpolated = true
      } else if (beforePoint) {
        // Use the closest point (before)
        co2_flux = beforePoint.co2_flux
        n2o_flux = beforePoint.n2o_flux
        h2o_avg = beforePoint.h2o_avg
        interpolated = beforePoint.datetime !== targetDate.toISOString()
      } else if (afterPoint) {
        // Use the closest point (after)
        co2_flux = afterPoint.co2_flux
        n2o_flux = afterPoint.n2o_flux
        h2o_avg = afterPoint.h2o_avg
        interpolated = afterPoint.datetime !== targetDate.toISOString()
      } else {
        // No data available, skip this point
        return
      }
      
      interpolatedPoints.push({
        chamber,
        treatment,
        datetime: targetDate.toISOString(),
        timestamp: targetTimestamp,
        co2_flux,
        n2o_flux,
        h2o_avg,
        interpolated
      })
    })
  })
  
  return interpolatedPoints
}

// Step 2: Calculate daily flux per chamber
function calculateDailyFluxPerChamber(interpolatedData: InterpolatedFluxPoint[]): DailyFluxPerChamber[] {
  const dailyData: DailyFluxPerChamber[] = []
  
  // Group by chamber and date
  const chamberDateGroups = new Map<string, InterpolatedFluxPoint[]>()
  
  interpolatedData.forEach(point => {
    const date = point.datetime.split('T')[0]
    const key = `${point.chamber}_${date}`
    
    if (!chamberDateGroups.has(key)) {
      chamberDateGroups.set(key, [])
    }
    chamberDateGroups.get(key)!.push(point)
  })
  
  // Calculate daily averages per chamber
  chamberDateGroups.forEach((points, key) => {
    const [chamberStr, date] = key.split('_', 2)
    const chamber = parseInt(chamberStr)
    const treatment = points[0].treatment
    
    const co2_flux_daily = points.reduce((sum, p) => sum + p.co2_flux, 0) / points.length
    const n2o_flux_daily = points.reduce((sum, p) => sum + p.n2o_flux, 0) / points.length
    const h2o_avg_daily = points.reduce((sum, p) => sum + p.h2o_avg, 0) / points.length
    
    dailyData.push({
      chamber,
      treatment,
      date,
      co2_flux_daily,
      n2o_flux_daily,
      h2o_avg_daily,
      measurement_count: points.length
    })
  })
  
  return dailyData.sort((a, b) => a.date.localeCompare(b.date) || a.chamber - b.chamber)
}

// Step 3a: Calculate daily flux per treatment (mean ± SE across chambers)
function calculateDailyTreatmentStats(dailyFluxData: DailyFluxPerChamber[]): DailyTreatmentFlux[] {
  const treatmentStats: DailyTreatmentFlux[] = []
  
  // Group by treatment and date
  const treatmentDateGroups = new Map<string, DailyFluxPerChamber[]>()
  
  dailyFluxData.forEach(data => {
    const key = `${data.treatment}_${data.date}`
    if (!treatmentDateGroups.has(key)) {
      treatmentDateGroups.set(key, [])
    }
    treatmentDateGroups.get(key)!.push(data)
  })
  
  // Calculate statistics
  treatmentDateGroups.forEach((chambers, key) => {
    const [treatment, date] = key.split('_', 2)
    
    const co2Values = chambers.map(c => c.co2_flux_daily)
    const n2oValues = chambers.map(c => c.n2o_flux_daily)
    
    const co2_flux_mean = co2Values.reduce((sum, val) => sum + val, 0) / co2Values.length
    const n2o_flux_mean = n2oValues.reduce((sum, val) => sum + val, 0) / n2oValues.length
    
    // Standard error calculation
    const co2_variance = co2Values.reduce((sum, val) => sum + Math.pow(val - co2_flux_mean, 2), 0) / Math.max(1, co2Values.length - 1)
    const n2o_variance = n2oValues.reduce((sum, val) => sum + Math.pow(val - n2o_flux_mean, 2), 0) / Math.max(1, n2oValues.length - 1)
    
    const co2_flux_se = Math.sqrt(co2_variance / co2Values.length)
    const n2o_flux_se = Math.sqrt(n2o_variance / n2oValues.length)
    
    treatmentStats.push({
      date,
      treatment,
      co2_flux_mean,
      co2_flux_se,
      n2o_flux_mean,
      n2o_flux_se,
      chamber_count: chambers.length
    })
  })
  
  return treatmentStats.sort((a, b) => a.date.localeCompare(b.date))
}

// Step 3b: Calculate cumulative flux per treatment
function calculateCumulativeTreatmentStats(dailyFluxData: DailyFluxPerChamber[]): CumulativeTreatmentFlux[] {
  const cumulativeStats: CumulativeTreatmentFlux[] = []
  
  // First, calculate cumulative flux per chamber
  const chamberCumulatives = new Map<number, { co2: number; n2o: number }>()
  const dates = [...new Set(dailyFluxData.map(d => d.date))].sort()
  
  dates.forEach(date => {
    // Get data for this date
    const dateData = dailyFluxData.filter(d => d.date === date)
    
    // Update cumulative values per chamber
    dateData.forEach(data => {
      const prev = chamberCumulatives.get(data.chamber) || { co2: 0, n2o: 0 }
      chamberCumulatives.set(data.chamber, {
        co2: prev.co2 + data.co2_flux_daily,
        n2o: prev.n2o + data.n2o_flux_daily
      })
    })
    
    // Group by treatment for this date
    const treatmentGroups = new Map<string, Array<{ chamber: number; co2_cumulative: number; n2o_cumulative: number }>>()
    
    dateData.forEach(data => {
      const cumulative = chamberCumulatives.get(data.chamber)!
      if (!treatmentGroups.has(data.treatment)) {
        treatmentGroups.set(data.treatment, [])
      }
      treatmentGroups.get(data.treatment)!.push({
        chamber: data.chamber,
        co2_cumulative: cumulative.co2,
        n2o_cumulative: cumulative.n2o
      })
    })
    
    // Calculate treatment statistics for cumulative values
    treatmentGroups.forEach((chambers, treatment) => {
      const co2Values = chambers.map(c => c.co2_cumulative)
      const n2oValues = chambers.map(c => c.n2o_cumulative)
      
      const co2_flux_cumulative_mean = co2Values.reduce((sum, val) => sum + val, 0) / co2Values.length
      const n2o_flux_cumulative_mean = n2oValues.reduce((sum, val) => sum + val, 0) / n2oValues.length
      
      // Standard error calculation
      const co2_variance = co2Values.reduce((sum, val) => sum + Math.pow(val - co2_flux_cumulative_mean, 2), 0) / Math.max(1, co2Values.length - 1)
      const n2o_variance = n2oValues.reduce((sum, val) => sum + Math.pow(val - n2o_flux_cumulative_mean, 2), 0) / Math.max(1, n2oValues.length - 1)
      
      const co2_flux_cumulative_se = Math.sqrt(co2_variance / co2Values.length)
      const n2o_flux_cumulative_se = Math.sqrt(n2o_variance / n2oValues.length)
      
      cumulativeStats.push({
        date,
        treatment,
        co2_flux_cumulative_mean,
        co2_flux_cumulative_se,
        n2o_flux_cumulative_mean,
        n2o_flux_cumulative_se,
        chamber_count: chambers.length
      })
    })
  })
  
  return cumulativeStats
}

// Get daily/cumulative flux data (Section d)
router.get('/:siteId/daily-cumulative-flux', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { 
      startDate,
      endDate,
      co2_r2_min = '0.6',
      n2o_r2_min = '0.6',
      n2o_flux_min = '-5',
      time_head = '200',
      time_tail = '300'
    } = req.query

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Start date and end date are required' })
      return
    }

    // Read site registry
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Apply quality criteria
    const qualityCriteria: QualityControlCriteria = {
      co2_r2_min: parseFloat(co2_r2_min as string),
      n2o_r2_min: parseFloat(n2o_r2_min as string),
      n2o_flux_min: parseFloat(n2o_flux_min as string),
      time_head: parseInt(time_head as string),
      time_tail: parseInt(time_tail as string)
    }

    // Get chamber specifications
    const measurementsPerDay = site.chamberSpecs?.measurements_per_day || 6
    let chamberHeight = 15
    if (site.chamberSpecs && site.chamberSpecs.height_cm) {
      chamberHeight = site.chamberSpecs.height_cm
    }

    const dataPath = path.join(__dirname, '../../../', site.dataPath)
    const files = await fs.readdir(dataPath)
    const csvFiles = files.filter(f => f.endsWith('.csv'))

    let allFluxResults: FluxResult[] = []

    // Process each CSV file
    for (const file of csvFiles) {
      try {
        const filePath = path.join(dataPath, file)
        const fileContent = await fs.readFile(filePath, 'utf-8')
        
        // Extract date and run_id from filename for filtering
        const filenameParts = file.replace('.csv', '').split('_')
        let fileDate = ''
        let runId = ''
        if (filenameParts.length >= 3) {
          const dateStr = filenameParts[1]
          const timeStr = filenameParts[2]
          runId = `${dateStr}_${timeStr}`
          
          if (dateStr.length === 8) {
            const day = dateStr.substring(0, 2)
            const month = dateStr.substring(2, 4)
            const year = dateStr.substring(4, 8)
            fileDate = `${year}-${month}-${day}`
          }
        }

        // Apply date filtering
        if (startDate && fileDate && fileDate < startDate) continue
        if (endDate && fileDate && fileDate > endDate) continue

        // Get chamber configurations
        const chamberConfigs = site.chamberConfigs || [
          { chamber: 1, treatment: 'N0', replicate: 1 },
          { chamber: 2, treatment: 'eNPower', replicate: 1 },
          { chamber: 3, treatment: 'N200', replicate: 1 },
          { chamber: 4, treatment: 'Centuro', replicate: 1 },
          { chamber: 5, treatment: 'N0', replicate: 2 },
          { chamber: 6, treatment: 'eNPower', replicate: 2 },
          { chamber: 7, treatment: 'N200', replicate: 2 },
          { chamber: 8, treatment: 'Centuro', replicate: 2 },
          { chamber: 9, treatment: 'N0', replicate: 3 },
          { chamber: 10, treatment: 'eNPower', replicate: 3 },
          { chamber: 11, treatment: 'N200', replicate: 3 },
          { chamber: 12, treatment: 'Centuro', replicate: 3 },
          { chamber: 13, treatment: 'N0', replicate: 4 },
          { chamber: 14, treatment: 'eNPower', replicate: 4 },
          { chamber: 15, treatment: 'N200', replicate: 4 },
          { chamber: 16, treatment: 'Centuro', replicate: 4 }
        ]

        const fileResults = processFluxFile(fileContent, chamberConfigs, qualityCriteria, runId, chamberHeight)
        
        // Filter by quality flag
        const filteredResults = fileResults.filter(result => result.quality_flag === 'good')
        allFluxResults.push(...filteredResults)

      } catch (fileError) {
        logger.warn(`Error processing daily flux file ${file}:`, fileError)
      }
    }

    // Execute the processing pipeline
    
    // Step 1: Linear interpolation per chamber
    const interpolatedData = interpolateFluxPerChamber(allFluxResults, startDate as string, endDate as string, measurementsPerDay)
    
    // Step 2: Daily aggregation per chamber
    const dailyFluxPerChamber = calculateDailyFluxPerChamber(interpolatedData)
    
    // Step 3a: Daily flux per treatment
    const dailyTreatmentStats = calculateDailyTreatmentStats(dailyFluxPerChamber)
    
    // Step 3b: Cumulative flux per treatment
    const cumulativeTreatmentStats = calculateCumulativeTreatmentStats(dailyFluxPerChamber)

    res.json({
      daily: dailyTreatmentStats,
      cumulative: cumulativeTreatmentStats,
      metadata: {
        total_interpolated_points: interpolatedData.length,
        daily_chamber_points: dailyFluxPerChamber.length,
        measurements_per_day: measurementsPerDay,
        date_range: { startDate, endDate }
      }
    })
  } catch (error) {
    logger.error('Error calculating daily cumulative flux data:', error)
    res.status(500).json({ error: 'Failed to calculate daily cumulative flux data' })
  }
})

// Get linear regression analysis for specific chamber and file
router.get('/:siteId/linear-regression', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { file, chamber, gas, timeHead = '200', timeTail = '300' } = req.query

    if (!file || !chamber || !gas) {
      res.status(400).json({ error: 'File, chamber, and gas parameters are required' })
      return
    }

    // Read site registry to get data path
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Read specific CSV file
    const dataPath = path.join(__dirname, '../../../', site.dataPath)
    const filePath = path.join(dataPath, file as string)
    
    // Security check - ensure file is within data directory
    if (!filePath.startsWith(dataPath)) {
      res.status(400).json({ error: 'Invalid file path' })
      return
    }

    const fileContent = await fs.readFile(filePath, 'utf-8')
    const chamberMeasurements = parseAndGroupByChamber(fileContent)
    
    const targetChamber = parseInt(chamber as string)
    const chamberData = chamberMeasurements.find(c => c.chamber === targetChamber)
    
    if (!chamberData) {
      res.status(404).json({ error: 'Chamber not found in file' })
      return
    }

    // Map gas name to field
    const gasField = gas === 'co2' ? 'co2_ppm' : 
                     gas === 'n2o' ? 'n2o_ppb' : 'h2o_ppm'

    // Calculate linear regression
    const regressionResult = calculateLinearRegression(
      chamberData.measurements,
      gasField as 'co2_ppm' | 'n2o_ppb' | 'h2o_ppm',
      parseInt(timeHead as string),
      parseInt(timeTail as string)
    )

    // Get chamber specifications for accurate flux calculation
    let chamberHeight = 15 // default 15cm
    if (site.chamberSpecs && site.chamberSpecs.height_cm) {
      chamberHeight = site.chamberSpecs.height_cm
    }
    
    // Convert slope to flux if needed
    let fluxRate = null
    if (gas === 'co2' || gas === 'n2o') {
      fluxRate = convertToFlux(regressionResult.slope, gas as 'co2' | 'n2o', chamberHeight)
    }

    res.json({
      chamber: targetChamber,
      gas,
      regression: regressionResult,
      flux_rate: fluxRate,
      flux_units: gas === 'co2' ? 'kg C/ha/d' : gas === 'n2o' ? 'g N/ha/d' : null,
      measurement_window: {
        head_seconds: parseInt(timeHead as string),
        tail_seconds: parseInt(timeTail as string),
        total_points: chamberData.measurements.length,
        points_used: regressionResult.points_used
      }
    })
  } catch (error) {
    logger.error('Error calculating linear regression:', error)
    res.status(500).json({ error: 'Failed to calculate linear regression' })
  }
})

export default router