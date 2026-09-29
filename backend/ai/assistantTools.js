const mongoose = require('mongoose')
const Project = require('../models/Project')
const Task = require('../models/Task')
const Note = require('../models/Note')
const TimeEntry = require('../models/TimeEntry')
const ActiveTimer = require('../models/ActiveTimer')
const File = require('../models/File')
const Folder = require('../models/Folder')
const AIPendingAction = require('../models/AIPendingAction')
const { wouldCreateParentCycle } = require('../utils/taskParentCycle')
const {
  getElapsedMs,
  elapsedMsToDurationMinutes,
  stopActiveTimerAndSaveEntry,
  switchActiveTimer,
  pauseActiveTimer,
  resumeActiveTimer,
} = require('../utils/timerActions')

// Read-only tools the AI Assistant can call to look at the current user's
// own workspace data. Every database read in this file goes through
// scopedFind/scopedFindOne so the userId filter and the sensitive-field
// stripping can never be skipped by accident.

const MAX_ROWS = 200
const MAX_NOTE_CONTENT_LENGTH = 4000
const MAX_PROJECT_CONTEXT_LENGTH = 60000
const MAX_PENDING_ACTIONS_PER_RESPONSE = 10

const TASK_STATUSES = ['todo', 'in-progress', 'completed']
const TASK_PRIORITIES = ['low', 'medium', 'high']
const NOTE_PRIORITIES = ['low', 'medium', 'high']
const PROJECT_STATUSES = ['active', 'completed', 'archived']

const SENSITIVE_FIELDS = ['userId', 'clerkId', 'gridFsId', '__v']

function stripSensitiveFields(doc) {
  if (!doc) {
    return doc
  }

  const clean = { ...doc }

  for (const field of SENSITIVE_FIELDS) {
    delete clean[field]
  }

  return clean
}

// The only way any tool in this file reads many documents. Always scopes to
// the given userId and always strips the sensitive fields before returning.
async function scopedFind(Model, userId, filter, options = {}) {
  let query = Model.find({
    ...filter,
    userId,
  }).lean()

  if (options.select) {
    query = query.select(options.select)
  }

  if (options.sort) {
    query = query.sort(options.sort)
  }

  if (options.limit) {
    query = query.limit(options.limit)
  }

  const docs = await query

  return docs.map(stripSensitiveFields)
}

// The only way any tool in this file reads a single document. Always scopes
// to the given userId and always strips the sensitive fields before returning.
async function scopedFindOne(Model, userId, filter, options = {}) {
  let query = Model.findOne({
    ...filter,
    userId,
  }).lean()

  if (options.select) {
    query = query.select(options.select)
  }

  const doc = await query

  return stripSensitiveFields(doc)
}

// The only way any tool in this file counts documents. Always scopes to the
// given userId.
async function scopedCount(Model, userId, filter) {
  return Model.countDocuments({
    ...filter,
    userId,
  })
}

// Resolves a projectId tool argument to a query filter value:
// undefined/null -> no filter (every project), "no-project" -> null,
// otherwise -> the id, after checking the user actually owns that project.
// Returns { error } when the id is malformed or not found, never revealing
// whether the project exists for a different user.
async function resolveProjectFilter(userId, projectId) {
  if (projectId === undefined || projectId === null) {
    return {
      value: undefined,
    }
  }

  if (projectId === 'no-project') {
    return {
      value: null,
    }
  }

  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return {
      error: 'Invalid projectId',
    }
  }

  const project = await scopedFindOne(Project, userId, {
    _id: projectId,
  })

  if (!project) {
    return {
      error: 'Not found',
    }
  }

  return {
    value: projectId,
  }
}

// Same idea as resolveProjectFilter, for a required (not optional) project
// reference such as get_project_context's projectId argument.
async function resolveOwnedProject(userId, projectId) {
  if (
    typeof projectId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(projectId)
  ) {
    return {
      error: 'Invalid projectId',
    }
  }

  const project = await scopedFindOne(Project, userId, {
    _id: projectId,
  })

  if (!project) {
    return {
      error: 'Not found',
    }
  }

  return {
    project,
  }
}

async function resolveOwnedTask(userId, taskId) {
  if (
    typeof taskId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(taskId)
  ) {
    return {
      error: 'Invalid taskId',
    }
  }

  const task = await scopedFindOne(Task, userId, {
    _id: taskId,
  })

  if (!task) {
    return {
      error: 'Not found',
    }
  }

  return {
    task,
  }
}

async function resolveOwnedFolder(userId, folderId) {
  if (
    typeof folderId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(folderId)
  ) {
    return {
      error: 'Invalid folderId',
    }
  }

  const folder = await scopedFindOne(Folder, userId, {
    _id: folderId,
  })

  if (!folder) {
    return {
      error: 'Not found',
    }
  }

  return {
    folder,
  }
}

async function resolveOwnedNote(userId, noteId) {
  if (
    typeof noteId !== 'string' ||
    !mongoose.Types.ObjectId.isValid(noteId)
  ) {
    return {
      error: 'Invalid noteId',
    }
  }

  const note = await scopedFindOne(Note, userId, {
    _id: noteId,
  })

  if (!note) {
    return {
      error: 'Not found',
    }
  }

  return {
    note,
  }
}

function truncateNoteContent(note) {
  const content = note.content || ''

  if (content.length <= MAX_NOTE_CONTENT_LENGTH) {
    return {
      note,
      wasTruncated: false,
    }
  }

  return {
    note: {
      ...note,
      content: content.slice(0, MAX_NOTE_CONTENT_LENGTH),
    },
    wasTruncated: true,
  }
}

// Sums TimeEntry durations for the given task ids, scoped to the user.
// TimeEntry.duration is stored in minutes (same unit as Task.estimatedMinutes).
// Returns a Map of taskId (string) -> total tracked minutes.
async function sumTrackedTimeByTaskId(userId, taskIds) {
  if (taskIds.length === 0) {
    return new Map()
  }

  const entries = await scopedFind(
    TimeEntry,
    userId,
    {
      taskId: { $in: taskIds },
    },
    {
      select: 'taskId duration',
    }
  )

  const totals = new Map()

  for (const entry of entries) {
    const key = String(entry.taskId)

    totals.set(key, (totals.get(key) || 0) + entry.duration)
  }

  return totals
}

// Sums Task.estimatedMinutes by projectId, scoped to the user. Mirrors the
// Time page's per-project estimated total: every task with a matching
// projectId counts, subtasks included, regardless of parentTaskId.
async function sumEstimatedMinutesByProjectId(userId, projectIds) {
  if (projectIds.length === 0) {
    return new Map()
  }

  const tasks = await scopedFind(
    Task,
    userId,
    {
      projectId: { $in: projectIds },
    },
    {
      select: 'projectId estimatedMinutes',
    }
  )

  const totals = new Map()

  for (const task of tasks) {
    const key = String(task.projectId)

    totals.set(
      key,
      (totals.get(key) || 0) + (task.estimatedMinutes || 0)
    )
  }

  return totals
}

// Sums TimeEntry durations by projectId, scoped to the user. Mirrors the
// Time page's per-project tracked total: an entry counts if its projectId
// matches, whether or not it also has a taskId.
async function sumTrackedMinutesByProjectId(userId, projectIds) {
  if (projectIds.length === 0) {
    return new Map()
  }

  const entries = await scopedFind(
    TimeEntry,
    userId,
    {
      projectId: { $in: projectIds },
    },
    {
      select: 'projectId duration',
    }
  )

  const totals = new Map()

  for (const entry of entries) {
    const key = String(entry.projectId)

    totals.set(key, (totals.get(key) || 0) + entry.duration)
  }

  return totals
}

