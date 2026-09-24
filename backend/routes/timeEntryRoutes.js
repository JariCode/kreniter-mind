const express = require('express')
const TimeEntry = require('../models/TimeEntry')

const router = express.Router()

// Get all time entries
router.get('/', async (req, res, next) => {
  try {
    const timeEntries = await TimeEntry.find().sort({ startedAt: -1 })

    res.json(timeEntries)
  } catch (error) {
    next(error)
  }
})

// Get one time entry
router.get('/:id', async (req, res, next) => {
  try {
    const timeEntry = await TimeEntry.findById(req.params.id)

    if (!timeEntry) {
      return res.status(404).json({
        error: 'Time entry not found',
      })
    }

    res.json(timeEntry)
  } catch (error) {
    next(error)
  }
})

// Create time entry
router.post('/', async (req, res, next) => {
  try {
    const timeEntry = await TimeEntry.create({
      projectId: req.body.projectId,
      description: req.body.description,
      duration: req.body.duration,
      startedAt: req.body.startedAt,
    })

    res.status(201).json(timeEntry)
  } catch (error) {
    next(error)
  }
})

// Update time entry
router.patch('/:id', async (req, res, next) => {
  try {
    const timeEntry = await TimeEntry.findByIdAndUpdate(
      req.params.id,
      {
        projectId: req.body.projectId,
        description: req.body.description,
        duration: req.body.duration,
        startedAt: req.body.startedAt,
      },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!timeEntry) {
      return res.status(404).json({
        error: 'Time entry not found',
      })
    }

    res.json(timeEntry)
  } catch (error) {
    next(error)
  }
})

// Delete time entry
router.delete('/:id', async (req, res, next) => {
  try {
    const timeEntry = await TimeEntry.findByIdAndDelete(req.params.id)

    if (!timeEntry) {
      return res.status(404).json({
        error: 'Time entry not found',
      })
    }

    res.json({
      message: 'Time entry deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router