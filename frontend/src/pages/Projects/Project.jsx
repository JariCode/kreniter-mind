import { useEffect, useState } from 'react'
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from '../../api/projects'
import './Project.css'

function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [projectToDelete, setProjectToDelete] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('active')
  const [color, setColor] = useState('#1688ff')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function loadProjects() {
    try {
      setError('')
      const data = await getProjects()
      setProjects(data)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  function resetForm() {
    setName('')
    setDescription('')
    setStatus('active')
    setColor('#1688ff')
    setEditingProject(null)
    setShowForm(false)
  }

  function startCreate() {
    resetForm()
    setShowForm(true)
  }

  function startEdit(project) {
    setName(project.name || '')
    setDescription(project.description || '')
    setStatus(project.status || 'active')
    setColor(project.color || '#1688ff')
    setEditingProject(project)
    setShowForm(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!name.trim()) {
      return
    }

    try {
      setSaving(true)
      setError('')

      const project = {
        name: name.trim(),
        description: description.trim(),
        status,
        color,
      }

      if (editingProject) {
        await updateProject(editingProject._id, project)
      } else {
        await createProject(project)
      }

      await loadProjects()
      resetForm()
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(project) {
    setProjectToDelete(project)
  }

  async function confirmDelete() {
    if (!projectToDelete) {
      return
    }

    try {
      setDeleting(true)
      setError('')
      await deleteProject(projectToDelete._id)

      setProjects((currentProjects) =>
        currentProjects.filter(
          (item) => item._id !== projectToDelete._id
        )
      )

      setProjectToDelete(null)
    } catch (error) {
      setError(error.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="projects-page">
      <section className="projects-intro">
        <div>
          <span className="projects-kicker">
            WORKSPACE
          </span>

          <h2>
            Projects
          </h2>

          <p>
            Manage your projects and keep your work organized.
          </p>
        </div>

        <button
          className="projects-create-button"
          type="button"
          onClick={startCreate}
        >
          + New project
        </button>
      </section>

      {error && (
        <div className="projects-error">
          {error}
        </div>
      )}

      {showForm && (
        <section className="project-form-panel">
          <div className="project-form-header">
            <div>
              <span className="projects-kicker">
                {editingProject ? 'EDIT PROJECT' : 'NEW PROJECT'}
              </span>

              <h3>
                {editingProject ? 'Edit project' : 'Create project'}
              </h3>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="project-form-grid">
              <label>
                <span>Name</span>

                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={150}
                  required
                />
              </label>

              <label>
                <span>Status</span>

                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>

              <label className="project-form-full">
                <span>Description</span>

                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={2000}
                  rows={4}
                />
              </label>

              <label>
                <span>Color</span>

                <input
                  className="project-color-input"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
              </label>
            </div>

            <div className="project-form-actions">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="project-save-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingProject
                    ? 'Save changes'
                    : 'Create project'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="projects-list">
        <div className="projects-list-header">
          <span>
            PROJECTS
          </span>

          <span>
            {projects.length}
          </span>
        </div>

        {loading && (
          <div className="projects-empty">
            Loading projects...
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="projects-empty">
            <h3>
              No projects yet
            </h3>

            <p>
              Create your first project to get started.
            </p>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="project-list">
            {projects.map((project) => (
              <article
                className="project-item"
                key={project._id}
              >
                <div
                  className="project-color"
                  style={{
                    backgroundColor: project.color || '#1688ff',
                  }}
                />

                <div className="project-info">
                  <div className="project-name-row">
                    <h3>
                      {project.name}
                    </h3>

                    <span className={`project-status ${project.status}`}>
                      {project.status}
                    </span>
                  </div>

                  <p>
                    {project.description || 'No description'}
                  </p>
                </div>

                <div className="project-actions">
                  <button
                    type="button"
                    onClick={() => startEdit(project)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(project)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {projectToDelete && (
        <div
          className="delete-dialog-overlay"
          onClick={() => {
            if (!deleting) {
              setProjectToDelete(null)
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
              Delete project?
            </h3>

            <p>
              Are you sure you want to delete{' '}
              <strong>{projectToDelete.name}</strong>?
              This action cannot be undone.
            </p>

            <div className="delete-dialog-actions">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
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
                {deleting ? 'Deleting...' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Projects