// Builds the estimatedMinutes/trackedMinutes/totalMinutes trio for one
// project from the lookup maps above. totalMinutes matches the Time page's
// "Project total time": estimated + tracked, not a sum of task totals.
function buildProjectTotals(
  projectId,
  estimatedByProject,
  trackedByProject
) {
  const key = String(projectId)
  const estimatedMinutes = estimatedByProject.get(key) || 0
  const trackedMinutes = trackedByProject.get(key) || 0

  return {
    estimatedMinutes,
    trackedMinutes,
    totalMinutes: estimatedMinutes + trackedMinutes,
  }
}

function buildTaskTree(tasks, trackedMinutesByTaskId) {
  const withTime = tasks.map((task) => {
    const estimatedMinutes = task.estimatedMinutes || 0
    const trackedMinutes =
      trackedMinutesByTaskId.get(String(task._id)) || 0

    return {
      ...task,
      trackedMinutes,
      totalMinutes: estimatedMinutes + trackedMinutes,
      subtasks: [],
    }
  })

  const byId = new Map(
    withTime.map((task) => [String(task._id), task])
  )

  const roots = []

  for (const task of withTime) {
    const parentId = task.parentTaskId
      ? String(task.parentTaskId)
      : null

    const parent = parentId ? byId.get(parentId) : null

    if (parent) {
      parent.subtasks.push(task)
    } else {
      roots.push(task)
    }
  }

  return roots
}

// --- Tools ---

async function listProjects(userId) {
  const projects = await scopedFind(
    Project,
    userId,
    {},
    {
      select: 'name description status color repositoryUrl createdAt',
      sort: { createdAt: -1 },
      limit: MAX_ROWS + 1,
    }
  )

  const truncated = projects.length > MAX_ROWS
  const boundedProjects = projects.slice(0, MAX_ROWS)
  const projectIds = boundedProjects.map(
    (project) => project._id
  )

  const [estimatedByProject, trackedByProject] = await Promise.all(
    [
      sumEstimatedMinutesByProjectId(userId, projectIds),
      sumTrackedMinutesByProjectId(userId, projectIds),
    ]
  )

  const projectsWithTotals = boundedProjects.map((project) => ({
    ...project,
    ...buildProjectTotals(
      project._id,
      estimatedByProject,
      trackedByProject
    ),
  }))

  return {
    projects: projectsWithTotals,
    truncated,
  }
}

async function getProjectContext(userId, args) {
  const { project, error } = await resolveOwnedProject(
    userId,
    args.projectId
  )

  if (error) {
    return { error }
  }

  const [
    tasks,
    notes,
    files,
    estimatedByProject,
    trackedByProject,
  ] = await Promise.all([
    scopedFind(
      Task,
      userId,
      { projectId: project._id },
      { limit: MAX_ROWS + 1 }
    ),
    scopedFind(
      Note,
      userId,
      { projectId: project._id },
      { limit: MAX_ROWS + 1 }
    ),
    scopedFind(
      File,
      userId,
      { projectId: project._id },
      {
        select: 'name mimeType size folderId createdAt',
        limit: MAX_ROWS + 1,
      }
    ),
    // Unbounded (not capped at MAX_ROWS), so the project-level totals below
    // stay accurate even when the task list itself gets truncated.
    sumEstimatedMinutesByProjectId(userId, [project._id]),
    sumTrackedMinutesByProjectId(userId, [project._id]),
  ])

  const tasksTruncated = tasks.length > MAX_ROWS
  const notesTruncated = notes.length > MAX_ROWS
  const filesTruncated = files.length > MAX_ROWS

  const boundedTasks = tasks.slice(0, MAX_ROWS)
  const boundedNotes = notes.slice(0, MAX_ROWS)
  const boundedFiles = files.slice(0, MAX_ROWS)

  const taskIds = boundedTasks.map((task) => task._id)
  const trackedMinutesByTaskId = await sumTrackedTimeByTaskId(
    userId,
    taskIds
  )

  const taskTree = buildTaskTree(
    boundedTasks,
    trackedMinutesByTaskId
  )

  const projectTotals = buildProjectTotals(
    project._id,
    estimatedByProject,
    trackedByProject
  )

  let notesTruncatedByLength = false

  const boundedNotesWithTruncatedContent = boundedNotes.map(
    (note) => {
      const { note: truncatedNote, wasTruncated } =
        truncateNoteContent(note)

      if (wasTruncated) {
        notesTruncatedByLength = true
      }

      return truncatedNote
    }
  )

  const result = {
    project,
    tasks: taskTree,
    notes: boundedNotesWithTruncatedContent,
    files: boundedFiles,
    totals: projectTotals,
    truncated:
      tasksTruncated ||
      notesTruncated ||
      filesTruncated ||
      notesTruncatedByLength,
  }

  // Overall size guard: keep trimming the largest arrays until the
  // serialized result fits the budget, in case many items are each small
  // but the combined context is still too large.
  while (
    JSON.stringify(result).length > MAX_PROJECT_CONTEXT_LENGTH &&
    (result.notes.length > 0 ||
      result.files.length > 0 ||
      result.tasks.length > 0)
  ) {
    result.truncated = true

    if (result.notes.length > 0) {
      result.notes.pop()
      continue
    }

    if (result.files.length > 0) {
      result.files.pop()
      continue
    }

    result.tasks.pop()
  }

  return result
}

async function listTasks(userId, args) {
  const { value: projectFilter, error } =
    await resolveProjectFilter(userId, args.projectId)

  if (error) {
    return { error }
  }

  const filter = {}

  if (projectFilter !== undefined) {
    filter.projectId = projectFilter
  }

  if (args.status) {
    filter.status = args.status
  }

  const tasks = await scopedFind(Task, userId, filter, {
    sort: { createdAt: -1 },
    limit: MAX_ROWS + 1,
  })

  const truncated = tasks.length > MAX_ROWS
  const boundedTasks = tasks.slice(0, MAX_ROWS)

  const trackedMinutesByTaskId = await sumTrackedTimeByTaskId(
    userId,
    boundedTasks.map((task) => task._id)
  )

  const tasksWithTotals = boundedTasks.map((task) => {
    const estimatedMinutes = task.estimatedMinutes || 0
    const trackedMinutes =
      trackedMinutesByTaskId.get(String(task._id)) || 0

    return {
      ...task,
      trackedMinutes,
      totalMinutes: estimatedMinutes + trackedMinutes,
    }
  })

  return {
    tasks: tasksWithTotals,
    truncated,
  }
}

async function listNotes(userId, args) {
  const { value: projectFilter, error } =
    await resolveProjectFilter(userId, args.projectId)

  if (error) {
    return { error }
  }

  const filter = {}

  if (projectFilter !== undefined) {
    filter.projectId = projectFilter
  }

  const notes = await scopedFind(Note, userId, filter, {
    sort: { createdAt: -1 },
    limit: MAX_ROWS + 1,
  })

  const rowsTruncated = notes.length > MAX_ROWS
  let contentTruncated = false

  const boundedNotes = notes.slice(0, MAX_ROWS).map((note) => {
    const { note: truncatedNote, wasTruncated } =
      truncateNoteContent(note)

    if (wasTruncated) {
      contentTruncated = true
    }

    return truncatedNote
  })

  return {
    notes: boundedNotes,
    truncated: rowsTruncated || contentTruncated,
  }
}

