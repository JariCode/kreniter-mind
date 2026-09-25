import { useEffect, useState } from 'react'
import {
  createNote,
  deleteNote,
  getNotes,
  updateNote,
} from '../../api/notes'
import { getProjects } from '../../api/projects'
import './Note.css'

function Note() {
  const [notes, setNotes] = useState([])
  const [projects, setProjects] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState('medium')

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState(null)
  const [draggedNote, setDraggedNote] = useState(null)

  useEffect(() => {
    loadNotes()
    loadProjects()
  }, [])

  async function loadNotes() {
    try {
      setLoading(true)
      setError('')

      const data = await getNotes()
      setNotes(data)
    } catch (error) {
      console.error('Failed to load notes:', error)
      setError('Failed to load notes.')
    } finally {
      setLoading(false)
    }
  }

  async function loadProjects() {
    try {
      const data = await getProjects()
      setProjects(data)
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  function resetForm() {
    setTitle('')
    setContent('')
    setProjectId('')
    setPriority('medium')
    setEditingNote(null)
    setShowForm(false)
  }

  function startCreate() {
    setTitle('')
    setContent('')
    setProjectId('')
    setPriority('medium')
    setEditingNote(null)
    setShowForm(true)
  }

  function startEdit(note) {
    setTitle(note.title || '')
    setContent(note.content || '')
    setProjectId(note.projectId || '')
    setPriority(note.priority || 'medium')
    setEditingNote(note)
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

      const noteData = {
        title: title.trim(),
        content,
        projectId: projectId || null,
        priority,
        order: editingNote?.order || 0,
      }

      if (editingNote) {
        const updatedNote = await updateNote(
          editingNote._id,
          noteData
        )

        setNotes((currentNotes) =>
          currentNotes.map((note) =>
            note._id === updatedNote._id
              ? updatedNote
              : note
          )
        )
      } else {
        const newNote = await createNote(noteData)

        setNotes((currentNotes) => [
          ...currentNotes,
          newNote,
        ])
      }

      resetForm()
    } catch (error) {
      console.error('Failed to save note:', error)
      setError('Failed to save note.')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete(note) {
    setNoteToDelete(note)
  }

  async function confirmDelete() {
    if (!noteToDelete) {
      return
    }

    try {
      setDeleting(true)
      setError('')

      await deleteNote(noteToDelete._id)

      setNotes((currentNotes) =>
        currentNotes.filter(
          (currentNote) =>
            currentNote._id !== noteToDelete._id
        )
      )

      if (editingNote?._id === noteToDelete._id) {
        resetForm()
      }

      setNoteToDelete(null)
    } catch (error) {
      console.error('Failed to delete note:', error)
      setError('Failed to delete note.')
    } finally {
      setDeleting(false)
    }
  }

  function getProjectName(projectId) {
    if (!projectId) {
      return null
    }

    const project = projects.find(
      (item) => item._id === projectId
    )

    return project?.name || null
  }

  function getNotesByPriority(notePriority) {
    return notes
      .filter(
        (note) =>
          (note.priority || 'medium') === notePriority
      )
      .sort(
        (a, b) =>
          (a.order || 0) - (b.order || 0)
      )
  }

  async function updateNoteOrder(
    updatedNotes,
    changedNoteIds
  ) {
    try {
      await Promise.all(
        changedNoteIds.map((noteId) => {
          const note = updatedNotes.find(
            (item) => item._id === noteId
          )

          if (!note) {
            return null
          }

          return updateNote(note._id, {
            title: note.title,
            content: note.content,
            projectId: note.projectId || null,
            priority: note.priority,
            order: note.order,
          })
        })
      )
    } catch (error) {
      console.error(
        'Failed to save note order:',
        error
      )

      setError('Failed to save note order.')
      await loadNotes()
    }
  }

  function handleDragStart(event, note) {
    setDraggedNote(note)

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(
      'text/plain',
      note._id
    )
  }

  function handleDragEnd() {
    setDraggedNote(null)
  }

  async function handleDrop(
    event,
    targetPriority
  ) {
    event.preventDefault()

    if (!draggedNote) {
      return
    }

    const currentPriority =
      draggedNote.priority || 'medium'

    const targetNotes =
      getNotesByPriority(targetPriority)

    const nextOrder =
      targetNotes.length === 0
        ? 0
        : Math.max(
            ...targetNotes.map(
              (note) => note.order || 0
            )
          ) + 1

    const changedNote = {
      ...draggedNote,
      priority: targetPriority,
      order: nextOrder,
    }

    const updatedNotes = notes.map((note) =>
      note._id === draggedNote._id
        ? changedNote
        : note
    )

    setNotes(updatedNotes)
    setDraggedNote(null)

    if (currentPriority !== targetPriority) {
      await updateNoteOrder(
        updatedNotes,
        [draggedNote._id]
      )
    }
  }

  function handleDragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  if (loading) {
    return (
      <main className="notes-page">
        <div className="notes-loading">
          Loading notes...
        </div>
      </main>
    )
  }

  const priorities = [
    {
      key: 'low',
      label: 'Low',
    },
    {
      key: 'medium',
      label: 'Medium',
    },
    {
      key: 'high',
      label: 'High',
    },
  ]

  return (
    <main className="notes-page">
      <div className="notes-intro">
        <div>
          <span className="notes-kicker">
            Workspace
          </span>

          <h2>Notes</h2>

          <p>
            Capture ideas, information and things you want
            to remember.
          </p>
        </div>

        <button
          className="notes-create-button"
          type="button"
          onClick={startCreate}
        >
          + New note
        </button>
      </div>

      {error && (
        <div className="notes-error">
          {error}
        </div>
      )}

      {showForm && (
        <section className="note-form-panel">
          <div className="note-form-header">
            <h3>
              {editingNote
                ? 'Edit note'
                : 'New note'}
            </h3>

            <button
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="note-form-grid">
              <label className="note-form-full">
                <span>Title</span>

                <input
                  type="text"
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="Note title"
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
                  <option value="">
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
              </label>

              <label>
                <span>Priority</span>

                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value)
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

              <label className="note-form-full">
                <span>Content</span>

                <textarea
                  value={content}
                  onChange={(event) =>
                    setContent(event.target.value)
                  }
                  placeholder="Write your note..."
                  rows={8}
                />
              </label>
            </div>

            <div className="note-form-actions">
              <button
                type="button"
                onClick={resetForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingNote
                    ? 'Save changes'
                    : 'Create note'}
              </button>
            </div>
          </form>
        </section>
      )}

      {notes.length === 0 ? (
        <section className="notes-empty">
          <h3>No notes yet</h3>

          <p>
            Create your first note to get started.
          </p>
        </section>
      ) : (
        <section className="notes-board">
          {priorities.map((priorityColumn) => {
            const columnNotes = getNotesByPriority(
              priorityColumn.key
            )

            return (
              <div
                className={`notes-column notes-column-${priorityColumn.key}`}
                key={priorityColumn.key}
                onDragOver={handleDragOver}
                onDrop={(event) =>
                  handleDrop(
                    event,
                    priorityColumn.key
                  )
                }
              >
                <div className="notes-column-header">
                  <h3>
                    {priorityColumn.label}
                  </h3>

                  <span>
                    {columnNotes.length}
                  </span>
                </div>

                <div className="notes-column-content">
                  {columnNotes.map((note) => {
                    const projectName =
                      getProjectName(
                        note.projectId
                      )

                    return (
                      <article
                        className={`note-item note-item-${note.priority || 'medium'}`}
                        key={note._id}
                        draggable
                        onDragStart={(event) =>
                          handleDragStart(
                            event,
                            note
                          )
                        }
                        onDragEnd={handleDragEnd}
                      >
                        <div className="note-priority-bar" />

                        <div className="note-content">
                          <div className="note-heading">
                            <h3>
                              {note.title}
                            </h3>

                            {projectName && (
                              <span className="note-project">
                                {projectName}
                              </span>
                            )}
                          </div>

                          {note.content && (
                            <p>
                              {note.content}
                            </p>
                          )}
                        </div>

                        <div className="note-actions">
                          <button
                            type="button"
                            onClick={() =>
                              startEdit(note)
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(note)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    )
                  })}

                  {columnNotes.length === 0 && (
                    <div className="notes-column-empty">
                      Drop notes here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {noteToDelete && (
        <div
          className="delete-dialog-overlay"
          onClick={() => {
            if (!deleting) {
              setNoteToDelete(null)
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
              Delete note?
            </h3>

            <p>
              Are you sure you want to delete{' '}
              <strong>
                {noteToDelete.title}
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="delete-dialog-actions">
              <button
                type="button"
                onClick={() =>
                  setNoteToDelete(null)
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
                  : 'Delete note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Note