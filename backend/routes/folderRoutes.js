const express = require('express')
const mongoose = require('mongoose')
const Folder = require('../models/Folder')
const Project = require('../models/Project')
const File = require('../models/File')

const router = express.Router()

// Case-insensitive match, since Windows and macOS treat folder names that way.
const FOLDERNAME_COLLATION = {
  locale: 'en',
  strength: 2,
}

// Finds an existing folder with the same name in the same user/project/parent folder.
async function findDuplicateFolder({
  userId,
  projectId,
  parentFolderId,
  name,
  excludeId,
}) {
  const filter = {
    userId,
    projectId: projectId || null,
    parentFolderId: parentFolderId || null,
    name,
  }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  return Folder.findOne(filter).collation(FOLDERNAME_COLLATION)
}

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

    if (projectId) {
      const project = await Project.findOne({
        _id: projectId,
        userId: req.user._id,
      })

      if (!project) {
        return res.status(404).json({
          error: 'Project not found',
        })
      }
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

    const trimmedName = name.trim()

    const duplicate = await findDuplicateFolder({
      userId: req.user._id,
      projectId,
      parentFolderId,
      name: trimmedName,
    })

    if (duplicate) {
      return res.status(409).json({
        error: 'A folder with this name already exists here',
      })
    }

    const folder = await Folder.create({
      userId: req.user._id,
      projectId,
      parentFolderId,
      name: trimmedName,
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

    const folder = await Folder.findOne({
      _id: id,
      userId: req.user._id,
    })

    if (!folder) {
      return res.status(404).json({
        error: 'Folder not found',
      })
    }

    const trimmedName = name.trim()

    const duplicate = await findDuplicateFolder({
      userId: req.user._id,
      projectId: folder.projectId,
      parentFolderId: folder.parentFolderId,
      name: trimmedName,
      excludeId: folder._id,
    })

    if (duplicate) {
      return res.status(409).json({
        error: 'A folder with this name already exists here',
      })
    }

    folder.name = trimmedName

    await folder.save()

    res.json(folder)
  } catch (error) {
    next(error)
  }
})

// Delete folder. Refuses (409) if the folder still has files or
// subfolders -- those must be removed first, so nothing is ever left
// behind pointing at a folder that no longer exists.
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid folder ID',
      })
    }

    const folder = await Folder.findOne({
      _id: id,
      userId: req.user._id,
    })

    if (!folder) {
      return res.status(404).json({
        error: 'Folder not found',
      })
    }

    const [fileCount, subfolderCount] = await Promise.all([
      File.countDocuments({
        userId: req.user._id,
        folderId: folder._id,
      }),
      Folder.countDocuments({
        userId: req.user._id,
        parentFolderId: folder._id,
      }),
    ])

    if (fileCount > 0 || subfolderCount > 0) {
      return res.status(409).json({
        error: 'The folder must be empty before it can be deleted',
      })
    }

    await Folder.deleteOne({
      _id: folder._id,
      userId: req.user._id,
    })

    res.json({
      message: 'Folder deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router