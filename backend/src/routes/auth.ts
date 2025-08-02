import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

const router = Router()

// Simple password verification
router.post('/verify', async (req, res): Promise<void> => {
  const { password } = req.body

  if (!password) {
    res.status(400).json({ error: 'Password required' })
    return
  }

  try {
    // In production, store hashed password in environment variable
    const validPassword = await bcrypt.compare(
      password,
      process.env.HASHED_PASSWORD || '$2a$10$Pny65Gtf5HLXgFlur0uZZO82m.iFL4So.LgDw9yWJGSZLYutroM9i' // default: "ghgmonitor"
    )

    if (!validPassword) {
      res.status(401).json({ error: 'Invalid password' })
      return
    }

    const token = jwt.sign(
      { id: 'user-1', role: 'admin' },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    )

    res.json({ token })
  } catch (error) {
    logger.error('Auth error:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
})

export default router