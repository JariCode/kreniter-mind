import { useEffect, useState } from 'react'
import { toDateKey } from './calendarDates'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

// Create/edit dialog for a calendar event. Validation errors are shown
// next to the field they belong to; server errors are shown at the top
// of the form, same as the rest of the app's forms.
function EventFormDialog({
  event,
  defaultDate,
  projects,
  saving,
  serverError,
  onSave,
  onDelete,
  onClose,
}) {
  const isEditing = !!event

  const [title, setTitle] = useState(event?.title || '')
  const [date, setDate] = useState(
    toDateKey(event ? new Date(event.date) : defaultDate)
  )
  const [allDay, setAllDay] = useState(
    event ? event.allDay : true
  )
  const [startTime, setStartTime] = useState(
    event?.startTime || '09:00'
  )
  const [endTime, setEndTime] = useState(
    event?.endTime || '10:00'
  )
  const [description, setDescription] = useState(
    event?.description || ''
  )
  const [projectId, setProjectId] = useState(
    event?.projectId || ''
  )
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    function handleKeyDown(keyEvent) {
      if (keyEvent.key === 'Escape' && !saving) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [saving, onClose])

  function validate() {
    const errors = {}

    if (!title.trim()) {
      errors.title = 'Title is required'
    }

    if (!date) {
      errors.date = 'Date is required'
    }

    if (!allDay) {
      if (!TIME_PATTERN.test(startTime)) {
        errors.startTime = 'Invalid time'
      }

      if (!TIME_PATTERN.test(endTime)) {
        errors.endTime = 'Invalid time'
      }

      if (
        TIME_PATTERN.test(startTime) &&
        TIME_PATTERN.test(endTime) &&
        endTime <= startTime
      ) {
        errors.endTime = 'End time must be after start time'
      }
    }

    setFieldErrors(errors)

    return Object.keys(errors).length === 0
  }

  function handleSubmit(formEvent) {
    formEvent.preventDefault()

    if (!validate()) {
      return
    }

    onSave({
      title: title.trim(),
      date,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      description,
      projectId: projectId || null,
    })
  }

  return (
    <div
      className="calendar-modal-backdrop"
      onClick={() => {
        if (!saving) {
          onClose()
        }
      }}
    >
      <form
        className="calendar-modal calendar-event-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-event-form-title"
        onClick={(clickEvent) =>
          clickEvent.stopPropagation()
        }
        onSubmit={handleSubmit}
      >
        <div className="calendar-modal-header">
          <span className="calendar-modal-kicker">
            {isEditing ? 'EDIT EVENT' : 'NEW EVENT'}
          </span>

          <h2 id="calendar-event-form-title">
            {isEditing ? 'Edit event' : 'Add event'}
          </h2>
        </div>

        {serverError && (
          <p className="calendar-form-error">
            {serverError}
          </p>
        )}

        <div className="calendar-form-field">
          <label htmlFor="calendar-event-title">
            Title
          </label>

          <input
            id="calendar-event-title"
            type="text"
            value={title}
            onChange={(changeEvent) =>
              setTitle(changeEvent.target.value)
            }
            maxLength={200}
            autoFocus
          />

          {fieldErrors.title && (
            <span className="calendar-field-error">
              {fieldErrors.title}
            </span>
          )}
        </div>

        <div className="calendar-form-row">
          <div className="calendar-form-field">
            <label htmlFor="calendar-event-date">
              Date
            </label>

            <input
              id="calendar-event-date"
              type="date"
              value={date}
              onChange={(changeEvent) =>
                setDate(changeEvent.target.value)
              }
            />

            {fieldErrors.date && (
              <span className="calendar-field-error">
                {fieldErrors.date}
              </span>
            )}
          </div>

          <div className="calendar-form-field calendar-form-checkbox">
            <label htmlFor="calendar-event-all-day">
              <input
                id="calendar-event-all-day"
                type="checkbox"
                checked={allDay}
                onChange={(changeEvent) =>
                  setAllDay(changeEvent.target.checked)
                }
              />
              All day
            </label>
          </div>
        </div>

        {!allDay && (
          <div className="calendar-form-row">
            <div className="calendar-form-field">
              <label htmlFor="calendar-event-start-time">
                Start time
              </label>

              <input
                id="calendar-event-start-time"
                type="time"
                value={startTime}
                onChange={(changeEvent) =>
                  setStartTime(changeEvent.target.value)
                }
              />

              {fieldErrors.startTime && (
                <span className="calendar-field-error">
                  {fieldErrors.startTime}
                </span>
              )}
            </div>

            <div className="calendar-form-field">
              <label htmlFor="calendar-event-end-time">
                End time
              </label>

              <input
                id="calendar-event-end-time"
                type="time"
                value={endTime}
                onChange={(changeEvent) =>
                  setEndTime(changeEvent.target.value)
                }
              />

              {fieldErrors.endTime && (
                <span className="calendar-field-error">
                  {fieldErrors.endTime}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="calendar-form-field">
          <label htmlFor="calendar-event-description">
            Description
          </label>

          <textarea
            id="calendar-event-description"
            value={description}
            onChange={(changeEvent) =>
              setDescription(changeEvent.target.value)
            }
            maxLength={2000}
            rows={3}
          />
        </div>

        <div className="calendar-form-field">
          <label htmlFor="calendar-event-project">
            Project
          </label>

          <select
            id="calendar-event-project"
            value={projectId}
            onChange={(changeEvent) =>
              setProjectId(changeEvent.target.value)
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
        </div>

        <div className="calendar-form-actions">
          {isEditing && (
            <button
              type="button"
              className="calendar-form-delete"
              onClick={() => onDelete(event)}
              disabled={saving}
            >
              Delete
            </button>
          )}

          <div className="calendar-form-actions-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              className="calendar-save-button"
              type="submit"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default EventFormDialog
