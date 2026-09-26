const express = require('express')
const mongoose = require('mongoose')
const ReportsView = require('../models/ReportsView')

const router = express.Router()

// Get reports view
router.get('/', async (req, res, next) => {
  try {
    const reportsView = await ReportsView.findOne({
      userId: req.user._id,
    })

    if (!reportsView) {
      return res.json({
        selectedProjectId: null,
      })
    }

    res.json(reportsView)
  } catch (error) {
    next(error)
  }
})

// Save reports view
router.put('/', async (req, res, next) => {
  try {
    const {
      selectedProjectId = null,
    } = req.body

    if (
      selectedProjectId &&
      !mongoose.Types.ObjectId.isValid(
        selectedProjectId
      )
    ) {
      return res.status(400).json({
        error: 'Invalid project ID',
      })
    }

    const reportsView =
      await ReportsView.findOneAndUpdate(
        {
          userId: req.user._id,
        },
        {
          userId: req.user._id,
          selectedProjectId,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      )

    res.json(reportsView)
  } catch (error) {
    next(error)
  }
})

module.exports = router