const express = require('express')
const mongoose = require('mongoose')
const multer = require('multer')
const fs = require('fs')
const os = require('os')
const File = require('../models/File')
const Folder = require('../models/Folder')
const Project = require('../models/Project')

const router = express.Router()

// Disk storage keeps the upload out of server memory. No filename callback is
// given, so multer defaults to a random hex name instead of the client's name.
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
  }),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
})

// Deletes a temp upload file. Logs failures instead of throwing, since a
// cleanup error should never fail the response that is already being sent.
function removeTempFile(path) {
  fs.unlink(path, (error) => {
    if (error) {
      console.error('Failed to delete temp upload file:', error)
    }
  })
}

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

// Case-insensitive match, since Windows and macOS treat file names that way.
const FILENAME_COLLATION = {
  locale: 'en',
  strength: 2,
}

// Finds an existing file with the same name in the same user/project/folder.
async function findDuplicateFile({
  userId,
  projectId,
  folderId,
  name,
  excludeId,
}) {
  const filter = {
    userId,
    projectId: projectId || null,
    folderId: folderId || null,
    name,
  }

  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  return File.findOne(filter).collation(FILENAME_COLLATION)
}

// Splits a file name into its base and extension, keeping the last dot as
// the extension separator (so "archive.tar.gz" keeps ".gz").
function splitFileName(name) {
  const lastDot = name.lastIndexOf('.')

  if (lastDot <= 0) {
    return {
      base: name,
      extension: '',
    }
  }

  return {
    base: name.slice(0, lastDot),
    extension: name.slice(lastDot),
  }
}

// Finds a free name the Windows way: "report.docx" -> "report (1).docx" -> "report (2).docx".
async function generateUniqueFileName({
  userId,
  projectId,
  folderId,
  name,
}) {
  const { base, extension } = splitFileName(name)

  let counter = 1
  let candidate = `${base} (${counter})${extension}`

  while (
    await findDuplicateFile({
      userId,
      projectId,
      folderId,
      name: candidate,
    })
  ) {
    counter += 1
    candidate = `${base} (${counter})${extension}`
  }

  return candidate
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
        onDuplicate,
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

      let name = req.file.originalname

      const duplicate = await findDuplicateFile({
        userId: req.user._id,
        projectId,
        folderId,
        name,
      })

      if (duplicate) {
        if (onDuplicate !== 'rename') {
          return res.status(409).json({
            error: 'File already exists',
            existingFileId: duplicate._id,
          })
        }

        name = await generateUniqueFileName({
          userId: req.user._id,
          projectId,
          folderId,
          name,
        })
      }

      const bucket = getBucket()

      const uploadStream = bucket.openUploadStream(
        name,
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
        fs.createReadStream(req.file.path)
          .on('error', reject)
          .pipe(uploadStream)
          .on('finish', resolve)
          .on('error', reject)
      })

      const file = await File.create({
        userId: req.user._id,
        projectId,
        folderId,
        name,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        gridFsId: uploadStream.id,
      })

      res.status(201).json(file)
    } catch (error) {
      next(error)
    } finally {
      if (req.file) {
        removeTempFile(req.file.path)
      }
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
        fs.createReadStream(req.file.path)
          .on('error', reject)
          .pipe(uploadStream)
          .on('finish', resolve)
          .on('error', reject)
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
    } finally {
      if (req.file) {
        removeTempFile(req.file.path)
      }
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

    let nextName = file.name
    let nextFolderId = file.folderId

    if (name !== undefined) {
      if (
        typeof name !== 'string' ||
        !name.trim()
      ) {
        return res.status(400).json({
          error: 'File name is required',
        })
      }

      nextName = name.trim()
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

      nextFolderId = folderId || null
    }

    if (name !== undefined || folderId !== undefined) {
      const duplicate = await findDuplicateFile({
        userId: req.user._id,
        projectId: file.projectId,
        folderId: nextFolderId,
        name: nextName,
        excludeId: file._id,
      })

      if (duplicate) {
        return res.status(409).json({
          error: 'A file with this name already exists here',
        })
      }
    }

    file.name = nextName
    file.folderId = nextFolderId

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