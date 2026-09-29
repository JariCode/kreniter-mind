import { useEffect, useState } from 'react'
import {
  updateCalendarEvent,
  deleteCalendarEvent,
} from '../../api/calendarEvents'
import { getCalendarItems } from '../../api/calendar'
import { getProjects } from '../../api/projects'
import {
  formatWeekdayDate,
  getISOWeek,
  toDateKey,
  toDateOnly,
} from '../Calendar/calendarDates'
import {
  getEventsForDay,
  getTaskMarkersForDay,
  findProjectName,
  taskMarkerLabel,
  taskMarkerVariantClassName,
} from '../Calendar/calendarItems'
import {
  EventTooltipContent,
  TaskTooltipContent,
} from '../Calendar/CalendarTooltipContent'
import HoverTooltip from '../Tooltip/HoverTooltip'
import { getTooltipPosition } from '../Tooltip/tooltipPosition'
import EventFormDialog from '../Calendar/EventFormDialog'
import '../Calendar/Calendar.css'
import './CalendarWidget.css'

const MAX_ITEMS = 5

// Ticks once immediately at the next full minute, then every minute
// after that, so the clock never drifts out of sync with the wall clock.
function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let intervalId = null

    const msUntilNextMinute =
      60000 - (Date.now() % 60000)

    const timeoutId = window.setTimeout(() => {
      setNow(new Date())

      intervalId = window.setInterval(() => {
        setNow(new Date())
      }, 60000)
    }, msUntilNextMinute)

    return () => {
      window.clearTimeout(timeoutId)

      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [])

  return now
}

