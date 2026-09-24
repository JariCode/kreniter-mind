const mongoose = require('mongoose')

// Project data structure
const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },

    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
    },

    color: {
      type: String,
      default: '#1688ff',
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('Project', projectSchema)