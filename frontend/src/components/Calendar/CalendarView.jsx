import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../../api/calendarEvents'
import { getTasks } from '../../api/tasks'
import { getProjects } from '../../api/projects'
import HoverTooltip from '../Tooltip/HoverTooltip'
import { getTooltipPosition } from '../Tooltip/tooltipPosition'
import {
  addDays,
  addMonths,
  formatFullDate,
  formatMonthYear,
  getISOWeek,
  getMonthGrid,
  startOfWeek,
  toDateOnly,
} from './calendarDates'
import {
  EventTooltipContent,
  TaskTooltipContent,
} from './CalendarTooltipContent'
import { findProjectName } from './calendarItems'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayView from './DayView'
import EventFormDialog from './EventFormDialog'
import MonthYearPicker from './MonthYearPicker'
import './Calendar.css'

const VIEWS = ['month', 'week', 'day']

function readStoredView(storageKey) {
  try {
    const stored = window.localStorage.getItem(storageKey)
    return VIEWS.includes(stored) ? stored : 'month'
  } catch {
    return 'month'
  }
}

function writeStoredView(storageKey, view) {
  try {
    window.localStorage.setItem(storageKey, view)
  } catch {
    // Storage can be unavailable (private browsing, quota); the view
    // just won't be remembered next time, which is fine.
  }
}

