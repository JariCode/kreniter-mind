const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const { getAuth } = require('@clerk/express')

// Builds the rate limit key: the Clerk userId when available, otherwise the IP.
// clerkMiddleware runs before the limiters in server.js, so getAuth works here.
function userOrIpKeyGenerator(req) {
  const { userId } = getAuth(req)

  if (userId) {
    return userId
  }

  return ipKeyGenerator(req.ip)
}

// API rate limiting

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    error: 'Too many requests. Please try again later.',
  },
})

// AI routes rate limiting

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    error: 'Too many requests. Please try again later.',
  },
})

// AI image generation rate limiting

const aiImageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: {
    error: 'Too many requests. Please try again later.',
  },
})

module.exports = {
  apiLimiter,
  aiLimiter,
  aiImageLimiter,
}
