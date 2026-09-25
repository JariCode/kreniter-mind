import { useEffect, useMemo, useState } from 'react'
import { getTasks } from '../../api/tasks'
import { getProjects } from '../../api/projects'
import { getTimeEntries } from '../../api/timeEntries'
import { getTimeline, saveTimeline } from '../../api/timeline'
import './Timeline.css'

const DAY_WIDTH = 64

const STATUS_COLORS = {
  todo: '#7f8b98',
  'in-progress': '#1688ff',
  completed: '#8fbfa5',
}

function Timeline() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [selectedProjectId, setSelectedProjectId] =
    useState('')
  const [timelineLoaded, setTimelineLoaded] =
    useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadData() {
    try {
      setError('')

      const [
        tasksData,
        projectsData,
        timeEntriesData,
        timelineData,
      ] = await Promise.all([
        getTasks(),
        getProjects(),
        getTimeEntries(),
        getTimeline(),
      ])

      setTasks(tasksData)
      setProjects(projectsData)
      setTimeEntries(timeEntriesData)

      const savedProjectId =
        timelineData?.selectedProjectId

      const savedProjectExists =
        projectsData.some(
          (project) =>
            String(project._id) ===
            String(savedProjectId)
        )

      if (savedProjectId && savedProjectExists) {
        setSelectedProjectId(
          String(savedProjectId)
        )
      } else if (projectsData.length > 0) {
        setSelectedProjectId(
          String(projectsData[0]._id)
        )
      }

      setTimelineLoaded(true)
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
    if (projects.length === 0) {
      return
    }

    setSelectedProjectId((currentProjectId) => {
      const projectExists = projects.some(
        (project) =>
          String(project._id) ===
          String(currentProjectId)
      )

      if (currentProjectId && projectExists) {
        return currentProjectId
      }

      return String(projects[0]._id)
    })
  }, [projects])

  useEffect(() => {
    if (!timelineLoaded || !selectedProjectId) {
      return
    }

    saveTimeline(selectedProjectId).catch(
      (error) => {
        setError(error.message)
      }
    )
  }, [selectedProjectId, timelineLoaded])

  const projectTasks = useMemo(() => {
    if (!selectedProjectId) {
      return []
    }

    return tasks.filter(
      (task) =>
        String(task.projectId) ===
        String(selectedProjectId)
    )
  }, [tasks, selectedProjectId])

  const timelineTasks = useMemo(() => {
    return projectTasks.filter(
      (task) =>
        task.startDate ||
        task.completedDate ||
        task.dueDate
    )
  }, [projectTasks])

  const timelineRange = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dates = []

    timelineTasks.forEach((task) => {
      const startValue =
        task.startDate ||
        task.completedDate ||
        task.dueDate

      if (startValue) {
        dates.push(parseDate(startValue))
      }

      if (task.completedDate) {
        dates.push(parseDate(task.completedDate))
      }

      if (task.dueDate) {
        dates.push(parseDate(task.dueDate))
      }
    })

    if (dates.length === 0) {
      return {
        start: today,
        end: today,
      }
    }

    const start = new Date(
      Math.min(...dates.map((date) => date.getTime()))
    )

    const endDates = dates.map((date) => date.getTime())
    endDates.push(today.getTime())

    const end = new Date(Math.max(...endDates))

    return {
      start,
      end,
    }
  }, [timelineTasks])

  const days = useMemo(() => {
    const result = []
    const current = new Date(timelineRange.start)

    while (current <= timelineRange.end) {
      result.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return result
  }, [timelineRange])

  function parseDate(value) {
    const date = new Date(value)

    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    )
  }

  function formatDay(date) {
    return `${date.getDate()}.${date.getMonth() + 1}`
  }

  function formatFullDate(value) {
    if (!value) {
      return '—'
    }

    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value))
  }

  function getTaskPosition(task) {
    const startValue =
      task.startDate ||
      task.completedDate ||
      task.dueDate

    if (!startValue) {
      return null
    }

    const start = parseDate(startValue)

    const end = task.completedDate
      ? parseDate(task.completedDate)
      : new Date()

    end.setHours(0, 0, 0, 0)

    if (end < start) {
      end.setTime(start.getTime())
    }

    const startOffset = differenceInDays(
      timelineRange.start,
      start
    )

    const duration =
      differenceInDays(start, end) + 1

    return {
      left: Math.max(0, startOffset * DAY_WIDTH),
      width: Math.max(
        duration * DAY_WIDTH,
        DAY_WIDTH
      ),
    }
  }

  function differenceInDays(start, end) {
    const startTime = new Date(start)
    const endTime = new Date(end)

    startTime.setHours(0, 0, 0, 0)
    endTime.setHours(0, 0, 0, 0)

    return Math.round(
      (endTime - startTime) /
        (1000 * 60 * 60 * 24)
    )
  }

  function getTrackedMinutes(taskId) {
    return timeEntries
      .filter(
        (entry) =>
          String(entry.taskId) ===
          String(taskId)
      )
      .reduce(
        (total, entry) =>
          total + (Number(entry.duration) || 0),
        0
      )
  }

  function formatDuration(minutes) {
    if (!minutes || minutes <= 0) {
      return '0 min'
    }

    const roundedMinutes = Math.floor(minutes)
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

  function getStatusLabel(status) {
    if (status === 'in-progress') {
      return 'Started'
    }

    if (status === 'completed') {
      return 'Completed'
    }

    return 'Added'
  }

  function getTaskIndent(task) {
    let depth = 0
    let currentTask = task
    const visited = new Set()

    while (currentTask?.parentTaskId) {
      const parentId = String(
        currentTask.parentTaskId
      )

      if (visited.has(parentId)) {
        break
      }

      visited.add(parentId)
      depth += 1

      currentTask = tasks.find(
        (item) =>
          String(item._id) === parentId
      )
    }

    return depth
  }

  function renderTooltip(task) {
    return (
      <div className="timeline-tooltip">
        <strong>{task.title}</strong>

        <div className="timeline-tooltip-row">
          <span>Started</span>
          <span>
            {formatFullDate(task.startDate)}
          </span>
        </div>

        <div className="timeline-tooltip-row">
          <span>Completed</span>
          <span>
            {formatFullDate(task.completedDate)}
          </span>
        </div>

        <div className="timeline-tooltip-row">
          <span>Tracked</span>
          <span>
            {formatDuration(
              getTrackedMinutes(task._id)
            )}
          </span>
        </div>
      </div>
    )
  }

  return (
    <main className="timeline-page">
      <section className="timeline-intro">
        <div>
          <span className="timeline-kicker">
            WORKSPACE
          </span>

          <h2>Timeline</h2>

          <p>
            See your project tasks and progress
            across time.
          </p>
        </div>

        <div className="timeline-project-select">
          <label htmlFor="timeline-project">
            Project
          </label>

          <select
            id="timeline-project"
            value={selectedProjectId}
            onChange={(event) =>
              setSelectedProjectId(
                event.target.value
              )
            }
            disabled={
              loading || projects.length === 0
            }
          >
            {projects.length === 0 && (
              <option value="">
                No projects
              </option>
            )}

            {projects.map((project) => (
              <option
                key={project._id}
                value={project._id}
              >
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading && (
        <section className="timeline-panel">
          <div className="timeline-empty">
            Loading timeline...
          </div>
        </section>
      )}

      {!loading && error && (
        <section className="timeline-panel">
          <div className="timeline-error">
            {error}
          </div>
        </section>
      )}

      {!loading &&
        !error &&
        projects.length === 0 && (
          <section className="timeline-panel">
            <div className="timeline-empty">
              Create a project to start using
              the timeline.
            </div>
          </section>
        )}

      {!loading &&
        !error &&
        projects.length > 0 &&
        projectTasks.length === 0 && (
          <section className="timeline-panel">
            <div className="timeline-empty">
              This project has no tasks yet.
            </div>
          </section>
        )}

      {!loading &&
        !error &&
        projectTasks.length > 0 &&
        timelineTasks.length === 0 && (
          <section className="timeline-panel">
            <div className="timeline-empty">
              The tasks in this project do not
              have timeline dates yet.
            </div>
          </section>
        )}

      {!loading &&
        !error &&
        timelineTasks.length > 0 && (
          <section className="timeline-panel">
            <div className="timeline-scroll">
              <div
                className="timeline-grid"
                style={{
                  '--timeline-days': days.length,
                  '--timeline-width': `${
                    days.length * DAY_WIDTH
                  }px`,
                }}
              >
                <div className="timeline-header">
                  <div className="timeline-task-header">
                    Tasks
                  </div>

                  <div className="timeline-dates">
                    {days.map((day) => (
                      <div
                        key={day.toISOString()}
                        className="timeline-date"
                      >
                        <span>
                          {formatDay(day)}
                        </span>

                      </div>
                    ))}
                  </div>
                </div>

                {timelineTasks.map((task) => {
                  const position =
                    getTaskPosition(task)

                  const indent =
                    getTaskIndent(task)

                  return (
                    <div
                      key={task._id}
                      className="timeline-row"
                    >
                      <div
                        className="timeline-task-column"
                        style={{
                          paddingLeft: `${
                            12 + indent * 18
                          }px`,
                        }}
                      >
                        <span className="timeline-task-title">
                          {task.title}
                        </span>

                        <span className="timeline-task-status">
                          {getStatusLabel(
                            task.status
                          )}
                        </span>
                      </div>

                      <div
                        className="timeline-track"
                        style={{
                          width: `${days.length * DAY_WIDTH}px`,
                        }}
                      >
                        {days.map((day) => (
                          <span
                            key={day.toISOString()}
                            className="timeline-day-cell"
                          />
                        ))}

                        {position && (
                          <div
                            className="timeline-task-bar-wrapper"
                            style={{
                              left: `${position.left}px`,
                              width: `${position.width}px`,
                            }}
                          >
                            <span className="timeline-bar-title">
                              {task.title}
                            </span>

                            <div
                              className={`timeline-task-bar status-${task.status}`}
                            >
                              {task.dueDate && (
                                <span
                                  className="timeline-due-marker"
                                  title={`Due ${formatFullDate(
                                    task.dueDate
                                  )}`}
                                />
                              )}

                              <div className="timeline-tooltip-container">
                                {renderTooltip(
                                  task
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}
    </main>
  )
}

export default Timeline