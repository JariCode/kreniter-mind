const express = require('express')
const mongoose = require('mongoose')
const Folder = require('../models/Folder')

const router = express.Router()

// Get folders
router.get('/', async (req, res, next) => {
  try {
    const { projectId, parentFolderId } = req.query

    const filter = {
      userId: req.user._id,
    }

    if (projectId === 'no-project') {
      filter.projectId = null
    } else if (projectId) {
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({
          error: 'Invalid project ID',
        })
      }

      filter.projectId = projectId
    }

    if (parentFolderId) {
      if (!mongoose.Types.ObjectId.isValid(parentFolderId)) {
        return res.status(400).json({
          error: 'Invalid parent folder ID',
        })
      }

      filter.parentFolderId = parentFolderId
    } else {
      filter.parentFolderId = null
    }

    const folders = await Folder.find(filter).sort({
      name: 1,
    })

    res.json(folders)
  } catch (error) {
    next(error)
  }
})

// Create folder
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      projectId = null,
      parentFolderId = null,
    } = req.body

    if (
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return res.status(400).json({
        error: 'Folder name is required',
      })
    }

    if (
      projectId &&
      !mongoose.Types.ObjectId.isValid(projectId)
    ) {
      return res.status(400).json({
        error: 'Invalid project ID',
      })
    }

    if (
      parentFolderId &&
      !mongoose.Types.ObjectId.isValid(
        parentFolderId
      )
    ) {
      return res.status(400).json({
        error: 'Invalid parent folder ID',
      })
    }

    if (parentFolderId) {
      const parentFolder = await Folder.findOne({
        _id: parentFolderId,
        userId: req.user._id,
      })

      if (!parentFolder) {
        return res.status(404).json({
          error: 'Parent folder not found',
        })
      }

      if (
        String(parentFolder.projectId) !==
        String(projectId)
      ) {
        return res.status(400).json({
          error: 'Folder project mismatch',
        })
      }
    }

    const folder = await Folder.create({
      userId: req.user._id,
      projectId,
      parentFolderId,
      name: name.trim(),
    })

    res.status(201).json(folder)
  } catch (error) {
    next(error)
  }
})

// Rename folder
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { name } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid folder ID',
      })
    }

    if (
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return res.status(400).json({
        error: 'Folder name is required',
      })
    }

    const folder = await Folder.findOneAndUpdate(
      {
        _id: id,
        userId: req.user._id,
      },
      {
        name: name.trim(),
      },
      {
        new: true,
      }
    )

    if (!folder) {
      return res.status(404).json({
        error: 'Folder not found',
      })
    }

    res.json(folder)
  } catch (error) {
    next(error)
  }
})

// Delete folder
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid folder ID',
      })
    }

    const folder = await Folder.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    })

    if (!folder) {
      return res.status(404).json({
        error: 'Folder not found',
      })
    }

    res.json({
      message: 'Folder deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router