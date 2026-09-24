const express = require('express')
const Project = require('../models/Project')

const router = express.Router()

// Get all projects
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 })

    res.json(projects)
  } catch (error) {
    next(error)
  }
})

// Get one project
router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)

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
    const project = await Project.findByIdAndUpdate(
      req.params.id,
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
    const project = await Project.findByIdAndDelete(req.params.id)

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