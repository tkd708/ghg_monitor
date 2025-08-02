import express from 'express'
import cors from 'cors'
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

// Error handling
app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
})