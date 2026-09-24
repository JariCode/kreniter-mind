const rateLimit = require('express-rate-limit')

// API rate limiting

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please try again later.',
  },
})

module.exports = {
  apiLimiter,
}