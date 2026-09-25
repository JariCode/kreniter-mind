import { useEffect, useMemo, useState } from 'react'
import { getTasks } from '../../api/tasks'
import { getProjects } from '../../api/projects'
import { getTimeEntries } from '../../api/timeEntries'
import { getTimeView, saveTimeView } from '../../api/timeView'
import './Time.css'

const NO_PROJECT = 'no-project'

function formatDuration(minutes) {
  const totalMinutes = Math.round(Number(minutes) || 0)

  const hours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60

  if (hours === 0) {
    return `${remainingMinutes} min`
  }

  if (remainingMinutes === 0) {
    return `${hours} h`
  }

  return `${hours} h ${remainingMinutes} min`
}

function Time() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [timeViewLoaded, setTimeViewLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [
          tasksData,
          projectsData,
          timeEntriesData,
          timeViewData,
        ] = await Promise.all([
          getTasks(),
          getProjects(),
          getTimeEntries(),
          getTimeView(),
        ])

        setTasks(tasksData)
        setProjects(projectsData)
        setTimeEntries(timeEntriesData)

        const savedProjectId = timeViewData?.selectedProjectId

        const savedProjectExists = projectsData.some(
          (project) =>
            String(project._id) === String(savedProjectId)
        )

        if (savedProjectId === NO_PROJECT) {
          setSelectedProjectId(NO_PROJECT)
        } else if (savedProjectExists) {
          setSelectedProjectId(String(savedProjectId))
        } else if (projectsData.length > 0) {
          setSelectedProjectId(String(projectsData[0]._id))
        } else {
          setSelectedProjectId(NO_PROJECT)
        }

        setTimeViewLoaded(true)
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (!timeViewLoaded || !selectedProjectId) return

    saveTimeView(selectedProjectId).catch((error) => {
      setError(error.message)
    })
  }, [selectedProjectId, timeViewLoaded])

  const selectedProject = useMemo(() => {
    return projects.find(
      (project) =>
        String(project._id) === String(selectedProjectId)
    )
  }, [projects, selectedProjectId])

  const projectTasks = useMemo(() => {
    return tasks.filter((task) => {
      const taskProjectId =
        typeof task.projectId === 'object'
          ? task.projectId?._id
          : task.projectId

      if (selectedProjectId === NO_PROJECT) {
        return !taskProjectId
      }

      return String(taskProjectId) === String(selectedProjectId)
    })
  }, [tasks, selectedProjectId])

  const taskTotals = useMemo(() => {
    const totals = {}

    projectTasks.forEach((task) => {
      totals[String(task._id)] =
        Number(task.estimatedMinutes) || 0
    })

    timeEntries.forEach((entry) => {
      if (!entry.taskId) return

      const taskId =
        typeof entry.taskId === 'object'
          ? entry.taskId._id
          : entry.taskId

      if (!taskId) return

      const taskIdString = String(taskId)

      totals[taskIdString] =
        (totals[taskIdString] || 0) +
        (Number(entry.duration) || 0)
    })

    return totals
  }, [projectTasks, timeEntries])

  const projectTotal = useMemo(() => {
    const taskTotal = projectTasks.reduce(
      (total, task) =>
        total +
        (Number(task.estimatedMinutes) || 0),
      0
    )

    const trackedTotal = timeEntries
      .filter((entry) => {
        const entryProjectId =
          typeof entry.projectId === 'object'
            ? entry.projectId?._id
            : entry.projectId

        if (selectedProjectId === NO_PROJECT) {
          return !entryProjectId
        }

        return (
          String(entryProjectId) ===
          String(selectedProjectId)
        )
      })
      .reduce(
        (total, entry) =>
          total + (Number(entry.duration) || 0),
        0
      )

    return taskTotal + trackedTotal
  }, [projectTasks, timeEntries, selectedProjectId])

  if (loading) {
    return (
      <main className="time-page">
        <div className="time-loading">Loading...</div>
      </main>
    )
  }

  return (
    <main className="time-page">
      <section className="time-intro">
        <div>
          <span className="time-kicker">
            WORKSPACE
          </span>

          <h2>Time</h2>

          <p>
            See your project tasks and accumulated time.
          </p>
        </div>

        <div className="time-project-select">
          <label htmlFor="time-project">
            Project
          </label>

          <select
            id="time-project"
            value={selectedProjectId}
            onChange={(event) =>
              setSelectedProjectId(event.target.value)
            }
            disabled={projects.length === 0}
          >
            {projects.length === 0 ? (
              <option value={NO_PROJECT}>
                No project
              </option>
            ) : (
              <>
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
              </>
            )}
          </select>
        </div>
      </section>

      {error && (
        <div className="time-error">
          {error}
        </div>
      )}

      <div className="time-content">
        <div className="time-task-list">
          {projectTasks.length === 0 ? (
            <div className="time-empty">
              No tasks in this project.
            </div>
          ) : (
            projectTasks.map((task) => (
              <div
                className="time-task-row"
                key={task._id}
              >
                <span className="time-task-name">
                  {task.title}
                </span>

                <span className="time-task-duration">
                  {formatDuration(
                    taskTotals[String(task._id)] || 0
                  )}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="time-project-total">
          <span className="time-project-total-project">
            {selectedProject?.name || 'No project'}
          </span>

          <span className="time-project-total-label">
            Project total time
          </span>

          <span className="time-project-total-value">
            {formatDuration(projectTotal)}
          </span>
        </div>
      </div>
    </main>
  )
}

export default Time