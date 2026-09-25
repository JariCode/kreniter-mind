const express = require('express')
const Note = require('../models/Note')
const Project = require('../models/Project')

const router = express.Router()

// Get all notes for current user
router.get('/', async (req, res, next) => {
  try {
    const notes = await Note.find({
      userId: req.user._id,
    }).sort({
      priority: 1,
      order: 1,
      createdAt: -1,
    })

    res.json(notes)
  } catch (error) {
    next(error)
  }
})

// Get one note for current user
router.get('/:id', async (req, res, next) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!note) {
      return res.status(404).json({
        error: 'Note not found',
      })
    }

    res.json(note)
  } catch (error) {
    next(error)
  }
})

// Create note
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

    const note = await Note.create({
      userId: req.user._id,
      projectId: req.body.projectId,
      title: req.body.title,
      content: req.body.content,
      priority: req.body.priority || 'medium',
      order: req.body.order || 0,
    })

    res.status(201).json(note)
  } catch (error) {
    next(error)
  }
})

// Update note
router.patch('/:id', async (req, res, next) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!note) {
      return res.status(404).json({
        error: 'Note not found',
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

    note.projectId = req.body.projectId
    note.title = req.body.title
    note.content = req.body.content
    note.priority = req.body.priority || note.priority
    note.order =
      req.body.order !== undefined
        ? req.body.order
        : note.order

    await note.save()

    res.json(note)
  } catch (error) {
    next(error)
  }
})

// Delete note
router.delete('/:id', async (req, res, next) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    })

    if (!note) {
      return res.status(404).json({
        error: 'Note not found',
      })
    }

    res.json({
      message: 'Note deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router