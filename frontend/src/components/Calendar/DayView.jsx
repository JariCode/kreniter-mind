import {
  getEventsForDay,
  getTaskMarkersForDay,
  taskMarkerLabel,
  taskMarkerVariantClassName,
} from './calendarItems'

function DayView({
  anchorDate,
  events,
  tasks,
  onSelectEvent,
  onAddEvent,
  onShowEventTooltip,
  onShowTaskTooltip,
  onHideTooltip,
}) {
  const dayEvents = getEventsForDay(events, anchorDate)
  const taskMarkers = getTaskMarkersForDay(tasks, anchorDate)

  const allDayEvents = dayEvents.filter(
    (event) => event.allDay
  )
  const timedEvents = dayEvents.filter(
    (event) => !event.allDay
  )

  const isEmpty =
    dayEvents.length === 0 && taskMarkers.length === 0

  return (
    <div
      className="calendar-day"
      onClick={() => onAddEvent(anchorDate)}
    >
      {isEmpty && (
        <p className="calendar-day-empty">
          Nothing scheduled. Click to add an event.
        </p>
      )}

      {allDayEvents.map((calendarEvent) => (
        <button
          key={calendarEvent._id}
          type="button"
          className="calendar-event-pill calendar-day-list-item"
          onClick={(event) => {
            event.stopPropagation()
            onSelectEvent(calendarEvent)
          }}
          onMouseEnter={(event) =>
            onShowEventTooltip(calendarEvent, event)
          }
          onMouseLeave={onHideTooltip}
          onFocus={(event) =>
            onShowEventTooltip(calendarEvent, event)
          }
          onBlur={onHideTooltip}
        >
          <span className="calendar-event-time">
            All day
          </span>
          {calendarEvent.title}
        </button>
      ))}

      {taskMarkers.map(({ task, kind }) => (
        <button
          key={`${kind}-${task._id}`}
          type="button"
          className={`calendar-task-marker calendar-day-list-item ${taskMarkerVariantClassName(
            kind
          )}`}
          onClick={(event) => event.stopPropagation()}
          onMouseEnter={(event) =>
            onShowTaskTooltip(task, kind, event)
          }
          onMouseLeave={onHideTooltip}
          onFocus={(event) =>
            onShowTaskTooltip(task, kind, event)
          }
          onBlur={onHideTooltip}
        >
          {taskMarkerLabel(kind)}
          {task.title}
        </button>
      ))}

      {timedEvents.map((calendarEvent) => (
        <button
          key={calendarEvent._id}
          type="button"
          className="calendar-event-pill calendar-event-timed calendar-day-list-item"
          onClick={(event) => {
            event.stopPropagation()
            onSelectEvent(calendarEvent)
          }}
          onMouseEnter={(event) =>
            onShowEventTooltip(calendarEvent, event)
          }
          onMouseLeave={onHideTooltip}
          onFocus={(event) =>
            onShowEventTooltip(calendarEvent, event)
          }
          onBlur={onHideTooltip}
        >
          <span className="calendar-event-time">
            {calendarEvent.startTime}–{calendarEvent.endTime}
          </span>
          {calendarEvent.title}
        </button>
      ))}
    </div>
  )
}

export default DayView
