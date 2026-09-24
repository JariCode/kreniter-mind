const mongoose = require('mongoose')

// Task data structure
const taskSchema = new mongoose.Schema(
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

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    status: {
      type: String,
      enum: ['todo', 'in-progress', 'completed'],
      default: 'todo',
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },

    dueDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('Task', taskSchema)