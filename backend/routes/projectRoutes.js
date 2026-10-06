const express = require('express')
const mongoose = require('mongoose')
const Project = require('../models/Project')
const validateStringFields = require('../middleware/validateStringFields')
const {
  validateRepositoryUrl,
} = require('../utils/validateRepositoryUrl')
const {
  getProjectDeletePreview,
  deleteProject,
} = require('../utils/deleteActions')

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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid ID',
      })
    }

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
router.post(
  '/',
  validateStringFields(
    'name',
    'description',
    'repositoryUrl',
    'color'
  ),
  async (req, res, next) => {
    try {
      const urlValidation = validateRepositoryUrl(
        req.body.repositoryUrl
      )

      if (urlValidation.error) {
        return res.status(urlValidation.status).json({
          error: urlValidation.error,
        })
      }

      const project = await Project.create({
        userId: req.user._id,
        name: req.body.name,
        description: req.body.description,
        repositoryUrl: urlValidation.repositoryUrl,
        status: req.body.status,
        color: req.body.color,
      })

      res.status(201).json(project)
    } catch (error) {
      next(error)
    }
  }
)

// Update project
router.patch(
  '/:id',
  validateStringFields(
    'name',
    'description',
    'repositoryUrl',
    'color'
  ),
  async (req, res, next) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          error: 'Invalid ID',
        })
      }

      const urlValidation = validateRepositoryUrl(
        req.body.repositoryUrl
      )

      if (urlValidation.error) {
        return res.status(urlValidation.status).json({
          error: urlValidation.error,
        })
      }

      const project = await Project.findOneAndUpdate(
        {
          _id: req.params.id,
          userId: req.user._id,
        },
        {
          name: req.body.name,
          description: req.body.description,
          repositoryUrl: urlValidation.repositoryUrl,
          status: req.body.status,
          color: req.body.color,
        },
        {
          returnDocument: 'after',
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
  }
)

// Preview the consequences of deleting a project: what still blocks it
// (tasks, notes, folders, files), and tracked time that will be removed
// with it if it's empty.
router.get('/:id/delete-preview', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid ID',
      })
    }

    const preview = await getProjectDeletePreview(
      req.user._id,
      req.params.id
    )

    if (preview.error) {
      return res.status(404).json({
        error: 'Project not found',
      })
    }

    res.json({
      taskCount: preview.taskCount,
      noteCount: preview.noteCount,
      folderCount: preview.folderCount,
      fileCount: preview.fileCount,
      trackedMinutes: preview.trackedMinutes,
      isEmpty: preview.isEmpty,
    })
  } catch (error) {
    next(error)
  }
})

// Delete project, without leaving orphan rows. Refuses (409) if the
// project still has tasks, notes, folders or files -- those must be
// removed first, so nothing is ever cascade-deleted. Otherwise deletes
// the project along with any TimeEntries still pointing at it, and
// resets any saved view that had this project selected.
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        error: 'Invalid ID',
      })
    }

    const result = await deleteProject(
      req.user._id,
      req.params.id
    )

    if (result.error) {
      return res.status(404).json({
        error: 'Project not found',
      })
    }

    if (result.blocked) {
      return res.status(409).json({
        error: 'Project is not empty',
        taskCount: result.taskCount,
        noteCount: result.noteCount,
        folderCount: result.folderCount,
        fileCount: result.fileCount,
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
