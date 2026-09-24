const express = require('express')
const Note = require('../models/Note')

const router = express.Router()

// Get all notes
router.get('/', async (req, res, next) => {
  try {
    const notes = await Note.find().sort({ createdAt: -1 })

    res.json(notes)
  } catch (error) {
    next(error)
  }
})

// Get one note
router.get('/:id', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id)

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
    const note = await Note.create({
      projectId: req.body.projectId,
      title: req.body.title,
      content: req.body.content,
    })

    res.status(201).json(note)
  } catch (error) {
    next(error)
  }
})

// Update note
router.patch('/:id', async (req, res, next) => {
  try {
    const note = await Note.findByIdAndUpdate(
      req.params.id,
      {
        projectId: req.body.projectId,
        title: req.body.title,
        content: req.body.content,
      },
      {
        new: true,
        runValidators: true,
      }
    )

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

// Delete note
router.delete('/:id', async (req, res, next) => {
  try {
    const note = await Note.findByIdAndDelete(req.params.id)

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