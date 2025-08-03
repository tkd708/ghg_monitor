import express from 'express'
import cors from 'cors'
import compression from 'compression'
import dotenv from 'dotenv'
import path from 'path'
import authRoutes from './routes/auth'
import sitesRoutes from './routes/sites'
import dataRoutes from './routes/data'
import photosRoutes from './routes/photos'
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Enable gzip compression
app.use(compression())

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Static files for photos
app.use('/uploads', express.static(path.join(__dirname, '../../data/uploads')))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/sites', sitesRoutes)
app.use('/api/sites', dataRoutes)
app.use('/api/sites', photosRoutes)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist')
  
  // Serve static files with caching
  app.use(express.static(frontendPath, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      // Don't cache HTML files
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      }
    }
  }))
  
  // Handle React routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendPath, 'index.html'))
    } else {
      res.status(404).json({ error: 'Not found' })
    }
  })
}

// Error handling
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  if (process.env.NODE_ENV === 'production') {
    logger.info('Serving frontend from Express')
  }
})