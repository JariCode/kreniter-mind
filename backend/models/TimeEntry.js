const mongoose = require('mongoose')

// Time entry data structure
const timeEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    duration: {
      type: Number,
      required: true,
      min: 0,
    },

    startedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('TimeEntry', timeEntrySchema)