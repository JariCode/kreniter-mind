const mongoose = require('mongoose')
const Project = require('../models/Project')
const Task = require('../models/Task')
const Note = require('../models/Note')
const TimeEntry = require('../models/TimeEntry')
const ActiveTimer = require('../models/ActiveTimer')
const File = require('../models/File')
const Folder = require('../models/Folder')

// Read-only tools the AI Assistant can call to look at the current user's
// own workspace data. Every database read in this file goes through
// scopedFind/scopedFindOne so the userId filter and the sensitive-field
// stripping can never be skipped by accident.

const MAX_ROWS = 200
const MAX_NOTE_CONTENT_LENGTH = 4000
const MAX_PROJECT_CONTEXT_LENGTH = 60000

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
]

const READ_ONLY_TOOL_NAMES = new Set(
  toolDefinitions.map((tool) => tool.name)
)

const handlers = {
  list_projects: (userId) => listProjects(userId),
  get_project_context: (userId, args) =>
    getProjectContext(userId, args),
  list_tasks: (userId, args) => listTasks(userId, args),
  list_notes: (userId, args) => listNotes(userId, args),
  list_time_entries: (userId, args) =>
    listTimeEntries(userId, args),
  get_active_timer: (userId) => getActiveTimer(userId),
  list_files: (userId, args) => listFiles(userId, args),
}

// Runs one tool call by name. Never throws: unknown tools and bad arguments
// come back as an { error } result for the model instead of failing the request.
async function executeAssistantTool(name, argsJson, userId) {
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
    return await handler(userId, args)
  } catch (error) {
    console.error(`Assistant tool "${name}" failed:`, error)
    return { error: 'Tool execution failed' }
  }
}

module.exports = {
  toolDefinitions,
  READ_ONLY_TOOL_NAMES,
  executeAssistantTool,
}
