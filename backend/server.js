require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { clerkMiddleware } = require('@clerk/express')

const connectDatabase = require('./utils/database')
const { apiLimiter } = require('./middleware/rateLimiter')
const authMiddleware = require('./middleware/authMiddleware')

const projectRoutes = require('./routes/projectRoutes')
const taskRoutes = require('./routes/taskRoutes')
const noteRoutes = require('./routes/noteRoutes')
const timeEntryRoutes = require('./routes/timeEntryRoutes')
const userRoutes = require('./routes/userRoutes')
const dashboardLayoutRoutes = require('./routes/dashboardLayoutRoutes')
const activeTimerRoutes = require('./routes/activeTimerRoutes')
const timelineRoutes = require('./routes/timelineRoutes')
const tasksViewRoutes = require('./routes/tasksViewRoutes')
const timeViewRoutes = require('./routes/timeViewRoutes')

const app = express()
const PORT = process.env.PORT || 5000

// Allowed frontend origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// Trust the reverse proxy used in production
app.set('trust proxy', 1)

// Security
app.disable('x-powered-by')

app.use(helmet())

app.use(clerkMiddleware())

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true)
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error('Origin not allowed by CORS'))
    },
  })
)

// Rate limiting
app.use('/api', apiLimiter)

// Request body limits
app.use(
  express.json({
    limit: '1mb',
  })
)

app.use(
  express.urlencoded({
    extended: false,
    limit: '1mb',
  })
)

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Kreniter Mind API is running',
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
  })
})

// Routes
app.use('/api/projects', authMiddleware, projectRoutes)
app.use('/api/tasks', authMiddleware, taskRoutes)
app.use('/api/notes', authMiddleware, noteRoutes)
app.use('/api/time-entries', authMiddleware, timeEntryRoutes)
app.use('/api/users', authMiddleware, userRoutes)
app.use('/api/dashboard-layout', authMiddleware, dashboardLayoutRoutes)
app.use('/api/active-timer', authMiddleware, activeTimerRoutes)
app.use('/api/timeline', authMiddleware, timelineRoutes)
app.use('/api/tasks-view', authMiddleware, tasksViewRoutes)
app.use('/api/time-view', authMiddleware, timeViewRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error(err)

  res.status(500).json({
    error: 'Internal server error',
  })
})

// Start server after database connection
async function startServer() {
  await connectDatabase()

  app.listen(PORT, () => {
    console.log(`Kreniter Mind backend running on port ${PORT}`)
  })
}

startServer()