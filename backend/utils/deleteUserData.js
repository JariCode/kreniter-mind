const mongoose = require('mongoose')
const User = require('../models/User')
const Project = require('../models/Project')
const Task = require('../models/Task')
const Note = require('../models/Note')
const TimeEntry = require('../models/TimeEntry')
const ActiveTimer = require('../models/ActiveTimer')
const Folder = require('../models/Folder')
const File = require('../models/File')
const CalendarEvent = require('../models/CalendarEvent')
const AIConversation = require('../models/AIConversation')
const AIMessage = require('../models/AIMessage')
const AIPendingAction = require('../models/AIPendingAction')
const DashboardLayout = require('../models/DashboardLayout')
const ReportsView = require('../models/ReportsView')
const TasksView = require('../models/TasksView')
const TimeView = require('../models/TimeView')
const Timeline = require('../models/Timeline')

// Every model in backend/models, and the field that ties its documents to a
// user, found by reading each schema directly:
//   AIConversation   userId (direct)
//   AIMessage        conversationId -> AIConversation.userId (indirect;
//                    AIMessage itself has no userId field)
//   AIPendingAction  userId (direct)
//   ActiveTimer      userId (direct, unique: at most one per user)
//   CalendarEvent    userId (direct)
//   DashboardLayout  userId (direct, unique: at most one per user)
//   File             userId (direct) + gridFsId -> GridFS bucket "files"
//   Folder           userId (direct)
//   Note             userId (direct)
//   Project          userId (direct)
//   ReportsView      userId (direct, unique: at most one per user)
//   Task             userId (direct)
//   TasksView        userId (direct, unique: at most one per user)
//   TimeEntry        userId (direct)
//   TimeView         userId (direct, unique: at most one per user)
//   Timeline         userId (direct, unique: at most one per user)
//   User             the account itself, keyed by _id / clerkId
// Every one of the above is covered below; nothing in backend/models holds
// user data outside this list.

function getBucket() {
  const db = mongoose.connection.db

  if (!db) {
    throw new Error('Database connection is not ready')
  }

  return new mongoose.mongo.GridFSBucket(db, {
    bucketName: 'files',
  })
}

// Deletes everything a user owns, across every collection, in one
// transaction -- then removes the user's GridFS file contents once that
// transaction has committed (GridFS's own collections aren't part of the
// transaction). Safe to call more than once for the same userId: every step
// is a userId-scoped deleteMany/deleteOne, so re-running it after the user
// is already gone simply deletes zero documents everywhere and still
// returns a result.
async function deleteAllUserData(userId) {
  const session = await mongoose.startSession()

  let result = null
  let gridFsIds = []

  try {
    await session.withTransaction(async () => {
      // File and AIConversation ids are needed to clean up what references
      // them (GridFS content, and AI messages) once those owning documents
      // are gone, so both are read before anything is deleted.
      const existingFiles = await File.find(
        { userId },
        '_id gridFsId'
      ).session(session)

      gridFsIds = existingFiles.map((file) => file.gridFsId)

      const conversations = await AIConversation.find(
        { userId },
        '_id'
      ).session(session)

      const conversationIds = conversations.map(
        (conversation) => conversation._id
      )

      const [
        projects,
        tasks,
        notes,
        timeEntries,
        activeTimers,
        folders,
        filesDeleted,
        calendarEvents,
        aiMessages,
        aiConversations,
        aiPendingActions,
        dashboardLayouts,
        reportsViews,
        tasksViews,
        timeViews,
        timelines,
      ] = await Promise.all([
        Project.deleteMany({ userId }, { session }),
        Task.deleteMany({ userId }, { session }),
        Note.deleteMany({ userId }, { session }),
        TimeEntry.deleteMany({ userId }, { session }),
        ActiveTimer.deleteMany({ userId }, { session }),
        Folder.deleteMany({ userId }, { session }),
        File.deleteMany({ userId }, { session }),
        CalendarEvent.deleteMany({ userId }, { session }),
        AIMessage.deleteMany(
          { conversationId: { $in: conversationIds } },
          { session }
        ),
        AIConversation.deleteMany({ userId }, { session }),
        AIPendingAction.deleteMany({ userId }, { session }),
        DashboardLayout.deleteMany({ userId }, { session }),
        ReportsView.deleteMany({ userId }, { session }),
        TasksView.deleteMany({ userId }, { session }),
        TimeView.deleteMany({ userId }, { session }),
        Timeline.deleteMany({ userId }, { session }),
      ])

      const user = await User.deleteOne(
        { _id: userId },
        { session }
      )

      result = {
        projects: projects.deletedCount,
        tasks: tasks.deletedCount,
        notes: notes.deletedCount,
        timeEntries: timeEntries.deletedCount,
        activeTimers: activeTimers.deletedCount,
        folders: folders.deletedCount,
        files: filesDeleted.deletedCount,
        calendarEvents: calendarEvents.deletedCount,
        aiMessages: aiMessages.deletedCount,
        aiConversations: aiConversations.deletedCount,
        aiPendingActions: aiPendingActions.deletedCount,
        dashboardLayouts: dashboardLayouts.deletedCount,
        reportsViews: reportsViews.deletedCount,
        tasksViews: tasksViews.deletedCount,
        timeViews: timeViews.deletedCount,
        timelines: timelines.deletedCount,
        user: user.deletedCount,
      }
    })
  } finally {
    await session.endSession()
  }

  let gridFsFilesDeleted = 0

  for (const gridFsId of gridFsIds) {
    try {
      await getBucket().delete(gridFsId)
      gridFsFilesDeleted += 1
    } catch (error) {
      // A file already missing from GridFS is not a failure -- the goal
      // (no content left behind) is already met.
      if (error.message && error.message.includes('FileNotFound')) {
        continue
      }

      console.error(
        'Failed to delete a GridFS file while deleting user data:',
        error
      )
    }
  }

  result.gridFsFiles = gridFsFilesDeleted

  return result
}

module.exports = {
  deleteAllUserData,
}
