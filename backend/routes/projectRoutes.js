const express = require('express')
const Project = require('../models/Project')

const router = express.Router()

// Get all projects for current user
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 })

    res.json(projects)
  } catch (error) {
    next(error)
  }
})

// Get one project for current user
router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
      })
    }

    res.json(project)
  } catch (error) {
    next(error)
  }
})

// Create project
router.post('/', async (req, res, next) => {
  try {
    const project = await Project.create({
      userId: req.user._id,
      name: req.body.name,
      description: req.body.description,
      status: req.body.status,
      color: req.body.color,
    })

    res.status(201).json(project)
  } catch (error) {
    next(error)
  }
})

// Update project
router.patch('/:id', async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
      },
      {
        name: req.body.name,
        description: req.body.description,
        status: req.body.status,
        color: req.body.color,
      },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
      })
    }

    res.json(project)
  } catch (error) {
    next(error)
  }
})

// Delete project
router.delete('/:id', async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
      })
    }

    res.json({
      message: 'Project deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router