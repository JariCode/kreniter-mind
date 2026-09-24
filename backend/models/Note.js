const mongoose = require('mongoose')

// Note data structure
const noteSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    content: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('Note', noteSchema)