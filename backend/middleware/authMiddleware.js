const { getAuth } = require('@clerk/express')
const User = require('../models/User')

async function authMiddleware(req, res, next) {
  const { isAuthenticated, userId: clerkId } = getAuth(req)

  if (!isAuthenticated || !clerkId) {
    return res.status(401).json({
      error: 'Unauthorized',
    })
  }

  try {
    const user = await User.findOneAndUpdate(
      { clerkId },
      { clerkId },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    )

    req.user = user

    next()
  } catch (error) {
    next(error)
  }
}

module.exports = authMiddleware