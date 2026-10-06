const express = require('express')
const mongoose = require('mongoose')
const CalendarEvent = require('../models/CalendarEvent')
const {
  MAX_RANGE_DAYS,
  parseDateOnly,
  buildEventData,
} = require('../utils/calendarEventValidation')

const router = express.Router()

// Get calendar events in a date range for the current user
router.get('/', async (req, res, next) => {
  try {
    const from = parseDateOnly(req.query.from)
    const to = parseDateOnly(req.query.to)

    if (!from || !to) {
      return res.status(400).json({
        error: 'from and to must be valid dates',
      })
    }

    if (to < from) {
      return res.status(400).json({
        error: 'to must not be before from',
      })
    }

    const rangeDays =
      Math.round((to - from) / 86400000) + 1

    if (rangeDays > MAX_RANGE_DAYS) {
      return res.status(400).json({
        error: 'Date range is too long',
      })
    }

    const events = await CalendarEvent.find({
      userId: req.user._id,
      date: { $gte: from, $lte: to },
    }).sort({ date: 1, startTime: 1 })

    res.json(events)
  } catch (error) {
    next(error)
  }
})

// Create calendar event
router.post('/', async (req, res, next) => {
  try {
    const result = await buildEventData(
      req.user._id,
      req.body
    )

    if (result.error) {
      return res
        .status(result.status)
        .json({ error: result.error })
    }

    const event = await CalendarEvent.create({
      userId: req.user._id,
      ...result.data,
    })

    res.status(201).json(event)
  } catch (error) {
    next(error)
  }
})

// Update calendar event
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid calendar event ID',
      })
    }

    const result = await buildEventData(
      req.user._id,
      req.body
    )

    if (result.error) {
      return res
        .status(result.status)
        .json({ error: result.error })
    }

    const event = await CalendarEvent.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      result.data,
      {
        returnDocument: 'after',
        runValidators: true,
      }
    )

    if (!event) {
      return res.status(404).json({
        error: 'Calendar event not found',
      })
    }

    res.json(event)
  } catch (error) {
    next(error)
  }
})

// Delete calendar event
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid calendar event ID',
      })
    }

    const event = await CalendarEvent.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    })

    if (!event) {
      return res.status(404).json({
        error: 'Calendar event not found',
      })
    }

    res.json({
      message: 'Calendar event deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
