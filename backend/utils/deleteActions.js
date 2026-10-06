const mongoose = require('mongoose')
const Task = require('../models/Task')
const Project = require('../models/Project')
const Note = require('../models/Note')
const Folder = require('../models/Folder')
const File = require('../models/File')
const TimeEntry = require('../models/TimeEntry')
const ActiveTimer = require('../models/ActiveTimer')
const TasksView = require('../models/TasksView')
const TimeView = require('../models/TimeView')
const Timeline = require('../models/Timeline')
const ReportsView = require('../models/ReportsView')

// Single source of truth for deleting tasks and projects without leaving
// orphan rows behind. Used by both the REST routes and the AI Assistant's
// delete_task tool, so the two can never drift apart. Every query is
// scoped by userId, and nothing here ever deletes anything other than
// exactly what is documented below -- no cascading deletes.

// Sums TimeEntry durations (in minutes) for the given documents.
function sumDurationMinutes(entries) {
  return entries.reduce(
    (total, entry) => total + (entry.duration || 0),
    0
  )
}

// Read-only preview of what deleteTask would do, for the confirmation
// dialog and the AI's proposal summary. Returns { error } if the task
// does not exist or does not belong to this user.
async function getTaskDeletePreview(userId, taskId) {
  const task = await Task.findOne({
    _id: taskId,
    userId,
  })

  if (!task) {
    return { error: 'Not found' }
  }

  const [timeEntries, subtasks] = await Promise.all([
    TimeEntry.find({ userId, taskId: task._id }),
    Task.find(
      { userId, parentTaskId: task._id },
      'title'
    ),
  ])

  return {
    task,
    trackedMinutes: sumDurationMinutes(timeEntries),
    subtasks,
  }
}

// Deletes a task without leaving orphan rows:
// - deletes the task itself
// - deletes the task's own TimeEntries
// - detaches its direct subtasks (parentTaskId -> null); subtasks are
//   never deleted, and grandchildren/their TimeEntries are untouched
// - if the user's active timer belongs to this task, deletes it without
//   saving a TimeEntry, exactly like the app's own cancel-timer action
// All of the above happens in one transaction, so a failure partway
// through leaves nothing changed. Returns { error } if the task does
// not exist or does not belong to this user.
async function deleteTask(userId, taskId) {
  const session = await mongoose.startSession()

  let result = null

  try {
    await session.withTransaction(async () => {
      const task = await Task.findOneAndDelete(
        { _id: taskId, userId },
        { session }
      )

      if (!task) {
        result = { error: 'Not found' }
        return
      }

      const timeEntries = await TimeEntry.find({
        userId,
        taskId: task._id,
      }).session(session)

      await TimeEntry.deleteMany(
        { userId, taskId: task._id },
        { session }
      )

      const subtasks = await Task.find(
        { userId, parentTaskId: task._id },
        'title'
      ).session(session)

      await Task.updateMany(
        { userId, parentTaskId: task._id },
        { $set: { parentTaskId: null } },
        { session }
      )

      const cancelledTimer = await ActiveTimer.findOneAndDelete(
        { userId, taskId: task._id },
        { session }
      )

      result = {
        task,
        deletedTimeEntryCount: timeEntries.length,
        deletedDurationMinutes:
          sumDurationMinutes(timeEntries),
        reparentedSubtasks: subtasks,
        cancelledActiveTimer: !!cancelledTimer,
      }
    })
  } finally {
    await session.endSession()
  }

  return result
}

// Read-only preview of what deleteProject would do, for the confirmation
// dialog. Returns { error } if the project does not exist or does not
// belong to this user.
async function getProjectDeletePreview(userId, projectId) {
  const project = await Project.findOne({
    _id: projectId,
    userId,
  })

  if (!project) {
    return { error: 'Not found' }
  }

  const [
    taskCount,
    noteCount,
    folderCount,
    fileCount,
    timeEntries,
  ] = await Promise.all([
    Task.countDocuments({ userId, projectId }),
    Note.countDocuments({ userId, projectId }),
    Folder.countDocuments({ userId, projectId }),
    File.countDocuments({ userId, projectId }),
    TimeEntry.find({ userId, projectId }),
  ])

  return {
    project,
    taskCount,
    noteCount,
    folderCount,
    fileCount,
    trackedMinutes: sumDurationMinutes(timeEntries),
    isEmpty:
      taskCount === 0 &&
      noteCount === 0 &&
      folderCount === 0 &&
      fileCount === 0,
  }
}

// Deletes a project without leaving orphan rows. Refuses to delete a
// project that still has tasks, notes, folders or files -- the caller
// must remove those first, so nothing is ever cascade-deleted. When the
// project is empty, deletes it along with any TimeEntries still pointing
// at it (time logged directly on the project, with no task), and resets
// any saved view (Tasks/Time/Timeline/Reports) that had this project
// selected back to "no project selected" -- all in one transaction.
// Returns { error } if the project does not exist or does not belong to
// this user, or { blocked: true, taskCount, noteCount, folderCount,
// fileCount } if it still has content.
async function deleteProject(userId, projectId) {
  const session = await mongoose.startSession()

  let result = null

  try {
    await session.withTransaction(async () => {
      const project = await Project.findOne({
        _id: projectId,
        userId,
      }).session(session)

      if (!project) {
        result = { error: 'Not found' }
        return
      }

      const [taskCount, noteCount, folderCount, fileCount] =
        await Promise.all([
          Task.countDocuments({
            userId,
            projectId,
          }).session(session),
          Note.countDocuments({
            userId,
            projectId,
          }).session(session),
          Folder.countDocuments({
            userId,
            projectId,
          }).session(session),
          File.countDocuments({
            userId,
            projectId,
          }).session(session),
        ])

      if (
        taskCount > 0 ||
        noteCount > 0 ||
        folderCount > 0 ||
        fileCount > 0
      ) {
        result = {
          blocked: true,
          taskCount,
          noteCount,
          folderCount,
          fileCount,
        }
        return
      }

      const timeEntries = await TimeEntry.find({
        userId,
        projectId,
      }).session(session)

      await TimeEntry.deleteMany(
        { userId, projectId },
        { session }
      )

      await Project.deleteOne(
        { _id: project._id, userId },
        { session }
      )

      await Promise.all([
        TasksView.updateMany(
          {
            userId,
            selectedProjectId: String(project._id),
          },
          { $set: { selectedProjectId: null } },
          { session }
        ),
        TimeView.updateMany(
          {
            userId,
            selectedProjectId: String(project._id),
          },
          { $set: { selectedProjectId: null } },
          { session }
        ),
        Timeline.updateMany(
          { userId, selectedProjectId: project._id },
          { $set: { selectedProjectId: null } },
          { session }
        ),
        ReportsView.updateMany(
          { userId, selectedProjectId: project._id },
          { $set: { selectedProjectId: null } },
          { session }
        ),
      ])

      result = {
        project,
        deletedTimeEntryCount: timeEntries.length,
        deletedDurationMinutes:
          sumDurationMinutes(timeEntries),
      }
    })
  } finally {
    await session.endSession()
  }

  return result
}

module.exports = {
  getTaskDeletePreview,
  deleteTask,
  getProjectDeletePreview,
  deleteProject,
}
