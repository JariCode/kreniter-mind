const mongoose = require('mongoose')

const aiConversationSchema = new mongoose.Schema(
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
      index: true,
    },
    title: {
      type: String,
      default: 'New conversation',
      trim: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model(
  'AIConversation',
  aiConversationSchema
)