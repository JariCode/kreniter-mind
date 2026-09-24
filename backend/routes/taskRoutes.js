const express = require('express')
const Task = require('../models/Task')
const Project = require('../models/Project')

const router = express.Router()

// Get all tasks for current user
router.get('/', async (req, res, next) => {
  try {
    const tasks = await Task.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 })

    res.json(tasks)
  } catch (error) {
    next(error)
  }
})

// Get one task for current user
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
      })
    }

    res.json(task)
  } catch (error) {
    next(error)
  }
})

// Create task
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

    const task = await Task.create({
      userId: req.user._id,
      projectId: req.body.projectId,
      title: req.body.title,
      description: req.body.description,
      status: req.body.status,
      priority: req.body.priority,
      dueDate: req.body.dueDate,
    })

    res.status(201).json(task)
  } catch (error) {
    next(error)
  }
})

// Update task
router.patch('/:id', async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
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

    task.projectId = req.body.projectId
    task.title = req.body.title
    task.description = req.body.description
    task.status = req.body.status
    task.priority = req.body.priority
    task.dueDate = req.body.dueDate

    await task.save()

    res.json(task)
  } catch (error) {
    next(error)
  }
})

// Delete task
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
      })
    }

    res.json({
      message: 'Task deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router