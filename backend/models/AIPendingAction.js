const mongoose = require('mongoose')

// A write the AI Assistant wants to make, held for the user to confirm or
// cancel before anything in the database actually changes.
const aiPendingActionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      required: true,
      index: true,
    },

    // The assistant message the action card is shown under. Set once that
    // message is created, right after this row (which is created mid-loop,
    // before the assistant's final reply exists yet).
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIMessage',
      default: null,
    },

    type: {
      type: String,
      enum: [
        'create_task',
        'update_task',
        'delete_task',
        'create_note',
        'update_note',
        'delete_note',
        'create_project',
        'update_project',
      ],
      required: true,
    },

    // The existing document being changed. Absent for create actions.
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Already-validated data, ready to apply as-is at confirmation time.
    // Delete actions have nothing to store here, so this is {} rather than
    // required: Mongoose's default minimize:true strips empty objects
    // before writing, which would make a later save() of this same
    // document fail required validation since the field would then be
    // genuinely absent. default: {} means Mongoose fills it back in on
    // load whether or not it was actually persisted, for old rows too.
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Human-readable description built from real database values, shown to
    // the user and never derived from the model's own wording.
    summary: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: [
        'pending',
        'executing',
        'executed',
        'cancelled',
        'expired',
        'failed',
      ],
      default: 'pending',
    },

    // Outcome details once the action is no longer pending (e.g. an error
    // message on failure). Absent while pending.
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // The action can no longer be confirmed after this. Separate from the
    // TTL index below, which just cleans up old rows regardless of status.
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000),
    },
  },
  {
    timestamps: true,
  }
)

// Retention: remove rows of any status 7 days after creation.
aiPendingActionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
)

module.exports = mongoose.model(
  'AIPendingAction',
  aiPendingActionSchema
)
