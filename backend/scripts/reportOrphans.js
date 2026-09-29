// Reports orphan rows per user: subtasks whose parent task is missing,
// TimeEntries whose task or project is missing, and notes/folders/files
// whose project is missing. Read-only -- this script never deletes or
// modifies anything, it only prints what it finds.
require('dotenv').config()

const mongoose = require('mongoose')
const User = require('../models/User')
const Task = require('../models/Task')
const Project = require('../models/Project')
const Note = require('../models/Note')
const Folder = require('../models/Folder')
const File = require('../models/File')
const TimeEntry = require('../models/TimeEntry')

async function reportOrphansForUser(user) {
  const [tasks, projects, notes, folders, files, timeEntries] =
    await Promise.all([
      Task.find({ userId: user._id }, '_id parentTaskId title'),
      Project.find({ userId: user._id }, '_id name'),
      Note.find({ userId: user._id }, '_id projectId title'),
      Folder.find({ userId: user._id }, '_id projectId name'),
      File.find({ userId: user._id }, '_id projectId name'),
      TimeEntry.find(
        { userId: user._id },
        '_id taskId projectId description'
      ),
    ])

  const taskIds = new Set(
    tasks.map((task) => String(task._id))
  )
  const projectIds = new Set(
    projects.map((project) => String(project._id))
  )

  const orphanSubtasks = tasks.filter(
    (task) =>
      task.parentTaskId &&
      !taskIds.has(String(task.parentTaskId))
  )

  const orphanTimeEntries = timeEntries.filter(
    (entry) =>
      (entry.taskId && !taskIds.has(String(entry.taskId))) ||
      (entry.projectId &&
        !projectIds.has(String(entry.projectId)))
  )

  const orphanNotes = notes.filter(
    (note) =>
      note.projectId && !projectIds.has(String(note.projectId))
  )

  const orphanFolders = folders.filter(
    (folder) =>
      folder.projectId &&
      !projectIds.has(String(folder.projectId))
  )

  const orphanFiles = files.filter(
    (file) =>
      file.projectId && !projectIds.has(String(file.projectId))
  )

  return {
    orphanSubtasks,
    orphanTimeEntries,
    orphanNotes,
    orphanFolders,
    orphanFiles,
  }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)

  const users = await User.find({}, '_id clerkId')

  let totalOrphans = 0

  for (const user of users) {
    const report = await reportOrphansForUser(user)

    const userTotal =
      report.orphanSubtasks.length +
      report.orphanTimeEntries.length +
      report.orphanNotes.length +
      report.orphanFolders.length +
      report.orphanFiles.length

    if (userTotal === 0) {
      continue
    }

    totalOrphans += userTotal

    console.log(
      `\nUser ${user._id} (${user.clerkId}): ${userTotal} orphan row(s)`
    )

    for (const task of report.orphanSubtasks) {
      console.log(
        `  [Task] '${task.title}' (${task._id}) has missing parentTaskId ${task.parentTaskId}`
      )
    }

    for (const entry of report.orphanTimeEntries) {
      console.log(
        `  [TimeEntry] (${entry._id}) "${entry.description || ''}" has missing taskId=${entry.taskId} or projectId=${entry.projectId}`
      )
    }

    for (const note of report.orphanNotes) {
      console.log(
        `  [Note] '${note.title}' (${note._id}) has missing projectId ${note.projectId}`
      )
    }

    for (const folder of report.orphanFolders) {
      console.log(
        `  [Folder] '${folder.name}' (${folder._id}) has missing projectId ${folder.projectId}`
      )
    }

    for (const file of report.orphanFiles) {
      console.log(
        `  [File] '${file.name}' (${file._id}) has missing projectId ${file.projectId}`
      )
    }
  }

  console.log(
    `\nTotal orphan rows found across ${users.length} user(s): ${totalOrphans}`
  )

  await mongoose.disconnect()
}

main().catch((error) => {
  console.error('Failed to report orphans:', error)
  process.exit(1)
})
