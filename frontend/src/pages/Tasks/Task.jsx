import { useEffect, useState } from 'react'
import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
} from '../../api/tasks'
import { getProjects } from '../../api/projects'
import { getTimeEntries } from '../../api/timeEntries'
import { useTimeTracker } from '../../components/TimeTracker/TimeTracker'
import './Task.css'

function Task() {
  const {
    activeTimer,
    elapsedSeconds,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    cancelTimer,
    isSaving: timerSaving,
    error: timerError,
    timeEntriesVersion,
  } = useTimeTracker()

  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [parentTaskId, setParentTaskId] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [status, setStatus] = useState('todo')
  const [priority, setPriority] = useState('medium')
  const [startDate, setStartDate] = useState('')
  const [completedDate, setCompletedDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function loadData() {
    try {
      setError('')

      const [
        tasksData,
        projectsData,
        timeEntriesData,
      ] = await Promise.all([
        getTasks(),
        getProjects(),
        getTimeEntries(),
      ])

      setTasks(tasksData)
      setProjects(projectsData)
      setTimeEntries(timeEntriesData)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (timeEntriesVersion === 0) {
      return
    }

    async function refreshTimeEntries() {
      try {
        const data = await getTimeEntries()
        setTimeEntries(data)
      } catch (error) {
        console.error(
          'Failed to refresh time entries:',
          error
        )
      }
    }

    refreshTimeEntries()
  }, [timeEntriesVersion])

  function resetForm() {
    setTitle('')
    setDescription('')
    setProjectId('')
    setParentTaskId('')
    setEstimatedHours('')
    setStatus('todo')
    setPriority('medium')
    setStartDate('')
    setCompletedDate('')
    setDueDate('')
    setEditingTask(null)
    setShowForm(false)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function formatDateInput(date) {
    return date
      ? new Date(date).toISOString().split('T')[0]
      : ''
  }

  function getTodayDate() {
    return new Date().toISOString().split('T')[0]
  }

  function startEdit(task) {
    setTitle(task.title || '')
    setDescription(task.description || '')
    setProjectId(task.projectId || '')
    setParentTaskId(task.parentTaskId || '')

    setEstimatedHours(
      task.estimatedMinutes !== undefined &&
        task.estimatedMinutes !== null
        ? String(
            Number(
              (
                task.estimatedMinutes / 60
              ).toFixed(2)
            )
          )
        : ''
    )

    setStatus(task.status || 'todo')
    setPriority(task.priority || 'medium')

    setStartDate(formatDateInput(task.startDate))
    setCompletedDate(formatDateInput(task.completedDate))

    setDueDate(
      task.dueDate
        ? new Date(task.dueDate)
            .toISOString()
            .split('T')[0]
        : ''
    )

    setEditingTask(task)
    setShowForm(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!title.trim()) {
      return
    }

    const normalizedHours = estimatedHours
      .trim()
      .replace(',', '.')

    if (
      normalizedHours &&
      (!Number.isFinite(
        Number(normalizedHours)
      ) ||
        Number(normalizedHours) < 0)
    ) {
      setError(
        'Estimated time must be a valid positive number.'
      )
      return
    }

    try {
      setSaving(true)
      setError('')

      const today = getTodayDate()

      const normalizedStartDate =
        startDate ||
        (status === 'in-progress' || status === 'completed'
          ? today
          : null)

      const normalizedCompletedDate =
        completedDate ||
        (status === 'completed'
          ? today
          : null)

      const task = {
        title: title.trim(),
        description: description.trim(),
        projectId: projectId || null,
        parentTaskId: parentTaskId || null,
        estimatedMinutes: normalizedHours
          ? Math.round(
              Number(normalizedHours) * 60
            )
          : 0,
        status,
        priority,
        startDate: normalizedStartDate,
        completedDate: normalizedCompletedDate,
        dueDate: dueDate || null,
      }

      if (editingTask) {
        await updateTask(
          editingTask._id,
          task
        )
      } else {
        await createTask(task)
      }

      await loadData()
      resetForm()
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(task) {
    setTaskToDelete(task)
  }

  async function confirmDelete() {
    if (!taskToDelete) {
      return
    }

    try {
      setDeleting(true)
      setError('')

      if (
        activeTimer &&
        String(activeTimer.taskId) ===
          String(taskToDelete._id)
      ) {
        try {
          await cancelTimer()
        } catch (error) {
          console.error(
            'Failed to cancel active timer while deleting task:',
            error
          )
        }
      }

      await deleteTask(taskToDelete._id)

      setTasks((currentTasks) =>
        currentTasks.filter(
          (item) =>
            item._id !== taskToDelete._id
        )
      )

      setTimeEntries((currentEntries) =>
        currentEntries.filter(
          (entry) =>
            String(entry.taskId) !==
            String(taskToDelete._id)
        )
      )

      setTaskToDelete(null)
    } catch (error) {
      setError(error.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleStatusChange(
    task,
    newStatus
  ) {
    try {
      setError('')

      const today = getTodayDate()

      const updatedStartDate =
        task.startDate ||
        (newStatus === 'in-progress' ||
        newStatus === 'completed'
          ? today
          : null)

      const updatedCompletedDate =
        task.completedDate ||
        (newStatus === 'completed'
          ? today
          : null)

      const updatedTask = await updateTask(
        task._id,
        {
          title: task.title,
          description: task.description || '',
          projectId: task.projectId || null,
          parentTaskId:
            task.parentTaskId || null,
          estimatedMinutes:
            task.estimatedMinutes || 0,
          status: newStatus,
          priority: task.priority || 'medium',
          startDate: updatedStartDate,
          completedDate: updatedCompletedDate,
          dueDate: task.dueDate || null,
        }
      )

      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item._id === updatedTask._id
            ? updatedTask
            : item
        )
      )
    } catch (error) {
      setError(error.message)
    }
  }

  function getProjectName(projectId) {
    const project = projects.find(
      (item) =>
        String(item._id) ===
        String(projectId)
    )

    return project
      ? project.name
      : 'No project'
  }

  function getParentTaskName(parentTaskId) {
    const parentTask = tasks.find(
      (task) =>
        String(task._id) ===
        String(parentTaskId)
    )

    return parentTask
      ? parentTask.title
      : 'Unknown task'
  }

  function isDescendant(
    taskId,
    candidateParentId
  ) {
    let currentTask = tasks.find(
      (task) =>
        String(task._id) ===
        String(candidateParentId)
    )

    const visited = new Set()

    while (
      currentTask &&
      currentTask.parentTaskId
    ) {
      const parentId = String(
        currentTask.parentTaskId
      )

      if (
        parentId === String(taskId)
      ) {
        return true
      }

      if (visited.has(parentId)) {
        return false
      }

      visited.add(parentId)

      currentTask = tasks.find(
        (task) =>
          String(task._id) === parentId
      )
    }

    return false
  }

  function getAvailableParentTasks() {
    return tasks.filter((task) => {
      if (
        editingTask &&
        String(task._id) ===
          String(editingTask._id)
      ) {
        return false
      }

      if (
        editingTask &&
        isDescendant(
          editingTask._id,
          task._id
        )
      ) {
        return false
      }

      return true
    })
  }

  function getChildTasks(parentId) {
    return tasks.filter(
      (task) =>
        String(task.parentTaskId) ===
        String(parentId)
    )
  }

  function getTotalEstimatedMinutes(
    taskId,
    visited = new Set()
  ) {
    const task = tasks.find(
      (item) =>
        String(item._id) ===
        String(taskId)
    )

    if (
      !task ||
      visited.has(String(taskId))
    ) {
      return 0
    }

    const nextVisited = new Set(visited)
    nextVisited.add(String(taskId))

    const ownMinutes =
      Number(task.estimatedMinutes) || 0

    const childMinutes =
      getChildTasks(taskId).reduce(
        (total, childTask) =>
          total +
          getTotalEstimatedMinutes(
            childTask._id,
            nextVisited
          ),
        0
      )

    return ownMinutes + childMinutes
  }

  function getOwnTrackedMinutes(taskId) {
    const savedMinutes = timeEntries
      .filter(
        (entry) =>
          String(entry.taskId) ===
          String(taskId)
      )
      .reduce(
        (total, entry) =>
          total +
          (Number(entry.duration) || 0),
        0
      )

    const activeMinutes =
      activeTimer &&
      String(activeTimer.taskId) ===
        String(taskId)
        ? elapsedSeconds / 60
        : 0

    return savedMinutes + activeMinutes
  }

  function getTotalTrackedMinutes(
    taskId,
    visited = new Set()
  ) {
    if (visited.has(String(taskId))) {
      return 0
    }

    const nextVisited = new Set(visited)
    nextVisited.add(String(taskId))

    const ownMinutes =
      getOwnTrackedMinutes(taskId)

    const childMinutes =
      getChildTasks(taskId).reduce(
        (total, childTask) =>
          total +
          getTotalTrackedMinutes(
            childTask._id,
            nextVisited
          ),
        0
      )

    return ownMinutes + childMinutes
  }

  function formatDuration(minutes) {
    if (!minutes || minutes <= 0) {
      return '0 min'
    }

    const roundedMinutes =
      Math.floor(minutes)

    const hours = Math.floor(
      roundedMinutes / 60
    )

    const remainingMinutes =
      roundedMinutes % 60

    if (hours === 0) {
      return `${remainingMinutes} min`
    }

    if (remainingMinutes === 0) {
      return `${hours} h`
    }

    return `${hours} h ${remainingMinutes} min`
  }

  function formatTimerTime(seconds) {
    const hours = Math.floor(
      seconds / 3600
    )

    const minutes = Math.floor(
      (seconds % 3600) / 60
    )

    const remainingSeconds =
      seconds % 60

    return `${String(hours).padStart(
      2,
      '0'
    )}:${String(minutes).padStart(
      2,
      '0'
    )}:${String(remainingSeconds).padStart(
      2,
      '0'
    )}`
  }

  function isTaskBeingTracked(task) {
    return (
      activeTimer &&
      String(activeTimer.taskId) ===
        String(task._id)
    )
  }

  function handleStartTimer(task) {
    if (activeTimer) {
      return
    }

    startTimer({
      taskId: task._id,
      projectId: task.projectId || null,
      description: task.title || '',
    })
  }

  function renderTask(task) {
    const childTasks =
      getChildTasks(task._id)

    const totalEstimatedMinutes =
      getTotalEstimatedMinutes(task._id)

    const totalTrackedMinutes =
      getTotalTrackedMinutes(task._id)

    const isActive =
      isTaskBeingTracked(task)

    return (
      <article
        key={task._id}
        className={`task-item status-${task.status}`}
      >
        <div className="task-info">
          <div className="task-name-row">
            <h3>{task.title}</h3>

            <span
              className={`task-status ${task.status}`}
            >
              {task.status === 'todo' && 'Added'}
              {task.status === 'in-progress' && 'Started'}
              {task.status === 'completed' && 'Completed'}
            </span>

            <span
              className={`task-priority ${task.priority}`}
            >
              {task.priority}
            </span>

            {isActive && (
              <span className="task-timer-active">
                {activeTimer.status === 'paused'
                  ? 'Paused'
                  : 'Tracking'}{' '}
                {formatTimerTime(elapsedSeconds)}
              </span>
            )}
          </div>

          {task.description && (
            <p className="task-description">
              {task.description}
            </p>
          )}

          <div className="task-meta">
            <span>
              Project: {getProjectName(task.projectId)}
            </span>

            {task.parentTaskId && (
              <span>
                Parent: {getParentTaskName(task.parentTaskId)}
              </span>
            )}

            {childTasks.length > 0 && (
              <span>
                {childTasks.length}{' '}
                {childTasks.length === 1
                  ? 'subtask'
                  : 'subtasks'}
              </span>
            )}

            {totalEstimatedMinutes > 0 && (
              <span>
                Estimated: {formatDuration(totalEstimatedMinutes)}
              </span>
            )}

            {totalTrackedMinutes > 0 && (
              <span>
                Tracked: {formatDuration(totalTrackedMinutes)}
              </span>
            )}

            {task.startDate && (
              <span>
                Started:{' '}
                {new Date(task.startDate).toLocaleDateString('fi-FI')}
              </span>
            )}

            {task.completedDate && (
              <span>
                Completed:{' '}
                {new Date(task.completedDate).toLocaleDateString('fi-FI')}
              </span>
            )}

            {task.dueDate && (
              <span>
                Due:{' '}
                {new Date(task.dueDate).toLocaleDateString('fi-FI')}
              </span>
            )}
          </div>
        </div>

        <div className="task-actions">
          <select
            value={task.status}
            onChange={(event) =>
              handleStatusChange(task, event.target.value)
            }
            aria-label={`Change status for ${task.title}`}
          >
            <option value="todo">Added</option>
            <option value="in-progress">Started</option>
            <option value="completed">Completed</option>
          </select>

          {!activeTimer && (
            <button
              type="button"
              onClick={() => handleStartTimer(task)}
            >
              Start
            </button>
          )}

          {isActive &&
            activeTimer.status === 'running' && (
              <button
                type="button"
                onClick={pauseTimer}
                disabled={timerSaving}
              >
                Pause
              </button>
            )}

          {isActive &&
            activeTimer.status === 'paused' && (
              <button
                type="button"
                onClick={resumeTimer}
                disabled={timerSaving}
              >
                Resume
              </button>
            )}

          {isActive && (
            <button
              type="button"
              onClick={stopTimer}
              disabled={timerSaving}
            >
              {timerSaving ? 'Saving...' : 'Stop'}
            </button>
          )}

          <button
            type="button"
            onClick={() => startEdit(task)}
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => handleDelete(task)}
          >
            Delete
          </button>
        </div>
      </article>
    )
  }

  if (loading) {
    return (
      <main className="tasks-page">
        <div className="tasks-loading">
          Loading tasks...
        </div>
      </main>
    )
  }



  return (
    <main className="tasks-page">
      <div className="tasks-intro">
        <div>
          <span className="tasks-kicker">
            Task management
          </span>

          <h2>Tasks</h2>

          <p>
            Manage your work and track task progress.
          </p>
        </div>

        <button
          className="tasks-create-button"
          type="button"
          onClick={startCreate}
        >
          + New task
        </button>
      </div>

      {error && (
        <div className="tasks-error">
          {error}
        </div>
      )}

      {timerError && (
        <div className="tasks-error">
          {timerError}
        </div>
      )}

      {showForm && (
        <section className="task-form-panel">
          <div className="task-form-header">
            <h3>
              {editingTask
                ? 'Edit task'
                : 'New task'}
            </h3>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="task-form-grid">
              <label className="task-form-full">
                <span>Title</span>

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value
                    )
                  }
                  placeholder="Task title"
                  maxLength={200}
                  required
                />
              </label>

              <label>
                <span>Project</span>

                <select
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(
                      event.target.value
                    )
                  }}
                >
                  <option value="">
                    No project
                  </option>

                  {projects.map(
                    (project) => (
                      <option
                        key={project._id}
                        value={
                          project._id
                        }
                      >
                        {project.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>Parent task</span>

                <select
                  value={parentTaskId}
                  onChange={(event) =>
                    setParentTaskId(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    No parent task
                  </option>

                  {getAvailableParentTasks().map(
                    (task) => (
                      <option
                        key={task._id}
                        value={task._id}
                      >
                        {task.title}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  Estimated time (hours)
                </span>

                <input
                  className="task-estimated-input"
                  type="text"
                  inputMode="decimal"
                  value={estimatedHours}
                  onChange={(event) =>
                    setEstimatedHours(
                      event.target.value
                    )
                  }
                  placeholder="e.g. 1.5"
                />
              </label>

              <label>
                <span>Status</span>

                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value
                    )
                  }
                >
                  <option value="todo">
                    Added
                  </option>

                  <option value="in-progress">
                    Started
                  </option>

                  <option value="completed">
                    Completed
                  </option>
                </select>
              </label>

              <label>
                <span>Priority</span>

                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target.value
                    )
                  }
                >
                  <option value="low">
                    Low
                  </option>

                  <option value="medium">
                    Medium
                  </option>

                  <option value="high">
                    High
                  </option>
                </select>
              </label>

              <label>
                <span>Start date</span>

                <input
                  className="task-date-input"
                  type="date"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>Completed date</span>

                <input
                  className="task-date-input"
                  type="date"
                  value={completedDate}
                  onChange={(event) =>
                    setCompletedDate(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                <span>Due date</span>

                <input
                  className="task-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="task-form-full">
                <span>Description</span>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  placeholder="Task description"
                  maxLength={2000}
                />
              </label>
            </div>

            <div className="task-form-actions">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="task-save-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingTask
                    ? 'Save changes'
                    : 'Create task'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="tasks-list">
        <div className="tasks-list-header">
          <span>
            {tasks.length}{' '}
            {tasks.length === 1
              ? 'TASK'
              : 'TASKS'}
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="tasks-empty">
            <h3>No tasks yet</h3>

            <p>
              Create your first task to start tracking your work.
            </p>
          </div>
        ) : (
          <div className="task-board">
            {[
              {
                status: 'todo',
                title: 'Not started',
              },
              {
                status: 'in-progress',
                title: 'In progress',
              },
              {
                status: 'completed',
                title: 'Completed',
              },
            ].map((column) => {
              const columnTasks = tasks.filter(
                (task) => task.status === column.status
              )

              return (
                <section
                  key={column.status}
                  className="task-column"
                >
                  <div className="task-column-header">
                    <div>
                      <h3>{column.title}</h3>
                    </div>

                    <span className="task-column-count">
                      {columnTasks.length}
                    </span>
                  </div>

                  <div className="task-column-list">
                    {columnTasks.length === 0 ? (
                      <div className="task-column-empty">
                        No tasks
                      </div>
                    ) : (
                      columnTasks.map((task) =>
                        renderTask(task)
                      )
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </section>

      {taskToDelete && (
        <div
          className="delete-dialog-overlay"
          onClick={() => {
            if (!deleting) {
              setTaskToDelete(null)
            }
          }}
        >
          <div
            className="delete-dialog"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <span className="delete-dialog-kicker">
              CONFIRM ACTION
            </span>

            <h3>
              Delete task?
            </h3>

            <p>
              Are you sure you want to delete{' '}
              <strong>
                {taskToDelete.title}
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="delete-dialog-actions">
              <button
                type="button"
                onClick={() =>
                  setTaskToDelete(null)
                }
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                className="delete-dialog-confirm"
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting
                  ? 'Deleting...'
                  : 'Delete task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Task