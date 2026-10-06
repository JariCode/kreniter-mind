import { useEffect, useMemo, useState } from 'react'
import { getTasks } from '../../api/tasks'
import { getProjects } from '../../api/projects'
import { getTimeEntries } from '../../api/timeEntries'
import { getTimeline, saveTimeline } from '../../api/timeline'
import HoverTooltip from '../../components/Tooltip/HoverTooltip'
import { getTooltipPosition } from '../../components/Tooltip/tooltipPosition'
import './Timeline.css'

const DAY_WIDTH = 64
const NO_PROJECT = 'no-project'

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
  const [hoveredTooltip, setHoveredTooltip] =
    useState(null)
  const [collapsedTaskIds, setCollapsedTaskIds] =
    useState(() => new Set())
  const [
    collapseStateProjectId,
    setCollapseStateProjectId,
  ] = useState(selectedProjectId)

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

      if (
        savedProjectId === NO_PROJECT ||
        savedProjectId === null
      ) {
        setSelectedProjectId(NO_PROJECT)
      } else if (savedProjectId && savedProjectExists) {
        setSelectedProjectId(
          String(savedProjectId)
        )
      } else if (projectsData.length > 0) {
        setSelectedProjectId(
          String(projectsData[0]._id)
        )
      } else {
        setSelectedProjectId(NO_PROJECT)
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
      if (currentProjectId === NO_PROJECT) {
        return NO_PROJECT
      }

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

    saveTimeline(
      selectedProjectId === NO_PROJECT
        ? null
        : selectedProjectId
    ).catch(
      (error) => {
        setError(error.message)
      }
    )
  }, [selectedProjectId, timelineLoaded])

  // Subtask collapse state is not persisted, so switching projects
  // should not leave stale ids referring to another project's tasks.
  // Resetting during render (rather than in an effect) avoids an
  // extra render pass when the project changes.
  if (collapseStateProjectId !== selectedProjectId) {
    setCollapseStateProjectId(selectedProjectId)
    setCollapsedTaskIds(new Set())
  }

  const projectTasks = useMemo(() => {
    if (!selectedProjectId) {
      return []
    }

    return tasks.filter((task) => {
      const taskProjectId =
        typeof task.projectId === 'object'
          ? task.projectId?._id
          : task.projectId

      if (selectedProjectId === NO_PROJECT) {
        return !taskProjectId
      }

      return (
        String(taskProjectId) ===
        String(selectedProjectId)
      )
    })
  }, [tasks, selectedProjectId])

  // Orders tasks as a tree: each parent is followed by its subtasks.
  // A parent without dates is kept when one of its subtasks has dates.
  const timelineTasks = useMemo(() => {
    function hasDates(task) {
      return Boolean(
        task.startDate ||
          task.completedDate ||
          task.dueDate
      )
    }

    function getSortTime(task) {
      const value =
        task.startDate ||
        task.completedDate ||
        task.dueDate

      return value
        ? new Date(value).getTime()
        : Number.MAX_SAFE_INTEGER
    }

    function compareByStart(a, b) {
      return getSortTime(a) - getSortTime(b)
    }

    const taskIds = new Set(
      projectTasks.map((task) => String(task._id))
    )
    const childrenByParent = new Map()
    const rootTasks = []

    projectTasks.forEach((task) => {
      const parentId = task.parentTaskId
        ? String(task.parentTaskId)
        : null

      if (
        parentId &&
        parentId !== String(task._id) &&
        taskIds.has(parentId)
      ) {
        if (!childrenByParent.has(parentId)) {
          childrenByParent.set(parentId, [])
        }

        childrenByParent.get(parentId).push(task)
      } else {
        rootTasks.push(task)
      }
    })

    const visited = new Set()

    function collect(task) {
      const taskId = String(task._id)

      if (visited.has(taskId)) {
        return []
      }

      visited.add(taskId)

      const children = [
        ...(childrenByParent.get(taskId) || []),
      ]
        .sort(compareByStart)
        .flatMap(collect)

      if (!hasDates(task) && children.length === 0) {
        return []
      }

      return [task, ...children]
    }

    return [...rootTasks]
      .sort(compareByStart)
      .flatMap(collect)
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

  const timelineTaskMap = useMemo(() => {
    const map = new Map()

    timelineTasks.forEach((task) => {
      map.set(String(task._id), task)
    })

    return map
  }, [timelineTasks])

  // Ids of tasks that have at least one subtask rendered in the
  // timeline. Only these tasks get a collapse/expand toggle.
  const taskIdsWithChildren = useMemo(() => {
    const ids = new Set()

    timelineTasks.forEach((task) => {
      const parentId = task.parentTaskId
        ? String(task.parentTaskId)
        : null

      if (parentId && timelineTaskMap.has(parentId)) {
        ids.add(parentId)
      }
    })

    return ids
  }, [timelineTasks, timelineTaskMap])

  // Rows hidden by a collapsed ancestor. timelineRange/days are still
  // derived from timelineTasks so the timeline length never shifts
  // when tasks are collapsed or expanded.
  const visibleTimelineTasks = useMemo(() => {
    function isTaskVisible(task) {
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

        const parentTask = timelineTaskMap.get(parentId)

        if (!parentTask) {
          break
        }

        if (collapsedTaskIds.has(parentId)) {
          return false
        }

        currentTask = parentTask
      }

      return true
    }

    return timelineTasks.filter((task) =>
      isTaskVisible(task)
    )
  }, [timelineTasks, timelineTaskMap, collapsedTaskIds])

  function toggleTaskCollapse(taskId) {
    setCollapsedTaskIds((previous) => {
      const next = new Set(previous)

      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }

      return next
    })
  }

  function collapseAllTasks() {
    setCollapsedTaskIds(new Set(taskIdsWithChildren))
  }

  function expandAllTasks() {
    setCollapsedTaskIds(new Set())
  }

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

  function getTotalMinutes(task) {
    return timeEntries
      .filter(
        (entry) =>
          String(entry.taskId) ===
          String(task._id)
      )
      .reduce(
        (total, entry) =>
          total + (Number(entry.duration) || 0),
        Number(task.estimatedMinutes) || 0
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
          <span>Total time</span>
          <span>
            {formatDuration(
              getTotalMinutes(task)
            )}
          </span>
        </div>
      </div>
    )
  }

  function showTooltip(task, event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const { left, top, placement } = getTooltipPosition(rect)

    setHoveredTooltip({
      task,
      left,
      top,
      placement,
    })
  }

  return (
    <>
      <main className="timeline-page">
      <section className="timeline-intro">
        <div>
          <span className="timeline-kicker">
            WORKSPACE
          </span>

          <h1>Timeline</h1>

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
            <option value={NO_PROJECT}>
              No project
            </option>

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

        <div className="timeline-collapse-actions">
          <button
            type="button"
            className="timeline-toolbar-btn"
            onClick={collapseAllTasks}
            disabled={taskIdsWithChildren.size === 0}
          >
            Collapse all
          </button>

          <button
            type="button"
            className="timeline-toolbar-btn"
            onClick={expandAllTasks}
            disabled={collapsedTaskIds.size === 0}
          >
            Expand all
          </button>
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

                {visibleTimelineTasks.map((task) => {
                  const position =
                    getTaskPosition(task)

                  const indent =
                    getTaskIndent(task)

                  const taskId = String(task._id)
                  const hasChildren =
                    taskIdsWithChildren.has(taskId)
                  const isCollapsed =
                    collapsedTaskIds.has(taskId)

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
                        <div className="timeline-task-title-row">
                          {hasChildren ? (
                            <button
                              type="button"
                              className="timeline-collapse-toggle"
                              aria-expanded={!isCollapsed}
                              aria-label={
                                isCollapsed
                                  ? `Expand ${task.title}`
                                  : `Collapse ${task.title}`
                              }
                              onClick={() =>
                                toggleTaskCollapse(taskId)
                              }
                            >
                              {isCollapsed ? '▸' : '▾'}
                            </button>
                          ) : (
                            <span
                              className="timeline-collapse-spacer"
                              aria-hidden="true"
                            />
                          )}

                          <span className="timeline-task-title">
                            {task.title}
                          </span>
                        </div>

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
                              onMouseEnter={(event) =>
                                showTooltip(task, event)
                              }
                              onMouseLeave={() =>
                                setHoveredTooltip(null)
                              }
                            >
                              {task.dueDate && (
                                <span
                                  className="timeline-due-marker"
                                  title={`Due ${formatFullDate(
                                    task.dueDate
                                  )}`}
                                />
                              )}

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

      {hoveredTooltip && (
        <HoverTooltip
          left={hoveredTooltip.left}
          top={hoveredTooltip.top}
          placement={hoveredTooltip.placement}
          containerClassName="timeline-tooltip-container"
        >
          {renderTooltip(hoveredTooltip.task)}
        </HoverTooltip>
      )}
    </>
  )
}

export default Timeline