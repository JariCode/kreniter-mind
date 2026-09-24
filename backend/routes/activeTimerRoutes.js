const express = require('express')
const ActiveTimer = require('../models/ActiveTimer')
const Project = require('../models/Project')
const Task = require('../models/Task')

const router = express.Router()

// Get active timer for current user
router.get('/', async (req, res, next) => {
  try {
    const activeTimer = await ActiveTimer.findOne({
      userId: req.user._id,
    })

    if (!activeTimer) {
      return res.json(null)
    }

    res.json(activeTimer)
  } catch (error) {
    next(error)
  }
})

// Create active timer
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

    const activeTimer = await ActiveTimer.create({
      userId: req.user._id,
      projectId: req.body.projectId || null,
      taskId: req.body.taskId || null,
      description: req.body.description || '',
      startedAt: req.body.startedAt,
      elapsedMs: req.body.elapsedMs || 0,
      segmentStartedAt: req.body.segmentStartedAt || null,
      status: req.body.status,
    })

    res.status(201).json(activeTimer)
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'An active timer already exists',
      })
    }

    next(error)
  }
})

// Update active timer
router.patch('/', async (req, res, next) => {
  try {
    const activeTimer = await ActiveTimer.findOne({
      userId: req.user._id,
    })

    if (!activeTimer) {
      return res.status(404).json({
        error: 'Active timer not found',
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

    if (req.body.projectId !== undefined) {
      activeTimer.projectId =
        req.body.projectId || null
    }

    if (req.body.taskId !== undefined) {
      activeTimer.taskId =
        req.body.taskId || null
    }

    if (req.body.description !== undefined) {
      activeTimer.description =
        req.body.description || ''
    }

    if (req.body.startedAt !== undefined) {
      activeTimer.startedAt = req.body.startedAt
    }

    if (req.body.elapsedMs !== undefined) {
      activeTimer.elapsedMs = req.body.elapsedMs
    }

    if (req.body.segmentStartedAt !== undefined) {
      activeTimer.segmentStartedAt =
        req.body.segmentStartedAt || null
    }

    if (req.body.status !== undefined) {
      activeTimer.status = req.body.status
    }

    await activeTimer.save()

    res.json(activeTimer)
  } catch (error) {
    next(error)
  }
})

// Delete active timer
router.delete('/', async (req, res, next) => {
  try {
    const activeTimer =
      await ActiveTimer.findOneAndDelete({
        userId: req.user._id,
      })

    if (!activeTimer) {
      return res.status(404).json({
        error: 'Active timer not found',
      })
    }

    res.json({
      message: 'Active timer deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router