async function listTimeEntries(userId, args) {
  const { value: projectFilter, error: projectError } =
    await resolveProjectFilter(userId, args.projectId)

  if (projectError) {
    return { error: projectError }
  }

  const filter = {}

  if (projectFilter !== undefined) {
    filter.projectId = projectFilter
  }

  if (args.taskId !== undefined && args.taskId !== null) {
    const { task, error: taskError } = await resolveOwnedTask(
      userId,
      args.taskId
    )

    if (taskError) {
      return { error: taskError }
    }

    filter.taskId = task._id
  }

  if (args.from || args.to) {
    filter.startedAt = {}

    if (args.from) {
      const from = new Date(args.from)

      if (Number.isNaN(from.getTime())) {
        return { error: 'Invalid from date' }
      }

      filter.startedAt.$gte = from
    }

    if (args.to) {
      const to = new Date(args.to)

      if (Number.isNaN(to.getTime())) {
        return { error: 'Invalid to date' }
      }

      filter.startedAt.$lte = to
    }
  }

  // Read every matching entry (not just the returned page) so the total
  // duration is accurate even when there are more than MAX_ROWS entries.
  const entries = await scopedFind(TimeEntry, userId, filter, {
    sort: { startedAt: -1 },
  })

  const truncated = entries.length > MAX_ROWS
  const totalDuration = entries.reduce(
    (sum, entry) => sum + entry.duration,
    0
  )

  return {
    timeEntries: entries.slice(0, MAX_ROWS),
    totalDuration,
    truncated,
  }
}

async function getActiveTimer(userId) {
  const activeTimer = await scopedFindOne(ActiveTimer, userId, {})

  return {
    activeTimer,
  }
}

async function listFiles(userId, args) {
  const { value: projectFilter, error: projectError } =
    await resolveProjectFilter(userId, args.projectId)

  if (projectError) {
    return { error: projectError }
  }

  const filter = {}

  if (projectFilter !== undefined) {
    filter.projectId = projectFilter
  }

  if (args.folderId !== undefined && args.folderId !== null) {
    const { folder, error: folderError } =
      await resolveOwnedFolder(userId, args.folderId)

    if (folderError) {
      return { error: folderError }
    }

    filter.folderId = folder._id
  }

  const files = await scopedFind(File, userId, filter, {
    select: 'name mimeType size folderId createdAt',
    sort: { name: 1 },
    limit: MAX_ROWS + 1,
  })

  const truncated = files.length > MAX_ROWS

  return {
    files: files.slice(0, MAX_ROWS),
    truncated,
  }
}

// --- Write tools (create a pending action, never change data directly) ---
//
// Every write tool below only validates its arguments and saves an
// AIPendingAction. The actual database change happens later, in
// executeConfirmedAction, only after the user confirms via
// POST /api/ai/actions/:id/confirm.

// Parses an optional ISO date string argument. null/undefined -> no date.
function parseOptionalDateArg(value) {
  if (value === null || value === undefined) {
    return { value: null }
  }

  if (typeof value !== 'string') {
    return { error: 'Invalid date' }
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return { error: 'Invalid date' }
  }

  return { value: date }
}

function formatValueForSummary(value) {
  if (value === null || value === undefined || value === '') {
    return 'none'
  }

  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }

  return String(value)
}

function buildUpdateSummary(kind, name, changes) {
  if (changes.length === 0) {
    return `Update ${kind} '${name}': no changes`
  }

  const changeText = changes
    .map(
      ({ field, from, to }) =>
        `${field} ${formatValueForSummary(from)} → ${formatValueForSummary(to)}`
    )
    .join(', ')

  return `Update ${kind} '${name}': ${changeText}`
}

async function describeProjectName(userId, projectId) {
  if (!projectId) {
    return 'no project'
  }

  const project = await scopedFindOne(
    Project,
    userId,
    { _id: projectId },
    { select: 'name' }
  )

  return project ? project.name : 'unknown project'
}

// Saves a pending action and returns the tool result the model sees. This
// is the only place a write tool touches the database — it never changes
// app data, only records what the user would be confirming.
async function createPendingAction(
  context,
  type,
  targetId,
  payload,
  summary
) {
  context.pendingActionCount = (context.pendingActionCount || 0) + 1

  if (context.pendingActionCount > MAX_PENDING_ACTIONS_PER_RESPONSE) {
    return {
      error: 'Too many pending actions requested in this response',
    }
  }

  const action = await AIPendingAction.create({
    userId: context.userId,
    conversationId: context.conversationId,
    type,
    targetId: targetId || null,
    payload,
    summary,
  })

  if (context.createdActionIds) {
    context.createdActionIds.push(action._id)
  }

  return {
    status: 'pending_confirmation',
    actionId: action._id,
    summary,
  }
}

async function createTaskTool(context, args) {
  const { userId } = context

  if (typeof args.title !== 'string' || !args.title.trim()) {
    return { error: 'Title is required' }
  }

  if (args.title.length > 200) {
    return { error: 'Title must be at most 200 characters' }
  }

  if (
    args.description !== null &&
    args.description !== undefined &&
    typeof args.description !== 'string'
  ) {
    return { error: 'Invalid description' }
  }

  if (
    typeof args.description === 'string' &&
    args.description.length > 2000
  ) {
    return { error: 'Description must be at most 2000 characters' }
  }

  if (
    args.status !== null &&
    args.status !== undefined &&
    !TASK_STATUSES.includes(args.status)
  ) {
    return { error: 'Invalid status' }
  }

  if (
    args.priority !== null &&
    args.priority !== undefined &&
    !TASK_PRIORITIES.includes(args.priority)
  ) {
    return { error: 'Invalid priority' }
  }

  if (
    args.estimatedMinutes !== null &&
    args.estimatedMinutes !== undefined &&
    (typeof args.estimatedMinutes !== 'number' ||
      args.estimatedMinutes < 0)
  ) {
    return { error: 'Invalid estimatedMinutes' }
  }

  const startDate = parseOptionalDateArg(args.startDate)

  if (startDate.error) {
    return { error: startDate.error }
  }

  const dueDate = parseOptionalDateArg(args.dueDate)

  if (dueDate.error) {
    return { error: dueDate.error }
  }

  const { value: projectId, error: projectError } =
    await resolveProjectFilter(userId, args.projectId)

  if (projectError) {
    return { error: projectError }
  }

  let parentTask = null

  if (args.parentTaskId !== null && args.parentTaskId !== undefined) {
    const { task, error: parentError } = await resolveOwnedTask(
      userId,
      args.parentTaskId
    )

    if (parentError) {
      return { error: parentError }
    }

    parentTask = task

    if (
      projectId &&
      String(parentTask.projectId || '') !== String(projectId)
    ) {
      return { error: 'Parent task must belong to the same project' }
    }
  }

  const payload = {
    projectId: projectId || null,
    parentTaskId: parentTask ? parentTask._id : null,
    title: args.title.trim(),
    description:
      typeof args.description === 'string' ? args.description : '',
    status: args.status || 'todo',
    priority: args.priority || 'medium',
    startDate: startDate.value,
    dueDate: dueDate.value,
    estimatedMinutes:
      typeof args.estimatedMinutes === 'number'
        ? args.estimatedMinutes
        : 0,
  }

  const projectName = await describeProjectName(
    userId,
    payload.projectId
  )

  let summary = `Create task '${payload.title}' (project: ${projectName})`

  if (parentTask) {
    summary += `, parent: '${parentTask.title}'`
  }

  summary += '.'

  return createPendingAction(
    context,
    'create_task',
    null,
    payload,
    summary
  )
}

