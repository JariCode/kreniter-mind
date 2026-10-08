const mongoose = require('mongoose')

const fileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    gridFsId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

// Backs findDuplicateFile's pre-check in fileRoutes.js with a hard
// constraint, so two concurrent uploads of the same name can't both pass
// that check and create two File documents. Same collation (case-insensitive,
// matching how Windows/macOS treat file names) so the index agrees with the
// pre-check on what counts as a duplicate.
fileSchema.index(
  {
    userId: 1,
    projectId: 1,
    folderId: 1,
    name: 1,
  },
  {
    unique: true,
    collation: {
      locale: 'en',
      strength: 2,
    },
  }
)

module.exports = mongoose.model('File', fileSchema)