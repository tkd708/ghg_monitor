import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { authenticate } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()

interface ChamberConfig {
  chamber: number
  treatment: string
  replicate: number
  description?: string
}

// Get all sites
router.get('/', authenticate, async (_req, res): Promise<void> => {
  try {
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const data = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(data)
    res.json(registry.sites)
  } catch (error) {
    logger.error('Error reading site registry:', error)
    res.status(500).json({ error: 'Failed to load sites' })
  }
})

// Get single site
router.get('/:siteId', authenticate, async (req, res): Promise<void> => {
  try {
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const data = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(data)
    const site = registry.sites.find((s: any) => s.id === req.params.siteId)
    
    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }
    
    res.json(site)
  } catch (error) {
    logger.error('Error reading site:', error)
    res.status(500).json({ error: 'Failed to load site' })
  }
})

// Update chamber configuration for a site
router.put('/:siteId/chamber-config', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { chambers, configs }: { chambers: number; configs: ChamberConfig[] } = req.body

    // Read current site registry
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const data = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(data)
    
    // Find the site to update
    const siteIndex = registry.sites.findIndex((s: any) => s.id === siteId)
    if (siteIndex === -1) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Update the site configuration
    registry.sites[siteIndex].chambers = chambers
    registry.sites[siteIndex].chamberConfigs = configs
    registry.lastUpdated = new Date().toISOString()

    // Write updated registry back to file
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2))

    logger.info(`Updated chamber configuration for site ${siteId}`)
    res.json({ 
      message: 'Chamber configuration updated successfully',
      site: registry.sites[siteIndex]
    })
  } catch (error) {
    logger.error('Error updating chamber configuration:', error)
    res.status(500).json({ error: 'Failed to update chamber configuration' })
  }
})

// Get chamber specifications for a site
router.get('/:siteId/chamber-specs', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params

    // Read site registry to get chamber specs
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    const site = registry.sites.find((s: any) => s.id === siteId)

    if (!site) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Return chamber specifications if they exist
    res.json(site.chamberSpecs || [])
  } catch (error) {
    logger.error('Error reading chamber specifications:', error)
    res.status(500).json({ error: 'Failed to load chamber specifications' })
  }
})

// Update chamber specifications for a site
router.put('/:siteId/chamber-specs', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const { chamberSpecs } = req.body

    if (!chamberSpecs || typeof chamberSpecs !== 'object') {
      res.status(400).json({ error: 'Invalid chamber specifications format' })
      return
    }

    // Read current site registry
    const registryPath = path.join(__dirname, '../../../data/site_registry.json')
    const registryData = await fs.readFile(registryPath, 'utf-8')
    const registry = JSON.parse(registryData)
    
    const siteIndex = registry.sites.findIndex((s: any) => s.id === siteId)
    if (siteIndex === -1) {
      res.status(404).json({ error: 'Site not found' })
      return
    }

    // Update chamber specifications
    registry.sites[siteIndex].chamberSpecs = chamberSpecs
    registry.lastUpdated = new Date().toISOString()

    // Write back to file
    await fs.writeFile(registryPath, JSON.stringify(registry, null, 2))

    logger.info(`Updated chamber specifications for site ${siteId}`)
    res.json({ success: true, chamberSpecs })
  } catch (error) {
    logger.error('Error updating chamber specifications:', error)
    res.status(500).json({ error: 'Failed to save chamber specifications' })
  }
})

export default router