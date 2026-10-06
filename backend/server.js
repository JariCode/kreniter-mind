require('dotenv').config()

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const { clerkMiddleware } = require('@clerk/express')

const connectDatabase = require('./utils/database')
const { apiLimiter, aiLimiter } = require('./middleware/rateLimiter')
const authMiddleware = require('./middleware/authMiddleware')
const sanitize = require('./middleware/sanitize')

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
const aiRoutes = require('./routes/aiRoutes')
const folderRoutes = require('./routes/folderRoutes')
const fileRoutes = require('./routes/fileRoutes')
const reportsViewRoutes = require('./routes/reportsViewRoutes')
const calendarEventRoutes = require('./routes/calendarEventRoutes')
const calendarRoutes = require('./routes/calendarRoutes')
const webhookRoutes = require('./routes/webhookRoutes')

const app = express()
const PORT = process.env.PORT || 5000

// Thrown by the CORS origin check below so the error handler can tell a
// disallowed origin apart from any other error reaching it.
class CorsOriginError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CorsOriginError'
  }
}

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

// This is a JSON-only API with no browser UI, so deny every browser
// feature helmet doesn't already cover via Permissions-Policy.
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  )
  next()
})

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

      return callback(
        new CorsOriginError('Origin not allowed by CORS')
      )
    },
  })
)

// Clerk webhooks: mounted before the app-wide body parsers below, since
// signature verification needs the exact raw request body. Not behind
// authMiddleware -- the caller is Clerk, not a signed-in user.
app.use('/api/webhooks', webhookRoutes)

// Rate limiting
app.use('/api', apiLimiter)

// Request body limits
app.use(
  express.json({
    limit: '10mb',
  })
)

app.use(
  express.urlencoded({
    extended: false,
    limit: '10mb',
  })
)

// NoSQL injection protection
app.use(sanitize)

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
app.use('/api/ai', aiLimiter, authMiddleware, aiRoutes)
app.use('/api/folders', authMiddleware, folderRoutes)
app.use('/api/files', authMiddleware, fileRoutes)
app.use('/api/reports-view', authMiddleware, reportsViewRoutes)
app.use('/api/calendar-events', authMiddleware, calendarEventRoutes)
app.use('/api/calendar', authMiddleware, calendarRoutes)

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
  })
})

// Error handler
app.use((err, req, res, next) => {
  // Bad input from the client, not a server fault -- return 400 with a
  // generic message instead of Mongoose's own text, which would leak
  // field/model names. Not logged as an error since it isn't one.
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid ID',
    })
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Invalid input',
    })
  }

  // Malformed JSON body -- a client mistake, not a server fault.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON',
    })
  }

  // Body over the express.json()/urlencoded() size limit.
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request too large',
    })
  }

  // Disallowed CORS origin, raised as CorsOriginError above.
  if (err.name === 'CorsOriginError') {
    return res.status(403).json({
      error: 'Origin not allowed',
    })
  }

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