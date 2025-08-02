import { Router } from 'express'
import multer from 'multer'
import fs from 'fs/promises'
import path from 'path'
import { authenticate } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    const { siteId } = req.params
    const uploadDir = path.join(__dirname, '../../../data', siteId, 'photos')
    
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error as any, '')
    }
  },
  filename: (_req, file, cb) => {
    const timestamp = new Date().toISOString().split('T')[0]
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
    cb(null, `${timestamp}_${sanitizedName}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  },
})

// Get photos for a site
router.get('/:siteId/photos', authenticate, async (req, res): Promise<void> => {
  try {
    const { siteId } = req.params
    const photosDir = path.join(__dirname, '../../../data', siteId, 'photos')
    
    try {
      const files = await fs.readdir(photosDir)
      const photos = []
      
      for (const file of files) {
        if (file.endsWith('.json')) continue // Skip metadata files
        
        const filePath = path.join(photosDir, file)
        const stats = await fs.stat(filePath)
        
        photos.push({
          id: file,
          filename: file,
          path: `/uploads/${siteId}/photos/${file}`,
          uploadDate: stats.birthtime.toISOString(),
          size: stats.size,
          mimeType: `image/${path.extname(file).slice(1)}`,
        })
      }
      
      res.json(photos)
    } catch (dirError) {
      // Directory doesn't exist yet
      res.json([])
    }
  } catch (error) {
    logger.error('Error reading photos:', error)
    res.status(500).json({ error: 'Failed to load photos' })
  }
})

// Upload photos
router.post('/:siteId/photos', authenticate, upload.array('photos', 10), async (req, res): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[]
    const { description, tags } = req.body
    
    const uploadedFiles = files.map(file => ({
      id: file.filename,
      filename: file.filename,
      originalName: file.originalname,
      path: `/uploads/${req.params.siteId}/photos/${file.filename}`,
      size: file.size,
      mimeType: file.mimetype,
      uploadDate: new Date().toISOString(),
      description,
      tags: tags ? tags.split(',').map((tag: string) => tag.trim()) : [],
    }))
    
    res.json({
      message: 'Photos uploaded successfully',
      files: uploadedFiles,
    })
  } catch (error) {
    logger.error('Error uploading photos:', error)
    res.status(500).json({ error: 'Failed to upload photos' })
  }
})

export default router