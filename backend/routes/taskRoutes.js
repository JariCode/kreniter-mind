const express = require('express')
const Task = require('../models/Task')

const router = express.Router()

// Get all tasks
router.get('/', async (req, res, next) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 })

    res.json(tasks)
  } catch (error) {
    next(error)
  }
})

// Get one task
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)

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
    const task = await Task.create({
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
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        projectId: req.body.projectId,
        title: req.body.title,
        description: req.body.description,
        status: req.body.status,
        priority: req.body.priority,
        dueDate: req.body.dueDate,
      },
      {
        new: true,
        runValidators: true,
      }
    )

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

// Delete task
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id)

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