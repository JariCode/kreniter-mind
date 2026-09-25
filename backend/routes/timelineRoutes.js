const express = require('express')
const Timeline = require('../models/Timeline')

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
    const selectedProjectId =
      req.body.selectedProjectId || null

    const timeline =
      await Timeline.findOneAndUpdate(
        { userId: req.user._id },
        {
          userId: req.user._id,
          selectedProjectId,
        },
        {
          new: true,
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