async function updateTaskTool(context, args) {
  const { userId } = context

  const { task: currentTask, error: taskError } =
    await resolveOwnedTask(userId, args.taskId)

  if (taskError) {
    return { error: taskError }
  }

  const payload = {}
  const changes = []

  if (args.title !== null && args.title !== undefined) {
    if (typeof args.title !== 'string' || !args.title.trim()) {
      return { error: 'Title is required' }
    }

    if (args.title.length > 200) {
      return { error: 'Title must be at most 200 characters' }
    }

    const newTitle = args.title.trim()

    if (newTitle !== currentTask.title) {
      payload.title = newTitle
      changes.push({
        field: 'title',
        from: currentTask.title,
        to: newTitle,
      })
    }
  }

  if (args.description !== null && args.description !== undefined) {
    if (typeof args.description !== 'string') {
      return { error: 'Invalid description' }
    }

    if (args.description.length > 2000) {
      return { error: 'Description must be at most 2000 characters' }
    }

    if (args.description !== (currentTask.description || '')) {
      payload.description = args.description
      changes.push({
        field: 'description',
        from: currentTask.description,
        to: args.description,
      })
    }
  }

  if (args.status !== null && args.status !== undefined) {
    if (!TASK_STATUSES.includes(args.status)) {
      return { error: 'Invalid status' }
    }

    if (args.status !== currentTask.status) {
      payload.status = args.status
      changes.push({
        field: 'status',
        from: currentTask.status,
        to: args.status,
      })
    }
  }

  if (args.priority !== null && args.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(args.priority)) {
      return { error: 'Invalid priority' }
    }

    if (args.priority !== currentTask.priority) {
      payload.priority = args.priority
      changes.push({
        field: 'priority',
        from: currentTask.priority,
        to: args.priority,
      })
    }
  }

  if (
    args.estimatedMinutes !== null &&
    args.estimatedMinutes !== undefined
  ) {
    if (
      typeof args.estimatedMinutes !== 'number' ||
      args.estimatedMinutes < 0
    ) {
      return { error: 'Invalid estimatedMinutes' }
    }

    if (args.estimatedMinutes !== currentTask.estimatedMinutes) {
      payload.estimatedMinutes = args.estimatedMinutes
      changes.push({
        field: 'estimatedMinutes',
        from: currentTask.estimatedMinutes,
        to: args.estimatedMinutes,
      })
    }
  }

  for (const dateField of ['startDate', 'dueDate']) {
    if (args[dateField] !== null && args[dateField] !== undefined) {
      const parsed = parseOptionalDateArg(args[dateField])

      if (parsed.error) {
        return { error: parsed.error }
      }

      const currentValue = currentTask[dateField]
        ? new Date(currentTask[dateField]).toISOString()
        : null
      const newValue = parsed.value ? parsed.value.toISOString() : null

      if (newValue !== currentValue) {
        payload[dateField] = parsed.value
        changes.push({
          field: dateField,
          from: currentTask[dateField],
          to: parsed.value,
        })
      }
    }
  }

  if (args.projectId !== null && args.projectId !== undefined) {
    const { value: newProjectId, error: projectError } =
      await resolveProjectFilter(userId, args.projectId)

    if (projectError) {
      return { error: projectError }
    }

    const currentProjectIdString = currentTask.projectId
      ? String(currentTask.projectId)
      : null
    const newProjectIdString = newProjectId
      ? String(newProjectId)
      : null

    if (newProjectIdString !== currentProjectIdString) {
      payload.projectId = newProjectId
      changes.push({
        field: 'projectId',
        from: currentProjectIdString,
        to: newProjectIdString,
      })
    }
  }

  let newParentTask = null

  if (args.parentTaskId !== null && args.parentTaskId !== undefined) {
    if (String(args.parentTaskId) === String(currentTask._id)) {
      return { error: 'Task cannot be its own parent' }
    }

    const { task: resolvedParent, error: parentError } =
      await resolveOwnedTask(userId, args.parentTaskId)

    if (parentError) {
      return { error: parentError }
    }

    newParentTask = resolvedParent

    const effectiveProjectId =
      payload.projectId !== undefined
        ? payload.projectId
        : currentTask.projectId

    if (
      effectiveProjectId &&
      String(newParentTask.projectId || '') !==
        String(effectiveProjectId)
    ) {
      return { error: 'Parent task must belong to the same project' }
    }

    const hasCycle = await wouldCreateParentCycle(
      userId,
      currentTask._id,
      newParentTask
    )

    if (hasCycle) {
      return { error: 'Invalid parent task' }
    }

    const currentParentIdString = currentTask.parentTaskId
      ? String(currentTask.parentTaskId)
      : null

    if (String(newParentTask._id) !== currentParentIdString) {
      payload.parentTaskId = newParentTask._id
      changes.push({
        field: 'parentTaskId',
        from: currentParentIdString,
        to: String(newParentTask._id),
      })
    }
  }

  const summary = buildUpdateSummary('task', currentTask.title, changes)

  return createPendingAction(
    context,
    'update_task',
    currentTask._id,
    payload,
    summary
  )
}

async function deleteTaskTool(context, args) {
  const { userId } = context

  const { task, error } = await resolveOwnedTask(userId, args.taskId)

  if (error) {
    return { error }
  }

  const subtaskCount = await scopedCount(Task, userId, {
    parentTaskId: task._id,
  })

  const projectName = await describeProjectName(userId, task.projectId)

  let summary = `Delete task '${task.title}' (project: ${projectName}).`

  if (subtaskCount > 0) {
    summary += ` ${subtaskCount} subtask${
      subtaskCount === 1 ? '' : 's'
    } will remain without a parent.`
  }

  return createPendingAction(context, 'delete_task', task._id, {}, summary)
}

async function createNoteTool(context, args) {
  const { userId } = context

  if (typeof args.title !== 'string' || !args.title.trim()) {
    return { error: 'Title is required' }
  }

  if (args.title.length > 200) {
    return { error: 'Title must be at most 200 characters' }
  }

  if (typeof args.content !== 'string' || !args.content.trim()) {
    return { error: 'Content is required' }
  }

  if (
    args.priority !== null &&
    args.priority !== undefined &&
    !NOTE_PRIORITIES.includes(args.priority)
  ) {
    return { error: 'Invalid priority' }
  }

  const { value: projectId, error: projectError } =
    await resolveProjectFilter(userId, args.projectId)

  if (projectError) {
    return { error: projectError }
  }

  const payload = {
    projectId: projectId || null,
    title: args.title.trim(),
    content: args.content,
    priority: args.priority || 'medium',
  }

  const projectName = await describeProjectName(
    userId,
    payload.projectId
  )

  const summary = `Create note '${payload.title}' (project: ${projectName}).`

  return createPendingAction(
    context,
    'create_note',
    null,
    payload,
    summary
  )
}

