const express = require('express')
const TimeEntry = require('../models/TimeEntry')
const Project = require('../models/Project')
const Task = require('../models/Task')

const router = express.Router()

// Get all time entries for current user
router.get('/', async (req, res, next) => {
  try {
    const timeEntries = await TimeEntry.find({
      userId: req.user._id,
    }).sort({ startedAt: -1 })

    res.json(timeEntries)
  } catch (error) {
    next(error)
  }
})

// Get one time entry for current user
router.get('/:id', async (req, res, next) => {
  try {
    const timeEntry = await TimeEntry.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })

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
    if (req.body.projectId) {
      const project = await Project.findOne({
        _id: req.body.projectId,
        userId: req.user._id,
      })

      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
        })
      }
    }

    if (req.body.taskId) {
      const task = await Task.findOne({
        _id: req.body.taskId,
        userId: req.user._id,
      })

      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
        })
      }

      if (
        req.body.projectId &&
        task.projectId &&
        String(task.projectId) !== String(req.body.projectId)
      ) {
        return res.status(400).json({
          error: 'Task must belong to the selected project',
        })
      }
    }

    const timeEntry = await TimeEntry.create({
      userId: req.user._id,
      projectId: req.body.projectId,
      taskId: req.body.taskId,
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
    const timeEntry = await TimeEntry.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!timeEntry) {
      return res.status(404).json({
        error: 'Time entry not found',
      })
    }

    if (req.body.projectId) {
      const project = await Project.findOne({
        _id: req.body.projectId,
        userId: req.user._id,
      })

      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
        })
      }
    }

    if (req.body.taskId) {
      const task = await Task.findOne({
        _id: req.body.taskId,
        userId: req.user._id,
      })

      if (!task) {
        return res.status(404).json({
          error: 'Task not found',
        })
      }

      if (
        req.body.projectId &&
        task.projectId &&
        String(task.projectId) !== String(req.body.projectId)
      ) {
        return res.status(400).json({
          error: 'Task must belong to the selected project',
        })
      }
    }

    timeEntry.projectId = req.body.projectId
    timeEntry.taskId = req.body.taskId
    timeEntry.description = req.body.description
    timeEntry.duration = req.body.duration
    timeEntry.startedAt = req.body.startedAt

    await timeEntry.save()

    res.json(timeEntry)
  } catch (error) {
    next(error)
  }
})

// Delete time entry
router.delete('/:id', async (req, res, next) => {
  try {
    const timeEntry = await TimeEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    })

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