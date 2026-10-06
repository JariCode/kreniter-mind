const mongoose = require('mongoose')

// HH:MM, 24-hour clock.
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

// Calendar event data structure
const calendarEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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

    // The calendar day this event belongs to. Stored at midnight, the
    // same convention Task uses for startDate/dueDate.
    date: {
      type: Date,
      required: true,
    },

    allDay: {
      type: Boolean,
      default: true,
    },

    // Only meaningful when allDay is false. Validated together in the
    // routes (endTime must be after startTime), since that comparison
    // spans two fields.
    startTime: {
      type: String,
      default: null,
      validate: {
        validator: (value) =>
          value === null || TIME_PATTERN.test(value),
        message: 'Invalid time',
      },
    },

    endTime: {
      type: String,
      default: null,
      validate: {
        validator: (value) =>
          value === null || TIME_PATTERN.test(value),
        message: 'Invalid time',
      },
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
  },
  {
    timestamps: true,
    // Never expose userId or __v -- every response is scoped to the
    // caller's own data anyway, so there is no reason to echo it back.
    toJSON: {
      transform: (doc, ret) => {
        delete ret.userId
        delete ret.__v
        return ret
      },
    },
  }
)

calendarEventSchema.index({ userId: 1, date: 1 })

module.exports = mongoose.model(
  'CalendarEvent',
  calendarEventSchema
)