async function updateNoteTool(context, args) {
  const { userId } = context

  const { note: currentNote, error: noteError } =
    await resolveOwnedNote(userId, args.noteId)

  if (noteError) {
    return { error: noteError }
  }

  const payload = {}
  const changes = []

  if (args.title !== null && args.title !== undefined) {
    if (typeof args.title !== 'string' || !args.title.trim()) {
      return { error: 'Title is required' }
    }

    if (args.title.length > 200) {
      return { error: 'Title must be at most 200 characters' }
    }

    const newTitle = args.title.trim()

    if (newTitle !== currentNote.title) {
      payload.title = newTitle
      changes.push({
        field: 'title',
        from: currentNote.title,
        to: newTitle,
      })
    }
  }

  if (args.content !== null && args.content !== undefined) {
    if (typeof args.content !== 'string' || !args.content.trim()) {
      return { error: 'Content is required' }
    }

    if (args.content !== currentNote.content) {
      payload.content = args.content
      changes.push({
        field: 'content',
        from: '(previous content)',
        to: '(new content)',
      })
    }
  }

  if (args.priority !== null && args.priority !== undefined) {
    if (!NOTE_PRIORITIES.includes(args.priority)) {
      return { error: 'Invalid priority' }
    }

    if (args.priority !== currentNote.priority) {
      payload.priority = args.priority
      changes.push({
        field: 'priority',
        from: currentNote.priority,
        to: args.priority,
      })
    }
  }

  if (args.projectId !== null && args.projectId !== undefined) {
    const { value: newProjectId, error: projectError } =
      await resolveProjectFilter(userId, args.projectId)

    if (projectError) {
      return { error: projectError }
    }

    const currentProjectIdString = currentNote.projectId
      ? String(currentNote.projectId)
      : null
    const newProjectIdString = newProjectId
      ? String(newProjectId)
      : null

    if (newProjectIdString !== currentProjectIdString) {
      payload.projectId = newProjectId
      changes.push({
        field: 'projectId',
        from: currentProjectIdString,
        to: newProjectIdString,
      })
    }
  }

  const summary = buildUpdateSummary('note', currentNote.title, changes)

  return createPendingAction(
    context,
    'update_note',
    currentNote._id,
    payload,
    summary
  )
}

async function deleteNoteTool(context, args) {
  const { userId } = context

  const { note, error } = await resolveOwnedNote(userId, args.noteId)

  if (error) {
    return { error }
  }

  const projectName = await describeProjectName(userId, note.projectId)

  const summary = `Delete note '${note.title}' (project: ${projectName}).`

  return createPendingAction(context, 'delete_note', note._id, {}, summary)
}

async function createProjectTool(context, args) {
  if (typeof args.name !== 'string' || !args.name.trim()) {
    return { error: 'Name is required' }
  }

  if (args.name.length > 150) {
    return { error: 'Name must be at most 150 characters' }
  }

  if (
    args.description !== null &&
    args.description !== undefined &&
    typeof args.description !== 'string'
  ) {
    return { error: 'Invalid description' }
  }

  if (
    typeof args.description === 'string' &&
    args.description.length > 2000
  ) {
    return { error: 'Description must be at most 2000 characters' }
  }

  if (
    args.repositoryUrl !== null &&
    args.repositoryUrl !== undefined &&
    typeof args.repositoryUrl !== 'string'
  ) {
    return { error: 'Invalid repositoryUrl' }
  }

  if (
    typeof args.repositoryUrl === 'string' &&
    args.repositoryUrl.length > 500
  ) {
    return { error: 'Repository URL must be at most 500 characters' }
  }

  if (
    args.status !== null &&
    args.status !== undefined &&
    !PROJECT_STATUSES.includes(args.status)
  ) {
    return { error: 'Invalid status' }
  }

  if (
    args.color !== null &&
    args.color !== undefined &&
    typeof args.color !== 'string'
  ) {
    return { error: 'Invalid color' }
  }

  const payload = {
    name: args.name.trim(),
    description:
      typeof args.description === 'string'
        ? args.description.trim()
        : '',
    repositoryUrl:
      typeof args.repositoryUrl === 'string'
        ? args.repositoryUrl.trim()
        : '',
    status: args.status || 'active',
    color: args.color || '#1688ff',
  }

  const summary = `Create project '${payload.name}'.`

  return createPendingAction(
    context,
    'create_project',
    null,
    payload,
    summary
  )
}

async function updateProjectTool(context, args) {
  const { userId } = context

  const { project: currentProject, error: projectError } =
    await resolveOwnedProject(userId, args.projectId)

  if (projectError) {
    return { error: projectError }
  }

  const payload = {}
  const changes = []

  if (args.name !== null && args.name !== undefined) {
    if (typeof args.name !== 'string' || !args.name.trim()) {
      return { error: 'Name is required' }
    }

    if (args.name.length > 150) {
      return { error: 'Name must be at most 150 characters' }
    }

    const newName = args.name.trim()

    if (newName !== currentProject.name) {
      payload.name = newName
      changes.push({
        field: 'name',
        from: currentProject.name,
        to: newName,
      })
    }
  }

  if (args.description !== null && args.description !== undefined) {
    if (typeof args.description !== 'string') {
      return { error: 'Invalid description' }
    }

    if (args.description.length > 2000) {
      return { error: 'Description must be at most 2000 characters' }
    }

    if (args.description !== (currentProject.description || '')) {
      payload.description = args.description
      changes.push({
        field: 'description',
        from: currentProject.description,
        to: args.description,
      })
    }
  }

  if (args.repositoryUrl !== null && args.repositoryUrl !== undefined) {
    if (typeof args.repositoryUrl !== 'string') {
      return { error: 'Invalid repositoryUrl' }
    }

    if (args.repositoryUrl.length > 500) {
      return { error: 'Repository URL must be at most 500 characters' }
    }

    if (args.repositoryUrl !== (currentProject.repositoryUrl || '')) {
      payload.repositoryUrl = args.repositoryUrl
      changes.push({
        field: 'repositoryUrl',
        from: currentProject.repositoryUrl,
        to: args.repositoryUrl,
      })
    }
  }

  if (args.status !== null && args.status !== undefined) {
    if (!PROJECT_STATUSES.includes(args.status)) {
      return { error: 'Invalid status' }
    }

    if (args.status !== currentProject.status) {
      payload.status = args.status
      changes.push({
        field: 'status',
        from: currentProject.status,
        to: args.status,
      })
    }
  }

  if (args.color !== null && args.color !== undefined) {
    if (typeof args.color !== 'string') {
      return { error: 'Invalid color' }
    }

    if (args.color !== currentProject.color) {
      payload.color = args.color
      changes.push({
        field: 'color',
        from: currentProject.color,
        to: args.color,
      })
    }
  }

  const summary = buildUpdateSummary(
    'project',
    currentProject.name,
    changes
  )

  return createPendingAction(
    context,
    'update_project',
    currentProject._id,
    payload,
    summary
  )
}

// Describes what an active timer is tracking, for summaries: the task
// title, the project name if there's no task, or its own description.
async function describeTimerSubject(userId, timer) {
  if (timer.taskId) {
    const task = await scopedFindOne(
      Task,
      userId,
      { _id: timer.taskId },
      { select: 'title' }
    )

    if (task) {
      return `'${task.title}'`
    }
  }

  if (timer.projectId) {
    const project = await scopedFindOne(
      Project,
      userId,
      { _id: timer.projectId },
      { select: 'name' }
    )

    if (project) {
      return `project '${project.name}'`
    }
  }

  return timer.description
    ? `'${timer.description}'`
    : 'the current timer'
}

