const express = require('express')
const mongoose = require('mongoose')
const CalendarEvent = require('../models/CalendarEvent')
const Project = require('../models/Project')

const router = express.Router()

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_RANGE_DAYS = 366

// Parses a "YYYY-MM-DD" (or any Date-parseable) day-only string into a
// Date at midnight, or null if it isn't a valid date.
function parseDateOnly(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

// Validates and normalizes the fields shared by create and update. Both
// treat the request as a full replace of every field (like the other
// resources' PATCH routes in this app), so this is used identically by
// POST and PATCH. Returns { error, status } or { data }.
async function buildEventData(userId, body) {
  const title =
    typeof body.title === 'string' ? body.title.trim() : ''

  if (!title) {
    return { error: 'Title is required', status: 400 }
  }

  const date = parseDateOnly(body.date)

  if (!date) {
    return { error: 'A valid date is required', status: 400 }
  }

  const description =
    typeof body.description === 'string'
      ? body.description
      : ''

  const allDay = body.allDay !== false

  let startTime = null
  let endTime = null

  if (!allDay) {
    startTime = body.startTime
    endTime = body.endTime

    if (
      typeof startTime !== 'string' ||
      !TIME_PATTERN.test(startTime)
    ) {
      return { error: 'Invalid time', status: 400 }
    }

    if (
      typeof endTime !== 'string' ||
      !TIME_PATTERN.test(endTime)
    ) {
      return { error: 'Invalid time', status: 400 }
    }

    if (endTime <= startTime) {
      return {
        error: 'End time must be after start time',
        status: 400,
      }
    }
  }

  let projectId = null

  if (body.projectId) {
    if (!mongoose.Types.ObjectId.isValid(body.projectId)) {
      return { error: 'Invalid project ID', status: 400 }
    }

    const project = await Project.findOne({
      _id: body.projectId,
      userId,
    })

    if (!project) {
      return { error: 'Project not found', status: 404 }
    }

    projectId = body.projectId
  }

  return {
    data: {
      title,
      description,
      date,
      allDay,
      startTime,
      endTime,
      projectId,
    },
  }
}

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
