const express = require('express')
const TimeView = require('../models/TimeView')
const {
  validateSelectedProjectId,
} = require('../utils/viewSelectionValidation')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    let timeView = await TimeView.findOne({
      userId: req.user._id,
    })

    if (!timeView) {
      timeView = await TimeView.create({
        userId: req.user._id,
        selectedProjectId: null,
      })
    }

    res.json(timeView)
  } catch (error) {
    next(error)
  }
})

router.put('/', async (req, res, next) => {
  try {
    // The Time view stores "No project" as the 'no-project' sentinel.
    const validation = await validateSelectedProjectId(
      req.user._id,
      req.body.selectedProjectId,
      { allowNoProject: true }
    )

    if (validation.error) {
      return res.status(validation.status).json({
        error: validation.error,
      })
    }

    const { selectedProjectId } = validation

    const timeView =
      await TimeView.findOneAndUpdate(
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

    res.json(timeView)
  } catch (error) {
    next(error)
  }
})

module.exports = router