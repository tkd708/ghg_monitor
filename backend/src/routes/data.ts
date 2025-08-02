import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { parse } from 'csv-parse/sync'
import { authenticate } from '../middleware/auth'
import { logger } from '../utils/logger'

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
          const datetime = new Date(`${record.date} ${record.time}`)
          
          // Apply filters
          if (startDate && datetime < new Date(startDate as string)) continue
          if (endDate && datetime > new Date(endDate as string)) continue
          if (chamber && record['chamber id'] !== chamber) continue

          // Add processed data
          allData.push({
            datetime: datetime.toISOString(),
            chamber: parseInt(record['chamber id']),
            chamber_label: `C${String(record['chamber id']).padStart(2, '0')}`,
            co2_ppm: parseFloat(record['co2[ppm]']),
            n2o_ppb: parseFloat(record['n2o avg [ppb]']),
            n2o_ppm: parseFloat(record['n2o avg [ppb]']) / 1000,
            h2o_ppm: parseFloat(record['h2o avg[ppm]']),
            status: record.status,
            pair_kpa: parseFloat(record['pair[kpa]']),
            run_id: record['run id'],
            site_id: record['site id'],
          })
        }
      } catch (fileError) {
        logger.warn(`Error processing file ${file}:`, fileError)
      }
    }

    // Sort by datetime
    allData.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())

    res.json({
      data: allData,
      totalRecords: allData.length,
      site: site.name,
    })
  } catch (error) {
    logger.error('Error reading flux data:', error)
    res.status(500).json({ error: 'Failed to load flux data' })
  }
})

export default router