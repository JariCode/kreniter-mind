import { useEffect, useState } from 'react'
import { getProjects } from '../../api/projects'
import { getTasks } from '../../api/tasks'
import { getTimeEntries } from '../../api/timeEntries'
import { getDashboardLayout, saveDashboardLayout } from '../../api/dashboardLayoutApi'
import DashboardGrid from '../DashboardWidgets/DashboardGrid'
import WidgetLibrary from '../DashboardWidgets/WidgetLibrary'
import Project from '../../pages/Projects/Project'
import './MainContent.css'

function MainContent({ activeView }) {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [timeEntries, setTimeEntries] = useState([])

  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [timeEntriesLoading, setTimeEntriesLoading] = useState(true)

  const [error, setError] = useState('')
  const [tasksError, setTasksError] = useState('')
  const [timeEntriesError, setTimeEntriesError] = useState('')

  const [widgets, setWidgets] = useState([
    {
      type: 'projects',
    },
    {
      type: 'tasks',
    },
    {
      type: 'tracked-time',
    },
    {
      type: 'recent-projects',
    },
    {
      type: 'ai-assistant',
    },
  ])

  const [layoutLoaded, setLayoutLoaded] = useState(false)

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects()
        setProjects(data)
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    async function loadTasks() {
      try {
        const data = await getTasks()
        setTasks(data)
      } catch (error) {
        setTasksError(error.message)
      } finally {
        setTasksLoading(false)
      }
    }

    async function loadTimeEntries() {
      try {
        const data = await getTimeEntries()
        setTimeEntries(data)
      } catch (error) {
        setTimeEntriesError(error.message)
      } finally {
        setTimeEntriesLoading(false)
      }
    }

    loadProjects()
    loadTasks()
    loadTimeEntries()
  }, [])

  useEffect(() => {
    if (activeView !== 'dashboard') {
      return
    }

    async function refreshProjects() {
      try {
        const data = await getProjects()
        setProjects(data)
        setError('')
      } catch (error) {
        setError(error.message)
      }
    }

    refreshProjects()
  }, [activeView])

  useEffect(() => {
    async function loadDashboardLayout() {
      try {
        const data = await getDashboardLayout()

        if (Array.isArray(data.widgets)) {
          setWidgets(
            data.widgets.map((type) => ({
              type,
            }))
          )
        }
      } catch (error) {
        console.error('Failed to load dashboard layout:', error)
      } finally {
        setLayoutLoaded(true)
      }
    }

    loadDashboardLayout()
  }, [])

  useEffect(() => {
    if (!layoutLoaded) {
      return
    }

    const widgetTypes = widgets.map((widget) => widget.type)

    saveDashboardLayout(widgetTypes).catch((error) => {
      console.error('Failed to save dashboard layout:', error)
    })
  }, [widgets, layoutLoaded])

  if (activeView === 'projects') {
    return <Project />
  }

  const openTasks = tasks.filter(
    (task) => task.status !== 'completed'
  ).length

  const startOfWeek = new Date()
  const day = startOfWeek.getDay()
  const difference = day === 0 ? -6 : 1 - day

  startOfWeek.setDate(startOfWeek.getDate() + difference)
  startOfWeek.setHours(0, 0, 0, 0)

  const trackedMinutes = timeEntries
    .filter((entry) => new Date(entry.startedAt) >= startOfWeek)
    .reduce((total, entry) => total + entry.duration, 0)

  const trackedHours = Math.floor(trackedMinutes / 60)
  const remainingMinutes = trackedMinutes % 60

  const trackedTime = `${String(trackedHours).padStart(2, '0')}:${String(
    remainingMinutes
  ).padStart(2, '0')}`

  const widgetDefinitions = [
    {
      type: 'projects',
      title: 'Projects',
      kicker: 'WORKSPACE',
      width: 4,
    },
    {
      type: 'tasks',
      title: 'Tasks',
      kicker: 'WORKSPACE',
      width: 4,
    },
    {
      type: 'tracked-time',
      title: 'Tracked time',
      kicker: 'TIME',
      width: 4,
    },
    {
      type: 'recent-projects',
      title: 'Recent projects',
      kicker: 'WORKSPACE',
      width: 8,
    },
    {
      type: 'ai-assistant',
      title: 'AI Assistant',
      kicker: 'INTELLIGENCE',
      width: 4,
    },
  ]

  function removeWidget(widgetType) {
    setWidgets((currentWidgets) =>
      currentWidgets.filter((widget) => widget.type !== widgetType)
    )
  }

  function addWidget(widgetType) {
    setWidgets((currentWidgets) => {
      if (currentWidgets.some((widget) => widget.type === widgetType)) {
        return currentWidgets
      }

      const definition = widgetDefinitions.find(
        (widget) => widget.type === widgetType
      )

      if (!definition) {
        return currentWidgets
      }

      return [
        ...currentWidgets,
        {
          type: definition.type,
        },
      ]
    })
  }

  function moveWidget(draggedWidgetType, targetWidgetType) {
    setWidgets((currentWidgets) => {
      const newWidgets = [...currentWidgets]

      const draggedIndex = newWidgets.findIndex(
        (widget) => widget.type === draggedWidgetType
      )

      const targetIndex = newWidgets.findIndex(
        (widget) => widget.type === targetWidgetType
      )

      if (draggedIndex === -1 || targetIndex === -1) {
        return currentWidgets
      }

      const [draggedWidget] = newWidgets.splice(draggedIndex, 1)

      newWidgets.splice(targetIndex, 0, draggedWidget)

      return newWidgets
    })
  }

  const availableWidgets = widgetDefinitions.filter(
    (widget) =>
      !widgets.some((currentWidget) => currentWidget.type === widget.type)
  )

  const dashboardWidgets = widgets
    .map((widget) => {
      const definition = widgetDefinitions.find(
        (item) => item.type === widget.type
      )

      if (!definition) {
        return null
      }

      let content = null

      if (widget.type === 'projects') {
        content = (
          <section className="dashboard-stats">
            <article className="dashboard-card">
              <div className="card-top">
                <span>Projects</span>
                <span className="card-index">01</span>
              </div>

              <strong>{projects.length}</strong>

              <p>
                Active workspaces
              </p>
            </article>
          </section>
        )
      }

      if (widget.type === 'tasks') {
        content = (
          <section className="dashboard-stats">
            <article className="dashboard-card">
              <div className="card-top">
                <span>Tasks</span>
                <span className="card-index">02</span>
              </div>

              <strong>
                {tasksLoading ? '...' : openTasks}
              </strong>

              <p>
                Open tasks
              </p>
            </article>
          </section>
        )
      }

      if (widget.type === 'tracked-time') {
        content = (
          <section className="dashboard-stats">
            <article className="dashboard-card">
              <div className="card-top">
                <span>Tracked time</span>
                <span className="card-index">03</span>
              </div>

              <strong>
                {timeEntriesLoading ? '...' : trackedTime}
              </strong>

              <p>
                This week
              </p>
            </article>
          </section>
        )
      }

      if (widget.type === 'recent-projects') {
        content = (
          <section className="dashboard-grid">
            <article className="dashboard-panel projects-panel">
              <div className="panel-header">
                <div>
                  <span className="panel-kicker">
                    WORKSPACE
                  </span>

                  <h3>
                    Recent projects
                  </h3>
                </div>

                <button>
                  View all
                </button>
              </div>

              <div className="project-list">
                {loading && (
                  <p>
                    Loading projects...
                  </p>
                )}

                {error && (
                  <p>
                    {error}
                  </p>
                )}

                {!loading && !error && projects.map((project) => (
                  <div
                    className="project-item"
                    key={project._id}
                  >
                    <div className="project-marker">
                      <span />
                    </div>

                    <div className="project-info">
                      <strong>
                        {project.name}
                      </strong>

                      <p>
                        {project.description}
                      </p>
                    </div>

                    <span className="project-status">
                      {project.status}
                    </span>
                  </div>
                ))}

                {!loading && !error && projects.length === 0 && (
                  <p>
                    No projects yet.
                  </p>
                )}
              </div>
            </article>
          </section>
        )
      }

      if (widget.type === 'ai-assistant') {
        content = (
          <section className="dashboard-grid">
            <article className="dashboard-panel ai-panel">
              <div className="panel-header">
                <div>
                  <span className="panel-kicker">
                    INTELLIGENCE
                  </span>

                  <h3>
                    AI Assistant
                  </h3>
                </div>

                <button>
                  Open
                </button>
              </div>

              <div className="ai-preview">
                <div className="ai-entity">
                  <div className="ai-entity-line ai-entity-line-one" />
                  <div className="ai-entity-line ai-entity-line-two" />

                  <div className="ai-entity-core">
                    K
                  </div>
                </div>

                <p className="ai-message">
                  What are you working on today?
                </p>

                <button className="ai-action">
                  Ask AI
                </button>
              </div>
            </article>
          </section>
        )
      }

      return {
        id: definition.type,
        title: definition.title,
        kicker: definition.kicker,
        width: definition.width,
        content,
      }
    })
    .filter(Boolean)

  return (
    <main className="main-content">
      <section className="dashboard-intro">
        <div>
          <span className="dashboard-kicker">
            WORKSPACE
          </span>

          <h2>
            Good evening.
          </h2>

          <p>
            Your workspace at a glance.
          </p>
        </div>

        <div className="dashboard-status">
          <span className="status-indicator" />
          System ready
        </div>
      </section>

      <DashboardGrid
        widgets={dashboardWidgets}
        onRemoveWidget={removeWidget}
        onMoveWidget={moveWidget}
      />

      <WidgetLibrary
        availableWidgets={availableWidgets}
        onAddWidget={addWidget}
      />

      <section className="dashboard-bottom">
        <div className="dashboard-bottom-label">
          <span />
          KRENITER MIND
        </div>

        <p>
          One workspace for projects, tasks, ideas and intelligence.
        </p>
      </section>
    </main>
  )
}

export default MainContent