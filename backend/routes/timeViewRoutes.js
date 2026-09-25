const express = require('express')
const TimeView = require('../models/TimeView')

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
    const selectedProjectId =
      req.body.selectedProjectId || null

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
          new: true,
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