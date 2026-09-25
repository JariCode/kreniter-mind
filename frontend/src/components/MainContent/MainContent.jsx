import { useEffect, useState } from 'react'
import { getProjects } from '../../api/projects'
import { getTasks } from '../../api/tasks'
import { getTimeEntries } from '../../api/timeEntries'
import { getNotes } from '../../api/notes'
import { getTimeline } from '../../api/timeline'
import { getTimeView } from '../../api/timeView'
import {
  getDashboardLayout,
  saveDashboardLayout,
} from '../../api/dashboardLayoutApi'
import DashboardGrid from '../DashboardWidgets/DashboardGrid'
import WidgetLibrary from '../DashboardWidgets/WidgetLibrary'
import Project from '../../pages/Projects/Project'
import Task from '../../pages/Tasks/Task'
import Note from '../../pages/Notes/Note'
import Timeline from '../../pages/Timeline/Timeline'
import Time from '../../pages/Time/Time'
import Assistant from '../../pages/AI/Assistant'
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
  const [notes, setNotes] = useState([])
  const [timelineProjectId, setTimelineProjectId] = useState('')
  const [timeProjectId, setTimeProjectId] = useState('')

  const [loading, setLoading] = useState(true)
  const [tasksLoading, setTasksLoading] = useState(true)
  const [timeEntriesLoading, setTimeEntriesLoading] = useState(true)
  const [notesLoading, setNotesLoading] = useState(true)

  const [error, setError] = useState('')
  const [tasksError, setTasksError] = useState('')
  const [timeEntriesError, setTimeEntriesError] = useState('')
  const [notesError, setNotesError] = useState('')

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
      type: 'notes',
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

    async function loadNotes() {
      try {
        const data = await getNotes()
        setNotes(data)
      } catch (error) {
        setNotesError(error.message)
      } finally {
        setNotesLoading(false)
      }
    }

    loadProjects()
    loadTasks()
    loadTimeEntries()
    loadNotes()
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
          notesData,
        ] = await Promise.all([
          getProjects(),
          getTasks(),
          getTimeEntries(),
          getNotes(),
        ])

        setProjects(projectsData)
        setTasks(tasksData)
        setTimeEntries(timeEntriesData)
        setNotes(notesData)
        setError('')
        setTasksError('')
        setTimeEntriesError('')
        setNotesError('')
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
    if (activeView !== 'dashboard') {
      return
    }

    async function loadTimelineSelection() {
      try {
        const data = await getTimeline()

        setTimelineProjectId(
          data?.selectedProjectId
            ? String(data.selectedProjectId)
            : ''
        )
      } catch (error) {
        console.error(
          'Failed to load timeline selection:',
          error
        )
      }
    }

    loadTimelineSelection()
  }, [activeView])

  useEffect(() => {
    if (activeView !== 'dashboard') {
      return
    }

    async function loadTimeSelection() {
      try {
        const data = await getTimeView()

        setTimeProjectId(
          data?.selectedProjectId
            ? String(data.selectedProjectId)
            : ''
        )
      } catch (error) {
        console.error(
          'Failed to load time selection:',
          error
        )
      }
    }

    loadTimeSelection()
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
          const widgetTypes = [...data.widgets]

          if (!widgetTypes.includes('notes')) {
            const aiIndex = widgetTypes.indexOf('ai-assistant')

            if (aiIndex === -1) {
              widgetTypes.push('notes')
            } else {
              widgetTypes.splice(aiIndex, 0, 'notes')
            }
          }

          setWidgets(
            widgetTypes.map((type) => ({
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

  if (activeView === 'notes') {
    return <Note />
  }

  if (activeView === 'timeline') {
    return <Timeline />
  }

  if (activeView === 'time') {
    return <Time />
  }

  if (activeView === 'ai-assistant') {
    return <Assistant />
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
    const estimatedMinutes = tasks
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

    const trackedMinutes = timeEntries
      .filter(
        (entry) =>
          String(
            typeof entry.projectId === 'object'
              ? entry.projectId?._id
              : entry.projectId
          ) === String(projectId)
      )
      .reduce(
        (total, entry) =>
          total +
          (Number(entry.duration) || 0),
        0
      )

    return estimatedMinutes + trackedMinutes
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

  const recentNotes = [...notes]
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()

      return dateB - dateA
    })
    .slice(0, 3)

  const activeTasks = tasks
    .filter((task) => task.status !== 'completed')
    .slice(0, 2)

  const activeProjects = projects
    .filter(
      (project) =>
        String(project.status || '').toLowerCase() ===
        'active'
    )
    .slice(0, 2)

  const widgetDefinitions = [
    {
      type: 'projects',
      title: 'Projects',
      kicker: 'Projects',
      width: 4,
    },
    {
      type: 'tasks',
      title: 'Tasks',
      kicker: 'Tasks',
      width: 4,
    },
    {
      type: 'tracked-time',
      title: 'Tracked time',
      kicker: 'Tracked time',
      width: 4,
    },
    {
      type: 'recent-projects',
      title: 'Recent projects',
      kicker: 'Recent projects',
      width: 4,
    },
    {
      type: 'timeline',
      title: 'Timeline',
      kicker: 'Timeline',
      width: 4,
    },
    {
      type: 'time',
      title: 'Time',
      kicker: 'Time',
      width: 4,
    },
    {
      type: 'notes',
      title: 'Notes',
      kicker: 'Notes',
      width: 4,
    },
    {
      type: 'ai-assistant',
      title: 'AI Assistant',
      kicker: 'AI Assistant',
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
              <div className="panel-header">
                <button
                  type="button"
                  onClick={() =>
                    onViewChange('projects')
                  }
                >
                  View all
                </button>
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
                    {loading
                      ? '...'
                      : projects.filter(
                          (project) =>
                            String(
                              project.status || ''
                            ).toLowerCase() ===
                            'active'
                        ).length}
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

              <div className="project-list">
                {!loading &&
                  !error &&
                  activeProjects.map((project) => (
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
                      </div>

                      <span className="project-status">
                        {project.status}
                      </span>
                    </div>
                  ))}
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
          {activeTimer && (
            <span className="time-tracker-status">
              Tracking
            </span>
          )}
        </div>

        <div className="panel-header">
          <button
            type="button"
            onClick={() =>
              onViewChange('tasks')
            }
          >
            View all
          </button>
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
              <span className="tracking-status">
                <span className="tracking-status-dot" />
                Tracking
              </span>

              <strong>
                {activeTask?.title ||
                  activeTask?.name ||
                  'Untitled task'}
              </strong>
            </div>
          )}
        </div>

        <div className="project-list">
          {!tasksLoading &&
            !tasksError &&
            activeTasks.map((task) => (
              <div
                className="project-item"
                key={task._id}
              >
                <div className="project-marker">
                  <span />
                </div>

                <div className="project-info">
                  <strong>
                    {task.title ||
                      task.name ||
                      'Untitled task'}
                  </strong>

                  {task.description && (
                    <p>
                      {task.description}
                    </p>
                  )}
                </div>

                <span className="project-status">
                  {task.status}
                </span>
              </div>
            ))}
        </div>
      </article>
    </section>
  )
}
      if (widget.type === 'tracked-time') {
        content = (
          <section className="dashboard-stats">
            <article className="dashboard-card tracked-time-card">
              <div
                className="tracked-time-layout"
                style={{
                  paddingTop: '28px',
                  paddingBottom: '8px',
                }}
              >
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
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '7px',
                          color: '#6eb7f5',
                          fontSize: '0.61rem',
                          fontWeight: 600,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: '#1688ff',
                            boxShadow:
                              '0 0 8px rgba(22, 136, 255, 0.7)',
                          }}
                        />
                        Tracking
                      </span>

                      <strong>
                        {activeTask?.title ||
                          activeTask?.name ||
                          'No task selected'}
                      </strong>
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

              {activeProject && (
                <div
                  className="project-list tracked-time-project"
                  style={{
                    marginTop: '14px',
                  }}
                >
                  <div className="project-item">
                    <div className="project-marker">
                      <span />
                    </div>

                    <div className="project-info">
                      <strong>
                        {activeProject.name}
                      </strong>
                    </div>

                    <span className="project-status">
                      {activeProject.status || 'active'}
                    </span>
                  </div>
                </div>
              )}

              {timeEntriesError && (
                <p className="time-tracker-error">
                  {timeEntriesError}
                </p>
              )}
            </article>
          </section>
        )
      }

      if (widget.type === 'timeline') {
        const selectedTimelineProject =
          projects.find(
            (project) =>
              String(project._id) ===
              String(timelineProjectId)
          ) || projects[0]

        const timelineTasks = tasks
          .filter(
            (task) =>
              String(task.projectId) ===
              String(selectedTimelineProject?._id)
          )
          .filter(
            (task) =>
              task.startDate ||
              task.completedDate ||
              task.dueDate
          )
          .sort((a, b) => {
            const dateA = new Date(
              a.startDate ||
                a.completedDate ||
                a.dueDate
            ).getTime()

            const dateB = new Date(
              b.startDate ||
                b.completedDate ||
                b.dueDate
            ).getTime()

            return dateA - dateB
          })
          .slice(0, 7)

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const timelineStart = new Date(today)
        timelineStart.setDate(
          timelineStart.getDate() - 7
        )

        const timelineEnd = new Date(today)
        timelineEnd.setDate(
          timelineEnd.getDate() + 21
        )

        const timelineTotalDays =
          Math.max(
            1,
            Math.ceil(
              (
                timelineEnd -
                timelineStart
              ) /
                86400000
            )
          )

        function getTimelinePosition(
          date
        ) {
          const value =
            (
              new Date(date) -
              timelineStart
            ) /
            86400000

          return Math.max(
            0,
            Math.min(
              100,
              (value /
                timelineTotalDays) *
                100
            )
          )
        }

        content = (
          <section className="dashboard-grid">
            <article className="dashboard-panel">
              <div className="panel-header">
                <button
                  type="button"
                  onClick={() =>
                    onViewChange('timeline')
                  }
                >
                  View all
                </button>
              </div>

              <div
                style={{
                  marginTop: '22px',
                  overflow: 'hidden',
                }}
              >
                {tasksLoading && (
                  <p>
                    Loading timeline...
                  </p>
                )}

                {!tasksLoading &&
                  timelineTasks.length === 0 && (
                    <p>
                      No dated tasks in this project.
                    </p>
                  )}

                {!tasksLoading &&
                  timelineTasks.map((task) => {
                    const startDate =
                      task.startDate ||
                      task.completedDate ||
                      task.dueDate

                    const endDate =
                      task.completedDate ||
                      task.dueDate ||
                      today

                    const startPosition =
                      getTimelinePosition(
                        startDate
                      )

                    const endPosition =
                      getTimelinePosition(
                        endDate
                      )

                    const width =
                      Math.max(
                        2,
                        endPosition -
                          startPosition
                      )

                    const statusClass =
                      task.status ===
                      'completed'
                        ? '#8fbfa5'
                        : task.status ===
                            'in-progress'
                          ? '#1688ff'
                          : '#7f8b98'

                    return (
                      <div
                        key={task._id}
                        style={{
                          marginBottom: '15px',
                        }}
                      >
                        <div
                          style={{
                            marginBottom: '6px',
                            overflow: 'hidden',
                            color:
                              'var(--color-text)',
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            textOverflow:
                              'ellipsis',
                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {task.title ||
                            task.name ||
                            'Untitled task'}
                        </div>

                        <div
                          style={{
                            position:
                              'relative',
                            height: '7px',
                            borderRadius:
                              '4px',
                            background:
                              'rgba(255, 255, 255, 0.045)',
                          }}
                        >
                          <div
                            style={{
                              position:
                                'absolute',
                              top: 0,
                              left: `${startPosition}%`,
                              width: `${width}%`,
                              height: '100%',
                              minWidth:
                                '4px',
                              borderRadius:
                                '4px',
                              background:
                                statusClass,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </article>
          </section>
        )
      }

      if (widget.type === 'time') {
        const selectedTimeProject =
          projects.find(
            (project) =>
              String(project._id) ===
              String(timeProjectId)
          ) || projects[0]

        const timeTasks = tasks
          .filter(
            (task) =>
              String(task.projectId) ===
              String(selectedTimeProject?._id)
          )
          .slice(0, 3)

        function getTaskTotalMinutes(taskId) {
          const task = tasks.find(
            (item) =>
              String(item._id) ===
              String(taskId)
          )

          const estimatedMinutes =
            Number(task?.estimatedMinutes) || 0

          const trackedMinutes = timeEntries
            .filter((entry) => {
              const entryTaskId =
                typeof entry.taskId === 'object'
                  ? entry.taskId?._id
                  : entry.taskId

              return (
                String(entryTaskId) ===
                String(taskId)
              )
            })
            .reduce(
              (total, entry) =>
                total +
                (Number(entry.duration) || 0),
              0
            )

          return estimatedMinutes + trackedMinutes
        }

        const selectedTimeProjectTotal =
          selectedTimeProject
            ? getProjectTotalMinutes(
                selectedTimeProject._id
              )
            : 0

        content = (
          <section className="dashboard-grid">
            <article className="dashboard-panel projects-panel">
              <div className="panel-header">
                <button
                  type="button"
                  onClick={() =>
                    onViewChange('time')
                  }
                >
                  View all
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                  gap: '20px',
                  marginBottom: '18px',
                }}
              >
                <div>
                  <strong
                    style={{
                      display: 'block',
                      overflow: 'hidden',
                      color: 'var(--color-text)',
                      fontSize: '15px',
                      fontWeight: 600,
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedTimeProject?.name ||
                      'No project selected'}
                  </strong>

                  <p
                    style={{
                      margin: '5px 0 0',
                      color: 'var(--color-muted)',
                      fontSize: '11px',
                    }}
                  >
                    Project total time
                  </p>
                </div>

                <strong
                  style={{
                    flex: '0 0 auto',
                    color: 'var(--color-text)',
                    fontSize: '20px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatProjectTime(
                    selectedTimeProjectTotal
                  )}
                </strong>
              </div>

              <div className="project-list">
                {tasksLoading && (
                  <p>Loading time...</p>
                )}

                {!tasksLoading &&
                  timeTasks.map((task) => (
                    <div
                      className="project-item"
                      key={task._id}
                    >
                      <div className="project-marker">
                        <span />
                      </div>

                      <div className="project-info">
                        <strong>
                          {task.title ||
                            task.name ||
                            'Untitled task'}
                        </strong>
                      </div>

                      <span className="project-time">
                        {formatProjectTime(
                          getTaskTotalMinutes(
                            task._id
                          )
                        )}
                      </span>
                    </div>
                  ))}

                {!tasksLoading &&
                  timeTasks.length === 0 && (
                    <p>
                      No tasks in this project.
                    </p>
                  )}
              </div>
            </article>
          </section>
        )
      }

      if (widget.type === 'recent-projects') {
        content = (
          <section className="dashboard-grid">
            <article className="dashboard-panel projects-panel">
              <div className="panel-header">
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

      if (widget.type === 'notes') {
        content = (
          <section className="dashboard-grid">
            <article className="dashboard-panel notes-panel">
              <div className="panel-header">
                <button
                  type="button"
                  onClick={() =>
                    onViewChange('notes')
                  }
                >
                  View all
                </button>
              </div>

              <div
                className="dashboard-notes-list"
                style={{
                  marginTop: '23px',
                }}
              >
                {notesLoading && (
                  <p>Loading notes...</p>
                )}

                {notesError && (
                  <p>{notesError}</p>
                )}

                {!notesLoading &&
                  !notesError &&
                  recentNotes.map((note) => (
                    <div
                      className="dashboard-note-item"
                      key={note._id}
                      style={{
                        minHeight: '82px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        borderTop:
                          '1px solid var(--color-border)',
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          color: '#e7edf5',
                          fontSize: '13px',
                          fontWeight: 600,
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {note.title}
                      </strong>

                      {note.content && (
                        <p
                          style={{
                            display: '-webkit-box',
                            margin: '5px 0 0',
                            overflow: 'hidden',
                            color: 'var(--color-muted)',
                            fontSize: '12px',
                            lineHeight: 1.5,
                            textOverflow: 'ellipsis',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {note.content}
                        </p>
                      )}
                    </div>
                  ))}

                {!notesLoading &&
                  !notesError &&
                  recentNotes.length === 0 && (
                    <p>No notes yet.</p>
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
                <button
                  type="button"
                  onClick={() =>
                    onViewChange('ai-assistant')
                  }
                >
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