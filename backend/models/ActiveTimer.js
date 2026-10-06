const mongoose = require('mongoose')

// Active timer data structure
const activeTimerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },

    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },

    startedAt: {
      type: Date,
      required: true,
    },

    elapsedMs: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    segmentStartedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ['running', 'paused'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model(
  'ActiveTimer',
  activeTimerSchema
)