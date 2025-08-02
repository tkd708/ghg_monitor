import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'
import { authenticate } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()

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

export default router