// The dashboard's Calendar widget: a clock plus a compact agenda of
// today's events and due/starting tasks. The full Day/Week/Month
// calendar (with navigation and the month/year picker) is page-only --
// this widget only ever shows "today", reusing the same shared date
// math, tooltip and event-editing form as the Calendar page so none of
// that logic is duplicated.
function CalendarWidget({ onViewAll }) {
  const now = useClock()
  const today = toDateOnly(now)
  const todayKey = toDateKey(today)

  const [events, setEvents] = useState([])
  const [taskDates, setTaskDates] = useState([])
  const [projects, setProjects] = useState([])
  const [error, setError] = useState('')
  const [editingEvent, setEditingEvent] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [eventToDelete, setEventToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadTodayItems() {
      try {
        const data = await getCalendarItems(
          today,
          today
        )

        if (!cancelled) {
          setEvents(data.events)
          setTaskDates(data.taskDates)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      }
    }

    loadTodayItems()

    return () => {
      cancelled = true
    }
    // Re-fetches only when the calendar day actually changes (midnight
    // rollover), not on every per-minute clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey])

  useEffect(() => {
    async function loadProjects() {
      try {
        const projectsData = await getProjects()

        setProjects(projectsData)
      } catch (err) {
        setError(err.message)
      }
    }

    loadProjects()
  }, [])

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

  // Keeps the widget in sync when a calendar event is created, updated or
  // deleted elsewhere -- in particular when the AI Assistant confirms one
  // of its calendar actions while this widget is visible on the dashboard.
  useEffect(() => {
    function handleCalendarEventsChanged() {
      refreshCalendarItems()
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
  }, [todayKey])

  async function refreshCalendarItems() {
    const data = await getCalendarItems(today, today)
    setEvents(data.events)
    setTaskDates(data.taskDates)
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

  async function handleSaveEvent(data) {
    try {
      setSaving(true)
      setFormError('')

      await updateCalendarEvent(editingEvent._id, data)
      await refreshCalendarItems()

      setEditingEvent(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleRequestDelete(event) {
    setEditingEvent(null)
    setEventToDelete(event)
  }

  async function confirmDeleteEvent() {
    if (!eventToDelete) {
      return
    }

    try {
      setDeleting(true)

      await deleteCalendarEvent(eventToDelete._id)
      await refreshCalendarItems()

      setEventToDelete(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')

  const dateLabel = formatWeekdayDate(now)

  const { week } = getISOWeek(now)

  const todaysEvents = getEventsForDay(events, today)
  const allDayEvents = todaysEvents.filter(
    (event) => event.allDay
  )
  const timedEvents = todaysEvents.filter(
    (event) => !event.allDay
  )
  const taskMarkers = getTaskMarkersForDay(taskDates, today)

  const items = [
    ...allDayEvents.map((event) => ({
      type: 'event',
      key: event._id,
      event,
    })),
    ...taskMarkers.map(({ task, kind }) => ({
      type: 'task',
      key: `${kind}-${task._id}`,
      task,
      kind,
    })),
    ...timedEvents.map((event) => ({
      type: 'event',
      key: event._id,
      event,
    })),
  ]

  const visibleItems = items.slice(0, MAX_ITEMS)
  const hiddenCount = items.length - visibleItems.length

  return (
    <div className="calendar-widget">
      <div className="panel-header">
        <button type="button" onClick={onViewAll}>
          View all
        </button>
      </div>

      <div className="calendar-widget-clock">
        <time
          className="calendar-widget-time"
          dateTime={now.toISOString()}
        >
          {hours}:{minutes}
        </time>

        <div className="calendar-widget-clock-details">
          <time dateTime={now.toISOString()}>
            {dateLabel}
          </time>
          <span>Week {week}</span>
        </div>
      </div>

      {error && (
        <p className="calendar-error">{error}</p>
      )}

      {items.length === 0 ? (
        <p className="calendar-widget-empty">
          No events today
        </p>
      ) : (
        <div className="calendar-widget-agenda">
          {visibleItems.map((item) =>
            item.type === 'event' ? (
              <button
                key={item.key}
                type="button"
                className={`calendar-event-pill ${
                  item.event.allDay
                    ? ''
                    : 'calendar-event-timed'
                }`}
                onClick={() =>
                  setEditingEvent(item.event)
                }
                onMouseEnter={(domEvent) =>
                  showEventTooltip(item.event, domEvent)
                }
                onMouseLeave={hideTooltip}
                onFocus={(domEvent) =>
                  showEventTooltip(item.event, domEvent)
                }
                onBlur={hideTooltip}
              >
                {!item.event.allDay && (
                  <span className="calendar-event-time">
                    {item.event.startTime}
                  </span>
                )}
                {item.event.title}
              </button>
            ) : (
              <button
                key={item.key}
                type="button"
                className={`calendar-task-marker ${taskMarkerVariantClassName(
                  item.kind
                )}`}
                onClick={(domEvent) =>
                  domEvent.preventDefault()
                }
                onMouseEnter={(domEvent) =>
                  showTaskTooltip(
                    item.task,
                    item.kind,
                    domEvent
                  )
                }
                onMouseLeave={hideTooltip}
                onFocus={(domEvent) =>
                  showTaskTooltip(
                    item.task,
                    item.kind,
                    domEvent
                  )
                }
                onBlur={hideTooltip}
              >
                {taskMarkerLabel(item.kind)}
                {item.task.title}
              </button>
            )
          )}

          {hiddenCount > 0 && (
            <span className="calendar-more">
              +{hiddenCount} more
            </span>
          )}
        </div>
      )}

      {editingEvent && (
        <EventFormDialog
          event={editingEvent}
          defaultDate={today}
          projects={projects}
          saving={saving}
          serverError={formError}
          onSave={handleSaveEvent}
          onDelete={handleRequestDelete}
          onClose={() => setEditingEvent(null)}
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
            aria-labelledby="calendar-widget-delete-dialog-title"
            onClick={(clickEvent) =>
              clickEvent.stopPropagation()
            }
          >
            <span className="delete-dialog-kicker">
              CONFIRM ACTION
            </span>

            <h3 id="calendar-widget-delete-dialog-title">
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
}

export default CalendarWidget