async function startTimerTool(context, args) {
  const { userId } = context

  const { task, error: taskError } = await resolveOwnedTask(
    userId,
    args.taskId
  )

  if (taskError) {
    return { error: taskError }
  }

  const existingTimer = await scopedFindOne(ActiveTimer, userId, {})

  if (
    existingTimer &&
    String(existingTimer.taskId || '') === String(task._id)
  ) {
    return { error: 'A timer for this task is already active.' }
  }

  const payload = {
    taskId: task._id,
    projectId: task.projectId || null,
    description: task.title || '',
  }

  let summary

  if (existingTimer) {
    const oldElapsedMs = getElapsedMs(existingTimer, Date.now())
    const oldMinutes = elapsedMsToDurationMinutes(oldElapsedMs)
    const oldSubject = await describeTimerSubject(
      userId,
      existingTimer
    )

    summary = `Switch timer from ${oldSubject} (${oldMinutes} min) to '${task.title}'.`
  } else {
    summary = `Start timer for '${task.title}'.`
  }

  return createPendingAction(
    context,
    'start_timer',
    null,
    payload,
    summary
  )
}

async function pauseTimerTool(context) {
  const { userId } = context

  const timer = await scopedFindOne(ActiveTimer, userId, {})

  if (!timer) {
    return { error: 'No active timer to pause.' }
  }

  if (timer.status !== 'running') {
    return { error: 'The active timer is not running.' }
  }

  const subject = await describeTimerSubject(userId, timer)
  const minutes = elapsedMsToDurationMinutes(
    getElapsedMs(timer, Date.now())
  )

  const summary = `Pause timer for ${subject} (${minutes} min so far).`

  return createPendingAction(
    context,
    'pause_timer',
    timer._id,
    {},
    summary
  )
}

async function resumeTimerTool(context) {
  const { userId } = context

  const timer = await scopedFindOne(ActiveTimer, userId, {})

  if (!timer) {
    return { error: 'No active timer to resume.' }
  }

  if (timer.status !== 'paused') {
    return { error: 'The active timer is not paused.' }
  }

  const subject = await describeTimerSubject(userId, timer)

  const summary = `Resume timer for ${subject}.`

  return createPendingAction(
    context,
    'resume_timer',
    timer._id,
    {},
    summary
  )
}

async function stopTimerTool(context) {
  const { userId } = context

  const timer = await scopedFindOne(ActiveTimer, userId, {})

  if (!timer) {
    return { error: 'No active timer to stop.' }
  }

  const subject = await describeTimerSubject(userId, timer)
  const minutes = elapsedMsToDurationMinutes(
    getElapsedMs(timer, Date.now())
  )

  const summary = `Stop timer for ${subject} (${minutes} min) and save the time entry.`

  return createPendingAction(
    context,
    'stop_timer',
    timer._id,
    {},
    summary
  )
}

// --- Confirmed execution (only reached after the user clicks Confirm) ---
//
// Re-validates ownership/existence right before writing (the target or a
// referenced project/parent may have been deleted since the action was
// created), then performs the same kind of change the matching REST route
// would. Never throws: any failure comes back as a failed result instead.

async function executeCreateTask(userId, payload) {
  if (payload.projectId) {
    const project = await scopedFindOne(Project, userId, {
      _id: payload.projectId,
    })

    if (!project) {
      return { status: 'failed', result: { error: 'Not found' } }
    }
  }

  if (payload.parentTaskId) {
    const parentTask = await scopedFindOne(Task, userId, {
      _id: payload.parentTaskId,
    })

    if (!parentTask) {
      return { status: 'failed', result: { error: 'Not found' } }
    }
  }

  const task = await Task.create({ userId, ...payload })

  return { status: 'executed', result: { taskId: task._id } }
}

async function executeUpdateTask(userId, targetId, payload) {
  const task = await Task.findOne({ _id: targetId, userId })

  if (!task) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  if (payload.projectId) {
    const project = await scopedFindOne(Project, userId, {
      _id: payload.projectId,
    })

    if (!project) {
      return { status: 'failed', result: { error: 'Not found' } }
    }
  }

  if (payload.parentTaskId) {
    const parentTask = await scopedFindOne(Task, userId, {
      _id: payload.parentTaskId,
    })

    if (!parentTask) {
      return { status: 'failed', result: { error: 'Not found' } }
    }

    const hasCycle = await wouldCreateParentCycle(
      userId,
      task._id,
      parentTask
    )

    if (hasCycle) {
      return { status: 'failed', result: { error: 'Invalid parent task' } }
    }
  }

  Object.assign(task, payload)

  await task.save()

  return { status: 'executed', result: { taskId: task._id } }
}

async function executeDeleteTask(userId, targetId) {
  const task = await Task.findOneAndDelete({ _id: targetId, userId })

  if (!task) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  return { status: 'executed', result: { taskId: targetId } }
}

async function executeCreateNote(userId, payload) {
  if (payload.projectId) {
    const project = await scopedFindOne(Project, userId, {
      _id: payload.projectId,
    })

    if (!project) {
      return { status: 'failed', result: { error: 'Not found' } }
    }
  }

  const note = await Note.create({ userId, ...payload })

  return { status: 'executed', result: { noteId: note._id } }
}

async function executeUpdateNote(userId, targetId, payload) {
  const note = await Note.findOne({ _id: targetId, userId })

  if (!note) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  if (payload.projectId) {
    const project = await scopedFindOne(Project, userId, {
      _id: payload.projectId,
    })

    if (!project) {
      return { status: 'failed', result: { error: 'Not found' } }
    }
  }

  Object.assign(note, payload)

  await note.save()

  return { status: 'executed', result: { noteId: note._id } }
}

async function executeDeleteNote(userId, targetId) {
  const note = await Note.findOneAndDelete({ _id: targetId, userId })

  if (!note) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  return { status: 'executed', result: { noteId: targetId } }
}

async function executeCreateProject(userId, payload) {
  const project = await Project.create({ userId, ...payload })

  return { status: 'executed', result: { projectId: project._id } }
}

async function executeUpdateProject(userId, targetId, payload) {
  const project = await Project.findOne({ _id: targetId, userId })

  if (!project) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  Object.assign(project, payload)

  await project.save()

  return { status: 'executed', result: { projectId: project._id } }
}

async function executeStartTimer(userId, payload) {
  const task = await scopedFindOne(Task, userId, {
    _id: payload.taskId,
  })

  if (!task) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  // Re-checked at confirm time rather than trusting the pending action's
  // snapshot, since the timer may have changed since it was created.
  const now = Date.now()

  const { activeTimer, error } = await switchActiveTimer(userId, {
    taskId: payload.taskId,
    projectId: payload.projectId || null,
    description: payload.description || '',
    startedAt: new Date(now),
    segmentStartedAt: new Date(now),
    now,
  })

  if (error === 'SAME_TASK_ACTIVE') {
    return {
      status: 'failed',
      result: {
        error: 'A timer for this task is already active.',
      },
    }
  }

  return {
    status: 'executed',
    result: { activeTimerId: activeTimer._id },
  }
}

async function executePauseTimer(userId, targetId) {
  const timer = await ActiveTimer.findOne({ _id: targetId, userId })

  if (!timer) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  const { error } = await pauseActiveTimer(timer, Date.now())

  if (error === 'NOT_RUNNING') {
    return {
      status: 'failed',
      result: { error: 'The active timer is not running.' },
    }
  }

  return {
    status: 'executed',
    result: { activeTimerId: timer._id },
  }
}

