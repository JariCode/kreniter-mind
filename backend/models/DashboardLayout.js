const mongoose = require('mongoose')

const dashboardLayoutSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    widgets: {
      type: [String],
      default: [
        'projects',
        'tasks',
        'tracked-time',
        'recent-projects',
        'ai-assistant',
      ],
    },
  },
  {
    timestamps: true,
  }
)

module.exports = mongoose.model('DashboardLayout', dashboardLayoutSchema)