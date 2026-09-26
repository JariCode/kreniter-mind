import { useEffect, useMemo, useState } from 'react'
import { getProjects } from '../../api/projects'
import { getTasks } from '../../api/tasks'
import { getTimeEntries } from '../../api/timeEntries'
import { getNotes } from '../../api/notes'
import {
  getReportsView,
  saveReportsView,
} from '../../api/reportsView'
import './Reports.css'

function formatDuration(minutes) {
  const totalMinutes = Math.round(
    Number(minutes) || 0
  )

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

function formatDate(date) {
  if (!date) {
    return '—'
  }

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return '—'
  }

  return parsedDate.toLocaleDateString('fi-FI')
}

function getProjectId(value) {
  if (!value) {
    return ''
  }

  if (typeof value === 'object') {
    return String(value._id || value.id || '')
  }

  return String(value)
}

function Reports() {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [notes, setNotes] = useState([])
  const [selectedProjectId, setSelectedProjectId] =
    useState('')
  const [reportsViewLoaded, setReportsViewLoaded] =
    useState(false)
  const [printGeneratedAt, setPrintGeneratedAt] =
    useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError('')

        const [
          projectsData,
          tasksData,
          timeEntriesData,
          notesData,
          reportsViewData,
        ] = await Promise.all([
          getProjects(),
          getTasks(),
          getTimeEntries(),
          getNotes(),
          getReportsView(),
        ])

        setProjects(projectsData)
        setTasks(tasksData)
        setTimeEntries(timeEntriesData)
        setNotes(notesData)

        const savedProjectId =
          reportsViewData?.selectedProjectId

        const savedProjectExists =
          projectsData.some(
            (project) =>
              String(project._id) ===
              String(savedProjectId)
          )

        if (savedProjectExists) {
          setSelectedProjectId(
            String(savedProjectId)
          )
        } else if (projectsData.length > 0) {
          setSelectedProjectId(
            String(projectsData[0]._id)
          )
        } else {
          setSelectedProjectId('')
        }

        setReportsViewLoaded(true)
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  useEffect(() => {
    if (
      !reportsViewLoaded ||
      !selectedProjectId
    ) {
      return
    }

    saveReportsView(selectedProjectId).catch(
      (error) => {
        setError(error.message)
      }
    )
  }, [
    selectedProjectId,
    reportsViewLoaded,
  ])

  const selectedProject = useMemo(() => {
    return projects.find(
      (project) =>
        String(project._id) ===
        String(selectedProjectId)
    )
  }, [projects, selectedProjectId])

  const projectTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        getProjectId(task.projectId) ===
        String(selectedProjectId)
    )
  }, [tasks, selectedProjectId])

  const projectTimeEntries = useMemo(() => {
    return timeEntries.filter(
      (entry) =>
        getProjectId(entry.projectId) ===
        String(selectedProjectId)
    )
  }, [timeEntries, selectedProjectId])

  const projectNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        getProjectId(note.projectId) ===
        String(selectedProjectId)
    )
  }, [notes, selectedProjectId])

  const totalEstimatedMinutes = useMemo(() => {
    return projectTasks.reduce(
      (total, task) =>
        total +
        (Number(task.estimatedMinutes) || 0),
      0
    )
  }, [projectTasks])

  const totalTrackedMinutes = useMemo(() => {
    return projectTimeEntries.reduce(
      (total, entry) =>
        total +
        (Number(entry.duration) || 0),
      0
    )
  }, [projectTimeEntries])

  const totalProjectMinutes =
    totalEstimatedMinutes +
    totalTrackedMinutes

  const completedTasks = useMemo(() => {
    return projectTasks.filter(
      (task) => task.status === 'completed'
    ).length
  }, [projectTasks])

  const inProgressTasks = useMemo(() => {
    return projectTasks.filter(
      (task) => task.status === 'in-progress'
    ).length
  }, [projectTasks])

  const todoTasks = useMemo(() => {
    return projectTasks.filter(
      (task) => task.status === 'todo'
    ).length
  }, [projectTasks])

  const datedTasks = useMemo(() => {
    return projectTasks.filter(
      (task) =>
        task.startDate ||
        task.completedDate ||
        task.dueDate
    )
  }, [projectTasks])

  function printReport() {
    setPrintGeneratedAt(new Date())

    setTimeout(() => {
      window.print()
    }, 0)
  }

  if (loading) {
    return (
      <main className="reports-page">
        <div className="reports-loading">
          Loading...
        </div>
      </main>
    )
  }

  return (
    <main className="reports-page">
      <div className="reports-print-brand">
        <div className="reports-print-entity">
          <div className="reports-print-entity-line reports-print-entity-line-one" />
          <div className="reports-print-entity-line reports-print-entity-line-two" />
          <div className="reports-print-entity-core">
            K
          </div>
        </div>
      </div>

      <section className="reports-intro">
        <div>
          <span className="reports-kicker">
            WORKSPACE
          </span>

          <h2 className="reports-title">
            Reports
          </h2>

          <p className="reports-description">
            Welcome back
          </p>
        </div>

        <div className="reports-intro-actions">
          <div className="reports-project-select">
            <label htmlFor="reports-project">
              Project
            </label>

            <select
              id="reports-project"
              value={selectedProjectId}
              onChange={(event) =>
                setSelectedProjectId(
                  event.target.value
                )
              }
              disabled={projects.length === 0}
            >
              {projects.length === 0 ? (
                <option value="">
                  No projects
                </option>
              ) : (
                projects.map((project) => (
                  <option
                    key={project._id}
                    value={project._id}
                  >
                    {project.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            className="reports-print-button"
            onClick={printReport}
            disabled={!selectedProject}
          >
            Print report
          </button>
        </div>
      </section>

      {error && (
        <div className="reports-error">
          {error}
        </div>
      )}

      {!selectedProject ? (
        <section className="reports-empty">
          <h3>No project selected</h3>
          <p>
            Create a project to generate a report.
          </p>
        </section>
      ) : (
        <div className="reports-content">
          <section className="reports-header-panel">
            <div className="reports-header-main">
              <span className="reports-panel-kicker">
                PROJECT REPORT
              </span>

              <h3>{selectedProject.name}</h3>

              {selectedProject.description && (
                <p>
                  {selectedProject.description}
                </p>
              )}
            </div>

            <div className="reports-project-meta">
              <div>
                <span>Status</span>
                <strong>
                  {selectedProject.status ||
                    '—'}
                </strong>
              </div>

              <div>
                <span>Total time</span>
                <strong className="reports-total-time">
                  {formatDuration(
                    totalProjectMinutes
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="reports-summary-grid">
            <article className="reports-summary-card">
              <span>Tasks</span>
              <strong>{projectTasks.length}</strong>
              <small>
                {completedTasks} completed
              </small>
            </article>

            <article className="reports-summary-card">
              <span>Estimated time</span>
              <strong>
                {formatDuration(
                  totalEstimatedMinutes
                )}
              </strong>
              <small>
                From task estimates
              </small>
            </article>

            <article className="reports-summary-card">
              <span>Tracked time</span>
              <strong>
                {formatDuration(
                  totalTrackedMinutes
                )}
              </strong>
              <small>
                From time entries
              </small>
            </article>

            <article className="reports-summary-card">
              <span>Notes</span>
              <strong>{projectNotes.length}</strong>
              <small>
                Project notes
              </small>
            </article>
          </section>

          <div className="reports-sections-grid">
            <section className="reports-section">
              <div className="reports-section-header">
                <div>
                  <span className="reports-section-kicker">
                    TASKS
                  </span>

                  <h3>Task overview</h3>
                </div>

                <span className="reports-section-count">
                  {projectTasks.length}
                </span>
              </div>

              <div className="reports-status-grid">
                <div className="reports-status-item">
                  <span>To do</span>
                  <strong>{todoTasks}</strong>
                </div>

                <div className="reports-status-item">
                  <span>In progress</span>
                  <strong>
                    {inProgressTasks}
                  </strong>
                </div>

                <div className="reports-status-item">
                  <span>Completed</span>
                  <strong>
                    {completedTasks}
                  </strong>
                </div>
              </div>

              {projectTasks.length === 0 ? (
                <div className="reports-empty-row">
                  No tasks in this project.
                </div>
              ) : (
                <div className="reports-task-list">
                  {projectTasks.map((task) => (
                    <div
                      className="reports-task-row"
                      key={task._id}
                    >
                      <div className="reports-task-info">
                        <strong>
                          {task.title}
                        </strong>

                        {task.description && (
                          <span>
                            {task.description}
                          </span>
                        )}
                      </div>

                      <div className="reports-task-meta">
                        <span
                          className={`reports-task-status reports-task-status-${task.status || 'todo'}`}
                        >
                          {task.status ||
                            'todo'}
                        </span>

                        <span>
                          {formatDuration(
                            task.estimatedMinutes
                          )}
                        </span>

                        <span>
                          {formatDate(
                            task.dueDate
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="reports-section">
              <div className="reports-section-header">
                <div>
                  <span className="reports-section-kicker">
                    TIME
                  </span>

                  <h3>Tracked time</h3>
                </div>

                <span className="reports-section-total">
                  {formatDuration(
                    totalTrackedMinutes
                  )}
                </span>
              </div>

              {projectTimeEntries.length === 0 ? (
                <div className="reports-empty-row">
                  No tracked time in this project.
                </div>
              ) : (
                <div className="reports-time-list">
                  {projectTimeEntries.map(
                    (entry) => (
                      <div
                        className="reports-time-row"
                        key={entry._id}
                      >
                        <div>
                          <strong>
                            {entry.description ||
                              'Tracked time'}
                          </strong>

                          <span>
                            {formatDate(
                              entry.startedAt
                            )}
                          </span>
                        </div>

                        <strong>
                          {formatDuration(
                            entry.duration
                          )}
                        </strong>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <section className="reports-section">
              <div className="reports-section-header">
                <div>
                  <span className="reports-section-kicker">
                    TIMELINE
                  </span>

                  <h3>Project dates</h3>
                </div>

                <span className="reports-section-count">
                  {datedTasks.length}
                </span>
              </div>

              {datedTasks.length === 0 ? (
                <div className="reports-empty-row">
                  No dated tasks in this project.
                </div>
              ) : (
                <div className="reports-date-list">
                  {datedTasks.map((task) => (
                    <div
                      className="reports-date-row"
                      key={task._id}
                    >
                      <strong>
                        {task.title}
                      </strong>

                      <div>
                        <span>
                          Start{' '}
                          {formatDate(
                            task.startDate
                          )}
                        </span>

                        <span>
                          Completed{' '}
                          {formatDate(
                            task.completedDate
                          )}
                        </span>

                        <span>
                          Due{' '}
                          {formatDate(
                            task.dueDate
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="reports-section">
              <div className="reports-section-header">
                <div>
                  <span className="reports-section-kicker">
                    NOTES
                  </span>

                  <h3>Project notes</h3>
                </div>

                <span className="reports-section-count">
                  {projectNotes.length}
                </span>
              </div>

              {projectNotes.length === 0 ? (
                <div className="reports-empty-row">
                  No notes in this project.
                </div>
              ) : (
                <div className="reports-note-list">
                  {projectNotes.map((note) => (
                    <article
                      className="reports-note"
                      key={note._id}
                    >
                      <h4>
                        {note.title ||
                          'Untitled note'}
                      </h4>

                      {note.content && (
                        <p>
                          {note.content}
                        </p>
                      )}

                      <span>
                        {formatDate(
                          note.updatedAt ||
                            note.createdAt
                        )}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          {printGeneratedAt && (
            <div className="reports-print-generated">
              <span>Report generated</span>
              <strong>
                {printGeneratedAt.toLocaleDateString('fi-FI')}{' '}
                ·{' '}
                {printGeneratedAt.toLocaleTimeString('fi-FI', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </strong>
            </div>
          )}

          <div className="reports-print-complete">
            <span>REPORT COMPLETE</span>
            <strong>KRENITER MIND</strong>
          </div>
        </div>
      )}
    </main>
  )
}

export default Reports