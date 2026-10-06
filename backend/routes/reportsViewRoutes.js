const express = require('express')
const ReportsView = require('../models/ReportsView')
const {
  validateSelectedProjectId,
} = require('../utils/viewSelectionValidation')

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
    const validation = await validateSelectedProjectId(
      req.user._id,
      req.body.selectedProjectId
    )

    if (validation.error) {
      return res.status(validation.status).json({
        error: validation.error,
      })
    }

    const { selectedProjectId } = validation

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
          returnDocument: 'after',
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      )

    res.json(reportsView)
  } catch (error) {
    next(error)
  }
})

module.exports = router