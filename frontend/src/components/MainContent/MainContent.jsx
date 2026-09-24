import { useEffect, useState } from 'react'
import { getProjects } from '../../api/projects'
import { getTasks } from '../../api/tasks'
import { getTimeEntries } from '../../api/timeEntries'
import {
  getDashboardLayout,
  saveDashboardLayout,
} from '../../api/dashboardLayoutApi'
import DashboardGrid from '../DashboardWidgets/DashboardGrid'
import WidgetLibrary from '../DashboardWidgets/WidgetLibrary'
import Project from '../../pages/Projects/Project'
import Task from '../../pages/Tasks/Task'
import { useTimeTracker } from '../TimeTracker/TimeTracker'
import './MainContent.css'
import '../TimeTracker/TimeTracker.css'

function MainContent({
  activeView,
  onViewChange,
}) {
  const {
    activeTimer,
    elapsedSeconds,
    elapsedMinutes,
    pauseTimer,
    resumeTimer,
    stopTimer,
    isSaving,
    error: timerError,
    timeEntriesVersion,
  } = useTimeTracker()

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

    async function refreshDashboardData() {
      try {
        const [
          projectsData,
          tasksData,
          timeEntriesData,
        ] = await Promise.all([
          getProjects(),
          getTasks(),
          getTimeEntries(),
        ])

        setProjects(projectsData)
        setTasks(tasksData)
        setTimeEntries(timeEntriesData)
        setError('')
        setTasksError('')
        setTimeEntriesError('')
      } catch (error) {
        console.error(
          'Failed to refresh dashboard data:',
          error
        )
      }
    }

    refreshDashboardData()
  }, [activeView])

  useEffect(() => {
    if (timeEntriesVersion === 0) {
      return
    }

    async function refreshTimeEntries() {
      try {
        const data = await getTimeEntries()

        setTimeEntries(data)
        setTimeEntriesError('')
      } catch (error) {
        console.error(
          'Failed to refresh time entries:',
          error
        )

        setTimeEntriesError(error.message)
      }
    }

    refreshTimeEntries()
  }, [timeEntriesVersion])

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
        console.error(
          'Failed to load dashboard layout:',
          error
        )
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

    const widgetTypes = widgets.map(
      (widget) => widget.type
    )

    saveDashboardLayout(widgetTypes).catch(
      (error) => {
        console.error(
          'Failed to save dashboard layout:',
          error
        )
      }
    )
  }, [widgets, layoutLoaded])

  if (activeView === 'projects') {
    return <Project />
  }

  if (activeView === 'tasks') {
    return <Task />
  }

  const openTasks = tasks.filter(
    (task) => task.status !== 'completed'
  ).length

  const savedTrackedMinutes = timeEntries.reduce(
    (total, entry) =>
      total + (Number(entry.duration) || 0),
    0
  )

  const trackedMinutes =
    savedTrackedMinutes +
    (activeTimer ? elapsedMinutes : 0)

  const trackedHours = Math.floor(
    trackedMinutes / 60
  )

  const trackedRemainingMinutes = Math.floor(
    trackedMinutes % 60
  )

  const trackedTime = `${String(
    trackedHours
  ).padStart(2, '0')}:${String(
    trackedRemainingMinutes
  ).padStart(2, '0')}`

  function formatTimerTime(seconds) {
    const hours = Math.floor(seconds / 3600)

    const minutes = Math.floor(
      (seconds % 3600) / 60
    )

    const remainingSeconds = seconds % 60

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

  function getActiveTask() {
    if (!activeTimer?.taskId) {
      return null
    }

    return tasks.find(
      (task) =>
        String(task._id) ===
        String(activeTimer.taskId)
    )
  }

  function getActiveProject() {
    if (!activeTimer?.projectId) {
      return null
    }

    return projects.find(
      (project) =>
        String(project._id) ===
        String(activeTimer.projectId)
    )
  }

  const activeTask = getActiveTask()
  const activeProject = getActiveProject()

  function formatProjectTime(minutes) {
    if (!minutes || minutes <= 0) {
      return '0 h'
    }

    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours === 0) {
      return `${remainingMinutes} min`
    }

    if (remainingMinutes === 0) {
      return `${hours} h`
    }

    return `${hours} h ${remainingMinutes} min`
  }

  function getProjectTotalMinutes(projectId) {
    return tasks
      .filter(
        (task) =>
          String(task.projectId) ===
          String(projectId)
      )
      .reduce(
        (total, task) =>
          total +
          (Number(task.estimatedMinutes) || 0),
        0
      )
  }

  const totalProjectMinutes = projects.reduce(
    (total, project) =>
      total +
      getProjectTotalMinutes(project._id),
    0
  )

  const totalProjectTime = formatProjectTime(
    totalProjectMinutes
  )

  const recentProjects = [...projects]
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()

      return dateB - dateA
    })
    .slice(0, 2)

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
      currentWidgets.filter(
        (widget) => widget.type !== widgetType
      )
    )
  }

  function addWidget(widgetType) {
    setWidgets((currentWidgets) => {
      if (
        currentWidgets.some(
          (widget) => widget.type === widgetType
        )
      ) {
        return currentWidgets
      }

      const definition =
        widgetDefinitions.find(
          (widget) =>
            widget.type === widgetType
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

  function moveWidget(
    draggedWidgetType,
    targetWidgetType
  ) {
    setWidgets((currentWidgets) => {
      const newWidgets = [...currentWidgets]

      const draggedIndex =
        newWidgets.findIndex(
          (widget) =>
            widget.type === draggedWidgetType
        )

      const targetIndex =
        newWidgets.findIndex(
          (widget) =>
            widget.type === targetWidgetType
        )

      if (
        draggedIndex === -1 ||
        targetIndex === -1
      ) {
        return currentWidgets
      }

      const [draggedWidget] =
        newWidgets.splice(draggedIndex, 1)

      newWidgets.splice(
        targetIndex,
        0,
        draggedWidget
      )

      return newWidgets
    })
  }

  const availableWidgets =
    widgetDefinitions.filter(
      (widget) =>
        !widgets.some(
          (currentWidget) =>
            currentWidget.type === widget.type
        )
    )

  const dashboardWidgets = widgets
    .map((widget) => {
      const definition =
        widgetDefinitions.find(
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
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  gap: '24px',
                }}
              >
                <div>
                  <strong>
                    {projects.length}
                  </strong>

                  <p>
                    Active workspaces
                  </p>
                </div>

                <div
                  style={{
                    textAlign: 'right',
                  }}
                >
                  <strong>
                    {loading || tasksLoading
                      ? '...'
                      : totalProjectTime}
                  </strong>

                  <p>
                    Project hours
                  </p>
                </div>
              </div>
            </article>
          </section>
        )
      }

      if (widget.type === 'tasks') {
        content = (
          <section className="dashboard-stats">
            <article className="dashboard-card tasks-card">
              <div className="card-top">
                <span>Tasks</span>

                {activeTimer && (
                  <span className="time-tracker-status">
                    Tracking
                  </span>
                )}
              </div>

              <div className="dashboard-task-summary">
                <div className="dashboard-task-count">
                  <strong>
                    {tasksLoading
                      ? '...'
                      : openTasks}
                  </strong>

                  <p>
                    Open tasks
                  </p>
                </div>

                {activeTimer && (
                  <div className="time-tracker-active-task">
                    <span>
                      ● Tracking
                    </span>

                    <strong>
                      {activeTask?.title ||
                        activeTask?.name ||
                        'Untitled task'}
                    </strong>
                  </div>
                )}
              </div>
            </article>
          </section>
        )
      }

      if (widget.type === 'tracked-time') {
        content = (
          <section className="dashboard-stats">
            <article className="dashboard-card tracked-time-card">
              <div className="card-top">
                <span>Tracked time</span>

                {activeTimer && (
                  <span className="time-tracker-status">
                    {activeTimer.status ===
                    'paused'
                      ? 'Paused'
                      : 'Running'}
                  </span>
                )}
              </div>

              <div className="tracked-time-layout">
                <div className="tracked-time-main">
                  <strong className="time-tracker-time">
                    {timeEntriesLoading
                      ? '...'
                      : activeTimer
                        ? formatTimerTime(
                            elapsedSeconds
                          )
                        : trackedTime}
                  </strong>

                  {!activeTimer && (
                    <p>
                      Total tracked
                    </p>
                  )}
                </div>

                {activeTimer && (
                  <div className="tracked-time-side">
                    <div className="time-tracker-details">
                      <strong>
                        {activeTask?.title ||
                          activeTask?.name ||
                          'No task selected'}
                      </strong>

                      {activeProject && (
                        <span>
                          {activeProject.name}
                        </span>
                      )}
                    </div>

                    <div className="time-tracker-controls">
                      {activeTimer.status ===
                      'running' ? (
                        <button
                          type="button"
                          className="time-tracker-button time-tracker-button-pause"
                          onClick={pauseTimer}
                          disabled={isSaving}
                        >
                          Pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="time-tracker-button time-tracker-button-resume"
                          onClick={resumeTimer}
                          disabled={isSaving}
                        >
                          Resume
                        </button>
                      )}

                      <button
                        type="button"
                        className="time-tracker-button time-tracker-button-stop"
                        onClick={stopTimer}
                        disabled={isSaving}
                      >
                        {isSaving
                          ? 'Saving...'
                          : 'Stop'}
                      </button>
                    </div>

                    {timerError && (
                      <p className="time-tracker-error">
                        {timerError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {timeEntriesError && (
                <p className="time-tracker-error">
                  {timeEntriesError}
                </p>
              )}
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

                <button
                  type="button"
                  onClick={() =>
                    onViewChange('projects')
                  }
                >
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

                {!loading &&
                  !error &&
                  recentProjects.map((project) => (
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

                      <span className="project-time">
                        {formatProjectTime(
                          getProjectTotalMinutes(
                            project._id
                          )
                        )}
                      </span>

                      <span className="project-status">
                        {project.status}
                      </span>
                    </div>
                  ))}

                {!loading &&
                  !error &&
                  projects.length === 0 && (
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