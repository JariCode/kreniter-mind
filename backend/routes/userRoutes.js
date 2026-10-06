const express = require('express')
const User = require('../models/User')
const router = express.Router()

// Get current authenticated user
router.get('/me', async (req, res, next) => {
  try {
    res.json({
      user: req.user,
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router