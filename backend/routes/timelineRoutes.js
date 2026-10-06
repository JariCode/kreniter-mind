const express = require('express')
const Timeline = require('../models/Timeline')
const {
  validateSelectedProjectId,
} = require('../utils/viewSelectionValidation')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    let timeline = await Timeline.findOne({
      userId: req.user._id,
    })

    if (!timeline) {
      timeline = await Timeline.create({
        userId: req.user._id,
        selectedProjectId: null,
      })
    }

    res.json(timeline)
  } catch (error) {
    next(error)
  }
})

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

    const timeline =
      await Timeline.findOneAndUpdate(
        { userId: req.user._id },
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

    res.json(timeline)
  } catch (error) {
    next(error)
  }
})

module.exports = router