// Shared calendar logic and views (Day/Week/Month), used by both the
// Calendar page and the dashboard's Calendar widget so the behavior
// never has to be duplicated.
const CalendarView = forwardRef(function CalendarView(
  {
    storageKey,
    maxEventsPerDay,
    compact,
    showAddButton = true,
  },
  ref
) {
  const [view, setView] = useState(() =>
    readStoredView(storageKey)
  )
  const [anchorDate, setAnchorDate] = useState(() =>
    toDateOnly(new Date())
  )
  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formDialog, setFormDialog] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [eventToDelete, setEventToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tooltip, setTooltip] = useState(null)

  const today = useMemo(() => toDateOnly(new Date()), [])

  const range = useMemo(() => {
    if (view === 'day') {
      return { from: anchorDate, to: anchorDate }
    }

    if (view === 'week') {
      const from = startOfWeek(anchorDate)
      return { from, to: addDays(from, 6) }
    }

    const grid = getMonthGrid(
      anchorDate.getFullYear(),
      anchorDate.getMonth()
    )

    return {
      from: grid[0][0],
      to: grid[grid.length - 1][6],
    }
  }, [view, anchorDate])

  useEffect(() => {
    let cancelled = false

    async function loadEvents() {
      try {
        setLoading(true)
        setError('')

        const data = await getCalendarEvents(
          range.from,
          range.to
        )

        if (!cancelled) {
          setEvents(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadEvents()

    return () => {
      cancelled = true
    }
  }, [range])

  useEffect(() => {
    async function loadTasksAndProjects() {
      try {
        const [tasksData, projectsData] = await Promise.all([
          getTasks(),
          getProjects(),
        ])

        setTasks(tasksData)
        setProjects(projectsData)
      } catch (err) {
        setError(err.message)
      }
    }

    loadTasksAndProjects()
  }, [])

  // Closes an open tooltip on Escape, matching every other dialog/popover
  // in the app.
  useEffect(() => {
    if (!tooltip) {
      return
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setTooltip(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [tooltip])

  async function refreshEvents() {
    const refreshed = await getCalendarEvents(
      range.from,
      range.to
    )

    setEvents(refreshed)
  }

  // Keeps this view in sync when a calendar event is created, updated or
  // deleted elsewhere -- in particular when the AI Assistant confirms one
  // of its calendar actions while the Calendar page is open.
  useEffect(() => {
    function handleCalendarEventsChanged() {
      refreshEvents()
    }

    window.addEventListener(
      'calendar-events-changed',
      handleCalendarEventsChanged
    )

    return () => {
      window.removeEventListener(
        'calendar-events-changed',
        handleCalendarEventsChanged
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  function changeView(nextView) {
    setView(nextView)
    writeStoredView(storageKey, nextView)
  }

  function goToToday() {
    setAnchorDate(today)
  }

  function goToPrevious() {
    setAnchorDate((current) => {
      if (view === 'day') {
        return addDays(current, -1)
      }

      if (view === 'week') {
        return addDays(current, -7)
      }

      return addMonths(current, -1)
    })
  }

  function goToNext() {
    setAnchorDate((current) => {
      if (view === 'day') {
        return addDays(current, 1)
      }

      if (view === 'week') {
        return addDays(current, 7)
      }

      return addMonths(current, 1)
    })
  }

  function openCreateDialog(date) {
    setFormError('')
    setFormDialog({ mode: 'create', date: date || anchorDate })
  }

  useImperativeHandle(ref, () => ({
    openCreateDialog: () => openCreateDialog(anchorDate),
  }))

  function openEditDialog(event) {
    setFormError('')
    setFormDialog({ mode: 'edit', event })
  }

  async function handleSaveEvent(data) {
    try {
      setSaving(true)
      setFormError('')

      if (formDialog.mode === 'edit') {
        await updateCalendarEvent(
          formDialog.event._id,
          data
        )
      } else {
        await createCalendarEvent(data)
      }

      await refreshEvents()
      setFormDialog(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleRequestDelete(event) {
    setFormDialog(null)
    setEventToDelete(event)
  }

  async function confirmDeleteEvent() {
    if (!eventToDelete) {
      return
    }

    try {
      setDeleting(true)

      await deleteCalendarEvent(eventToDelete._id)

      await refreshEvents()
      setEventToDelete(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  function showEventTooltip(calendarEvent, domEvent) {
    const rect =
      domEvent.currentTarget.getBoundingClientRect()

    const { left, top, placement } =
      getTooltipPosition(rect)

    setTooltip({
      left,
      top,
      placement,
      content: (
        <EventTooltipContent
          event={calendarEvent}
          projectName={findProjectName(
            projects,
            calendarEvent.projectId
          )}
        />
      ),
    })
  }

  function showTaskTooltip(task, kind, domEvent) {
    const rect =
      domEvent.currentTarget.getBoundingClientRect()

    const { left, top, placement } =
      getTooltipPosition(rect)

    setTooltip({
      left,
      top,
      placement,
      content: (
        <TaskTooltipContent
          task={task}
          kind={kind}
          projectName={findProjectName(
            projects,
            task.projectId
          )}
        />
      ),
    })
  }

  function hideTooltip() {
    setTooltip(null)
  }

  function applyMonthYear(year, month) {
    setAnchorDate(toDateOnly(new Date(year, month, 1)))
    setPickerOpen(false)
  }

  const periodLabel = useMemo(() => {
    if (view === 'day') {
      return formatFullDate(anchorDate)
    }

    if (view === 'week') {
      const { week, year } = getISOWeek(anchorDate)
      return `Week ${week}, ${year}`
    }

    return formatMonthYear(anchorDate)
  }, [view, anchorDate])

  const sharedViewProps = {
    anchorDate,
    today,
    events,
    tasks,
    projects,
    maxEventsPerDay,
    onSelectEvent: openEditDialog,
    onAddEvent: openCreateDialog,
    onShowEventTooltip: showEventTooltip,
    onShowTaskTooltip: showTaskTooltip,
    onHideTooltip: hideTooltip,
  }

  return (
    <div
      className={`calendar-view ${
        compact ? 'is-compact' : ''
      }`}
    >
      <div className="calendar-toolbar">
        <div className="calendar-view-switcher" role="group" aria-label="Calendar view">
          {VIEWS.map((viewOption) => (
            <button
              key={viewOption}
              type="button"
              className="calendar-view-switcher-button"
              aria-pressed={view === viewOption}
              onClick={() => changeView(viewOption)}
            >
              {viewOption.charAt(0).toUpperCase() +
                viewOption.slice(1)}
            </button>
          ))}
        </div>

        <div className="calendar-nav">
          <button
            type="button"
            className="calendar-nav-button"
            onClick={goToPrevious}
            aria-label="Previous"
          >
            ‹
          </button>

          <button
            type="button"
            className="calendar-nav-today"
            onClick={goToToday}
          >
            Today
          </button>

          <button
            type="button"
            className="calendar-nav-button"
            onClick={goToNext}
            aria-label="Next"
          >
            ›
          </button>
        </div>

        <div className="calendar-period">
          <button
            type="button"
            className="calendar-period-label"
            onClick={() =>
              setPickerOpen((current) => !current)
            }
            aria-expanded={pickerOpen}
          >
            <span aria-live="polite">{periodLabel}</span>
          </button>

          {pickerOpen && (
            <MonthYearPicker
              year={anchorDate.getFullYear()}
              month={anchorDate.getMonth()}
              onSelect={applyMonthYear}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        {showAddButton && (
          <button
            type="button"
            className="calendar-add-button"
            onClick={() => openCreateDialog(anchorDate)}
          >
            + Add event
          </button>
        )}
      </div>

      {error && (
        <p className="calendar-error">{error}</p>
      )}

      <div className="calendar-body">
        {view === 'month' && (
          <MonthView {...sharedViewProps} />
        )}

        {view === 'week' && (
          <WeekView {...sharedViewProps} />
        )}

        {view === 'day' && (
          <DayView {...sharedViewProps} />
        )}
      </div>

      {loading && (
        <p className="calendar-loading">
          Loading calendar...
        </p>
      )}

      {formDialog && (
        <EventFormDialog
          event={
            formDialog.mode === 'edit'
              ? formDialog.event
              : null
          }
          defaultDate={
            formDialog.mode === 'create'
              ? formDialog.date
              : anchorDate
          }
          projects={projects}
          saving={saving}
          serverError={formError}
          onSave={handleSaveEvent}
          onDelete={handleRequestDelete}
          onClose={() => setFormDialog(null)}
        />
      )}

      {eventToDelete && (
        <div
          className="delete-dialog-overlay"
          onClick={() => {
            if (!deleting) {
              setEventToDelete(null)
            }
          }}
        >
          <div
            className="delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-delete-dialog-title"
            onClick={(clickEvent) =>
              clickEvent.stopPropagation()
            }
          >
            <span className="delete-dialog-kicker">
              CONFIRM ACTION
            </span>

            <h3 id="calendar-delete-dialog-title">
              Delete event?
            </h3>

            <p>
              Are you sure you want to delete{' '}
              <strong>{eventToDelete.title}</strong>?
              This action cannot be undone.
            </p>

            <div className="delete-dialog-actions">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                className="delete-dialog-confirm"
                type="button"
                onClick={confirmDeleteEvent}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tooltip && (
        <HoverTooltip
          left={tooltip.left}
          top={tooltip.top}
          placement={tooltip.placement}
          containerClassName="calendar-tooltip-container"
        >
          {tooltip.content}
        </HoverTooltip>
      )}
    </div>
  )
})

export default CalendarView
