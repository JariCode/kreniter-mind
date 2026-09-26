const express = require('express')
const mongoose = require('mongoose')
const multer = require('multer')
const File = require('../models/File')
const Folder = require('../models/Folder')

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
})

function getBucket() {
  const db = mongoose.connection.db

  if (!db) {
    throw new Error('Database connection is not ready')
  }

  return new mongoose.mongo.GridFSBucket(db, {
    bucketName: 'files',
  })
}

async function deleteGridFsFile(fileId) {
  const bucket = getBucket()

  try {
    await bucket.delete(fileId)
  } catch (error) {
    if (
      error.message &&
      error.message.includes('FileNotFound')
    ) {
      return
    }

    throw error
  }
}

// Get files
router.get('/', async (req, res, next) => {
  try {
    const {
      projectId,
      folderId,
    } = req.query

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

    if (folderId) {
      if (!mongoose.Types.ObjectId.isValid(folderId)) {
        return res.status(400).json({
          error: 'Invalid folder ID',
        })
      }

      filter.folderId = folderId
    } else {
      filter.folderId = null
    }

    const files = await File.find(filter).sort({
      name: 1,
    })

    res.json(files)
  } catch (error) {
    next(error)
  }
})

// Upload file
router.post(
  '/',
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'File is required',
        })
      }

      const {
        projectId = null,
        folderId = null,
      } = req.body

      if (
        projectId &&
        !mongoose.Types.ObjectId.isValid(projectId)
      ) {
        return res.status(400).json({
          error: 'Invalid project ID',
        })
      }

      if (
        folderId &&
        !mongoose.Types.ObjectId.isValid(folderId)
      ) {
        return res.status(400).json({
          error: 'Invalid folder ID',
        })
      }

      if (folderId) {
        const folder = await Folder.findOne({
          _id: folderId,
          userId: req.user._id,
        })

        if (!folder) {
          return res.status(404).json({
            error: 'Folder not found',
          })
        }

        if (
          String(folder.projectId) !==
          String(projectId)
        ) {
          return res.status(400).json({
            error: 'Folder project mismatch',
          })
        }
      }

      const bucket = getBucket()

      const uploadStream = bucket.openUploadStream(
        req.file.originalname,
        {
          contentType: req.file.mimetype,
          metadata: {
            userId: req.user._id,
            projectId,
            folderId,
          },
        }
      )

      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve)
        uploadStream.on('error', reject)
        uploadStream.end(req.file.buffer)
      })

      const file = await File.create({
        userId: req.user._id,
        projectId,
        folderId,
        name: req.file.originalname,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        gridFsId: uploadStream.id,
      })

      res.status(201).json(file)
    } catch (error) {
      next(error)
    }
  }
)

// Download file
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid file ID',
      })
    }

    const file = await File.findOne({
      _id: id,
      userId: req.user._id,
    })

    if (!file) {
      return res.status(404).json({
        error: 'File not found',
      })
    }

    const bucket = getBucket()

    res.setHeader(
      'Content-Type',
      file.mimeType
    )

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(
        file.name
      )}"`
    )

    const downloadStream = bucket.openDownloadStream(
      file.gridFsId
    )

    downloadStream.on('error', next)

    downloadStream.pipe(res)
  } catch (error) {
    next(error)
  }
})

// Update file contents
router.put(
  '/:id/content',
  upload.single('file'),
  async (req, res, next) => {
    try {
      const { id } = req.params

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          error: 'Invalid file ID',
        })
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'File is required',
        })
      }

      const file = await File.findOne({
        _id: id,
        userId: req.user._id,
      })

      if (!file) {
        return res.status(404).json({
          error: 'File not found',
        })
      }

      const bucket = getBucket()

      const uploadStream = bucket.openUploadStream(
        file.name,
        {
          contentType: req.file.mimetype,
          metadata: {
            userId: req.user._id,
            projectId: file.projectId,
            folderId: file.folderId,
          },
        }
      )

      await new Promise((resolve, reject) => {
        uploadStream.on('finish', resolve)
        uploadStream.on('error', reject)
        uploadStream.end(req.file.buffer)
      })

      const oldGridFsId = file.gridFsId

      file.gridFsId = uploadStream.id
      file.mimeType = req.file.mimetype
      file.size = req.file.size

      await file.save()

      await deleteGridFsFile(oldGridFsId)

      res.json(file)
    } catch (error) {
      next(error)
    }
  }
)

// Rename / move file
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      name,
      folderId,
    } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid file ID',
      })
    }

    const file = await File.findOne({
      _id: id,
      userId: req.user._id,
    })

    if (!file) {
      return res.status(404).json({
        error: 'File not found',
      })
    }

    if (name !== undefined) {
      if (
        typeof name !== 'string' ||
        !name.trim()
      ) {
        return res.status(400).json({
          error: 'File name is required',
        })
      }

      file.name = name.trim()
    }

    if (folderId !== undefined) {
      if (
        folderId &&
        !mongoose.Types.ObjectId.isValid(folderId)
      ) {
        return res.status(400).json({
          error: 'Invalid folder ID',
        })
      }

      if (folderId) {
        const folder = await Folder.findOne({
          _id: folderId,
          userId: req.user._id,
        })

        if (!folder) {
          return res.status(404).json({
            error: 'Folder not found',
          })
        }

        if (
          String(folder.projectId) !==
          String(file.projectId)
        ) {
          return res.status(400).json({
            error: 'Folder project mismatch',
          })
        }
      }

      file.folderId = folderId || null
    }

    await file.save()

    res.json(file)
  } catch (error) {
    next(error)
  }
})

// Delete file
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'Invalid file ID',
      })
    }

    const file = await File.findOne({
      _id: id,
      userId: req.user._id,
    })

    if (!file) {
      return res.status(404).json({
        error: 'File not found',
      })
    }

    await deleteGridFsFile(file.gridFsId)
    await file.deleteOne()

    res.json({
      message: 'File deleted',
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router