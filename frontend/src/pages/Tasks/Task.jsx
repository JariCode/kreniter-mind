import { useEffect, useState } from 'react'
import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
} from '../../api/tasks'
import { getProjects } from '../../api/projects'
import './Task.css'

function Task() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [taskToDelete, setTaskToDelete] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState('todo')
  const [priority, setPriority] = useState('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function loadData() {
    try {
      setError('')

      const [tasksData, projectsData] = await Promise.all([
        getTasks(),
        getProjects(),
      ])

      setTasks(tasksData)
      setProjects(projectsData)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function resetForm() {
    setTitle('')
    setDescription('')
    setProjectId('')
    setStatus('todo')
    setPriority('medium')
    setDueDate('')
    setEditingTask(null)
    setShowForm(false)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(task) {
    setTitle(task.title || '')
    setDescription(task.description || '')
    setProjectId(task.projectId || '')
    setStatus(task.status || 'todo')
    setPriority(task.priority || 'medium')
    setDueDate(
      task.dueDate
        ? new Date(task.dueDate).toISOString().split('T')[0]
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

    try {
      setSaving(true)
      setError('')

      const task = {
        title: title.trim(),
        description: description.trim(),
        projectId: projectId || null,
        status,
        priority,
        dueDate: dueDate || null,
      }

      if (editingTask) {
        await updateTask(editingTask._id, task)
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
      await deleteTask(taskToDelete._id)

      setTasks((currentTasks) =>
        currentTasks.filter(
          (item) => item._id !== taskToDelete._id
        )
      )

      setTaskToDelete(null)
    } catch (error) {
      setError(error.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleStatusChange(task, newStatus) {
    try {
      setError('')

      const updatedTask = await updateTask(task._id, {
        title: task.title,
        description: task.description || '',
        projectId: task.projectId || null,
        status: newStatus,
        priority: task.priority || 'medium',
        dueDate: task.dueDate || null,
      })

      setTasks((currentTasks) =>
        currentTasks.map((item) =>
          item._id === updatedTask._id ? updatedTask : item
        )
      )
    } catch (error) {
      setError(error.message)
    }
  }

  function getProjectName(projectId) {
    const project = projects.find(
      (item) => item._id === projectId
    )

    return project ? project.name : 'No project'
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

      {showForm && (
        <section className="task-form-panel">
          <div className="task-form-header">
            <h3>
              {editingTask ? 'Edit task' : 'New task'}
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
                    setTitle(event.target.value)
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
                  onChange={(event) =>
                    setProjectId(event.target.value)
                  }
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option
                      key={project._id}
                      value={project._id}
                    >
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Status</span>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value)
                  }
                >
                  <option value="todo">Added</option>
                  <option value="in-progress">Started</option>
                  <option value="completed">Completed</option>
                </select>
              </label>

              <label>
                <span>Priority</span>
                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value)
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label>
                <span>Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                />
              </label>

              <label className="task-form-full">
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
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
            {tasks.length} {tasks.length === 1 ? 'TASK' : 'TASKS'}
          </span>
        </div>

        <div className="task-list">
          {tasks.length === 0 ? (
            <div className="tasks-empty">
              <h3>No tasks yet</h3>
              <p>
                Create your first task to start tracking your work.
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <article
                className={`task-item status-${task.status}`}
                key={task._id}
              >
                <div className="task-status-indicator" />

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

                    {task.dueDate && (
                      <span>
                        Due:{' '}
                        {new Date(
                          task.dueDate
                        ).toLocaleDateString('fi-FI')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="task-actions">
                  <select
                    value={task.status}
                    onChange={(event) =>
                      handleStatusChange(
                        task,
                        event.target.value
                      )
                    }
                    aria-label={`Change status for ${task.title}`}
                  >
                    <option value="todo">Added</option>
                    <option value="in-progress">Started</option>
                    <option value="completed">
                      Completed
                    </option>
                  </select>

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
            ))
          )}
        </div>
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
            onClick={(event) => event.stopPropagation()}
          >
            <span className="delete-dialog-kicker">
              CONFIRM ACTION
            </span>

            <h3>
              Delete task?
            </h3>

            <p>
              Are you sure you want to delete{' '}
              <strong>{taskToDelete.title}</strong>?
              This action cannot be undone.
            </p>

            <div className="delete-dialog-actions">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
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
                {deleting ? 'Deleting...' : 'Delete task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Task