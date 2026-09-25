const mongoose = require('mongoose')

const timeViewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    selectedProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('TimeView', timeViewSchema)