async function executeResumeTimer(userId, targetId) {
  const timer = await ActiveTimer.findOne({ _id: targetId, userId })

  if (!timer) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  const { error } = await resumeActiveTimer(timer, Date.now())

  if (error === 'NOT_PAUSED') {
    return {
      status: 'failed',
      result: { error: 'The active timer is not paused.' },
    }
  }

  return {
    status: 'executed',
    result: { activeTimerId: timer._id },
  }
}

async function executeStopTimer(userId, targetId) {
  const timer = await ActiveTimer.findOne({ _id: targetId, userId })

  if (!timer) {
    return { status: 'failed', result: { error: 'Not found' } }
  }

  const timeEntry = await stopActiveTimerAndSaveEntry(userId, timer)

  return {
    status: 'executed',
    result: { timeEntryId: timeEntry._id },
  }
}

// Dispatches a confirmed pending action to the matching executor. Called
// only from the /actions/:id/confirm route, only once the action has been
// atomically claimed (status pending -> executing) so it can never run twice.
async function executeConfirmedAction(action) {
  const userId = action.userId
  const payload = action.payload || {}

  try {
    switch (action.type) {
      case 'create_task':
        return await executeCreateTask(userId, payload)
      case 'update_task':
        return await executeUpdateTask(userId, action.targetId, payload)
      case 'delete_task':
        return await executeDeleteTask(userId, action.targetId)
      case 'create_note':
        return await executeCreateNote(userId, payload)
      case 'update_note':
        return await executeUpdateNote(userId, action.targetId, payload)
      case 'delete_note':
        return await executeDeleteNote(userId, action.targetId)
      case 'create_project':
        return await executeCreateProject(userId, payload)
      case 'update_project':
        return await executeUpdateProject(
          userId,
          action.targetId,
          payload
        )
      case 'start_timer':
        return await executeStartTimer(userId, payload)
      case 'pause_timer':
        return await executePauseTimer(userId, action.targetId)
      case 'resume_timer':
        return await executeResumeTimer(userId, action.targetId)
      case 'stop_timer':
        return await executeStopTimer(userId, action.targetId)
      default:
        return {
          status: 'failed',
          result: { error: 'Unknown action type' },
        }
    }
  } catch (error) {
    console.error(
      `Failed to execute confirmed action "${action.type}":`,
      error
    )
    return { status: 'failed', result: { error: 'Execution failed' } }
  }
}

// Tool definitions in the Responses API function-tool format, alongside the
// existing generate_image tool. Every argument is required in strict mode;
// optional filters accept null instead of being omitted.
const toolDefinitions = [
  {
    type: 'function',
    name: 'list_projects',
    description:
      "List the user's projects with their name, description, status, color, repository URL, and estimated/tracked/total time in minutes (totalMinutes matches the Time page's project total).",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_project_context',
    description:
      "Get full context for one project: its details, tasks with their subtask structure, notes, file metadata, task dates, and estimated/tracked/total time in minutes at both the project and task level (totalMinutes matches the Time page's totals). Use this for summaries or analysis of a whole project.",
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to get context for.',
        },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'list_tasks',
    description:
      "List the user's tasks, including parent task, priority, dates, and estimated/tracked/total time in minutes (totalMinutes matches the Time page's per-task total). Can be filtered by project and status.",
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: ['string', 'null'],
          description:
            'Filter by project ID, "no-project" for tasks with no project, or null for every project.',
        },
        status: {
          type: ['string', 'null'],
          enum: ['todo', 'in-progress', 'completed', null],
          description: 'Filter by status, or null for every status.',
        },
      },
      required: ['projectId', 'status'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'list_notes',
    description:
      "List the user's notes with title, content, priority and project. Can be filtered by project.",
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: ['string', 'null'],
          description:
            'Filter by project ID, "no-project" for notes with no project, or null for every project.',
        },
      },
      required: ['projectId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'list_time_entries',
    description:
      "List the user's tracked time entries with duration, description and when they happened, plus the total duration. Can be filtered by project, task and date range.",
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: ['string', 'null'],
          description:
            'Filter by project ID, "no-project" for entries with no project, or null for every project.',
        },
        taskId: {
          type: ['string', 'null'],
          description: 'Filter by task ID, or null for every task.',
        },
        from: {
          type: ['string', 'null'],
          description:
            'ISO 8601 date/time lower bound (inclusive), or null for no lower bound.',
        },
        to: {
          type: ['string', 'null'],
          description:
            'ISO 8601 date/time upper bound (inclusive), or null for no upper bound.',
        },
      },
      required: ['projectId', 'taskId', 'from', 'to'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_active_timer',
    description:
      "Get the user's currently running or paused time tracker, if any.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'list_files',
    description:
      "List metadata only (name, type, size, folder) for the user's files, without their content. Can be filtered by project and folder.",
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: ['string', 'null'],
          description:
            'Filter by project ID, "no-project" for files with no project, or null for every project.',
        },
        folderId: {
          type: ['string', 'null'],
          description: 'Filter by folder ID, or null for every folder.',
        },
      },
      required: ['projectId', 'folderId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_task',
    description:
      'Propose creating a new task. This only creates a pending action for the user to confirm — nothing is created until they confirm it.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: ['string', 'null'],
          description:
            'Project ID, "no-project" for no project, or null for no project.',
        },
        parentTaskId: {
          type: ['string', 'null'],
          description: 'Parent task ID, or null for a top-level task.',
        },
        title: {
          type: 'string',
          description: 'Task title (required, max 200 characters).',
        },
        description: {
          type: ['string', 'null'],
          description: 'Task description, or null for none.',
        },
        status: {
          type: ['string', 'null'],
          enum: ['todo', 'in-progress', 'completed', null],
          description: 'Status, or null to default to todo.',
        },
        priority: {
          type: ['string', 'null'],
          enum: ['low', 'medium', 'high', null],
          description: 'Priority, or null to default to medium.',
        },
        startDate: {
          type: ['string', 'null'],
          description: 'ISO 8601 start date, or null for none.',
        },
        dueDate: {
          type: ['string', 'null'],
          description: 'ISO 8601 due date, or null for none.',
        },
        estimatedMinutes: {
          type: ['number', 'null'],
          description: 'Estimated time in minutes, or null for 0.',
        },
      },
      required: [
        'projectId',
        'parentTaskId',
        'title',
        'description',
        'status',
        'priority',
        'startDate',
        'dueDate',
        'estimatedMinutes',
      ],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'update_task',
    description:
      'Propose updating an existing task. Pass null for any field that should stay unchanged. For projectId, pass "no-project" to remove the project. Only creates a pending action; nothing changes until the user confirms.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to update.',
        },
        projectId: {
          type: ['string', 'null'],
          description:
            'New project ID, "no-project" to remove the project, or null to leave unchanged.',
        },
        parentTaskId: {
          type: ['string', 'null'],
          description:
            'New parent task ID, or null to leave unchanged.',
        },
        title: {
          type: ['string', 'null'],
          description: 'New title, or null to leave unchanged.',
        },
        description: {
          type: ['string', 'null'],
          description: 'New description, or null to leave unchanged.',
        },
        status: {
          type: ['string', 'null'],
          enum: ['todo', 'in-progress', 'completed', null],
          description: 'New status, or null to leave unchanged.',
        },
        priority: {
          type: ['string', 'null'],
          enum: ['low', 'medium', 'high', null],
          description: 'New priority, or null to leave unchanged.',
        },
        startDate: {
          type: ['string', 'null'],
          description:
            'New ISO 8601 start date, or null to leave unchanged.',
        },
        dueDate: {
          type: ['string', 'null'],
          description:
            'New ISO 8601 due date, or null to leave unchanged.',
        },
        estimatedMinutes: {
          type: ['number', 'null'],
          description:
            'New estimated time in minutes, or null to leave unchanged.',
        },
      },
      required: [
        'taskId',
        'projectId',
        'parentTaskId',
        'title',
        'description',
        'status',
        'priority',
        'startDate',
        'dueDate',
        'estimatedMinutes',
      ],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'delete_task',
    description:
      'Propose deleting a task. Subtasks are not deleted and will remain without a parent. Only creates a pending action; nothing is deleted until the user confirms.',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to delete.',
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_note',
    description:
      "Propose creating a new note. To create a note from a task, first read the task with a read tool and use its details to write the note's content. Only creates a pending action; nothing is created until the user confirms.",
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: ['string', 'null'],
          description:
            'Project ID, "no-project" for no project, or null for no project.',
        },
        title: {
          type: 'string',
          description: 'Note title (required, max 200 characters).',
        },
        content: {
          type: 'string',
          description: 'Note content (required).',
        },
        priority: {
          type: ['string', 'null'],
          enum: ['low', 'medium', 'high', null],
          description: 'Priority, or null to default to medium.',
        },
      },
      required: ['projectId', 'title', 'content', 'priority'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'update_note',
    description:
      'Propose updating an existing note. Pass null for any field that should stay unchanged. Only creates a pending action; nothing changes until the user confirms.',
    parameters: {
      type: 'object',
      properties: {
        noteId: {
          type: 'string',
          description: 'The note ID to update.',
        },
        title: {
          type: ['string', 'null'],
          description: 'New title, or null to leave unchanged.',
        },
        content: {
          type: ['string', 'null'],
          description: 'New content, or null to leave unchanged.',
        },
        priority: {
          type: ['string', 'null'],
          enum: ['low', 'medium', 'high', null],
          description: 'New priority, or null to leave unchanged.',
        },
        projectId: {
          type: ['string', 'null'],
          description:
            'New project ID, "no-project" to remove the project, or null to leave unchanged.',
        },
      },
      required: ['noteId', 'title', 'content', 'priority', 'projectId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'delete_note',
    description:
      'Propose deleting a note. Only creates a pending action; nothing is deleted until the user confirms.',
    parameters: {
      type: 'object',
      properties: {
        noteId: {
          type: 'string',
          description: 'The note ID to delete.',
        },
      },
      required: ['noteId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_project',
    description:
      'Propose creating a new project. Only creates a pending action; nothing is created until the user confirms.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Project name (required, max 150 characters).',
        },
        description: {
          type: ['string', 'null'],
          description: 'Project description, or null for none.',
        },
        repositoryUrl: {
          type: ['string', 'null'],
          description: 'Repository URL, or null for none.',
        },
        status: {
          type: ['string', 'null'],
          enum: ['active', 'completed', 'archived', null],
          description: 'Status, or null to default to active.',
        },
        color: {
          type: ['string', 'null'],
          description: 'Hex color, or null to use the default.',
        },
      },
      required: [
        'name',
        'description',
        'repositoryUrl',
        'status',
        'color',
      ],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'update_project',
    description:
      'Propose updating an existing project. Pass null for any field that should stay unchanged. There is no tool to delete a project. Only creates a pending action; nothing changes until the user confirms.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The project ID to update.',
        },
        name: {
          type: ['string', 'null'],
          description: 'New name, or null to leave unchanged.',
        },
        description: {
          type: ['string', 'null'],
          description: 'New description, or null to leave unchanged.',
        },
        repositoryUrl: {
          type: ['string', 'null'],
          description:
            'New repository URL, or null to leave unchanged.',
        },
        status: {
          type: ['string', 'null'],
          enum: ['active', 'completed', 'archived', null],
          description: 'New status, or null to leave unchanged.',
        },
        color: {
          type: ['string', 'null'],
          description: 'New hex color, or null to leave unchanged.',
        },
      },
      required: [
        'projectId',
        'name',
        'description',
        'repositoryUrl',
        'status',
        'color',
      ],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'start_timer',
    description:
      "Propose starting a time tracker for a task. If another timer is already running or paused on a different task, confirming this stops it (saving its tracked time as a time entry, the same way the app's own stop button does) and starts the new one. Only creates a pending action; nothing changes until the user confirms.",
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The task ID to start tracking time for.',
        },
      },
      required: ['taskId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'pause_timer',
    description:
      "Propose pausing the user's currently running time tracker. Only creates a pending action; nothing changes until the user confirms.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'resume_timer',
    description:
      "Propose resuming the user's currently paused time tracker. Only creates a pending action; nothing changes until the user confirms.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'stop_timer',
    description:
      "Propose stopping the user's currently active time tracker and saving the tracked time as a time entry, the same way the app's own stop button does. Only creates a pending action; nothing changes until the user confirms.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
]

// Every tool defined in this file (read tools and write tools, which only
// ever create a pending action and never mutate data themselves). Used by
// aiRoutes.js to tell these apart from generate_image, which is handled
// separately and never goes through executeAssistantTool.
const ASSISTANT_TOOL_NAMES = new Set(
  toolDefinitions.map((tool) => tool.name)
)

// Read tool handlers only need the userId; write tool handlers need the
// full context (userId, conversationId, and the pending-action bookkeeping
// createPendingAction attaches to it), so every handler takes (context, args).
const handlers = {
  list_projects: (context) => listProjects(context.userId),
  get_project_context: (context, args) =>
    getProjectContext(context.userId, args),
  list_tasks: (context, args) => listTasks(context.userId, args),
  list_notes: (context, args) => listNotes(context.userId, args),
  list_time_entries: (context, args) =>
    listTimeEntries(context.userId, args),
  get_active_timer: (context) => getActiveTimer(context.userId),
  list_files: (context, args) => listFiles(context.userId, args),
  create_task: (context, args) => createTaskTool(context, args),
  update_task: (context, args) => updateTaskTool(context, args),
  delete_task: (context, args) => deleteTaskTool(context, args),
  create_note: (context, args) => createNoteTool(context, args),
  update_note: (context, args) => updateNoteTool(context, args),
  delete_note: (context, args) => deleteNoteTool(context, args),
  create_project: (context, args) => createProjectTool(context, args),
  update_project: (context, args) => updateProjectTool(context, args),
  start_timer: (context, args) => startTimerTool(context, args),
  pause_timer: (context) => pauseTimerTool(context),
  resume_timer: (context) => resumeTimerTool(context),
  stop_timer: (context) => stopTimerTool(context),
}

// Runs one tool call by name. Never throws: unknown tools and bad arguments
// come back as an { error } result for the model instead of failing the
// request. context is { userId, conversationId, pendingActionCount,
// createdActionIds } — see createPendingAction.
async function executeAssistantTool(name, argsJson, context) {
  const handler = handlers[name]

  if (!handler) {
    return { error: 'Unknown tool' }
  }

  let args

  try {
    args = argsJson ? JSON.parse(argsJson) : {}
  } catch {
    return { error: 'Invalid arguments' }
  }

  try {
    return await handler(context, args)
  } catch (error) {
    console.error(`Assistant tool "${name}" failed:`, error)
    return { error: 'Tool execution failed' }
  }
}

module.exports = {
  toolDefinitions,
  ASSISTANT_TOOL_NAMES,
  executeAssistantTool,
  executeConfirmedAction,
}
