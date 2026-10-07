import {
  getDayAriaLabel,
  getEventsForDay,
  getTaskMarkersForDay,
  taskMarkerLabel,
  taskMarkerVariantClassName,
} from './calendarItems'
import { addDays, isSameDay, startOfWeek } from './calendarDates'

function WeekDayColumn({
  day,
  isToday,
  events,
  taskMarkers,
  onSelectEvent,
  onAddEvent,
  onShowEventTooltip,
  onShowTaskTooltip,
  onHideTooltip,
}) {
  const allDayEvents = events.filter((event) => event.allDay)
  const timedEvents = events.filter((event) => !event.allDay)

  return (
    <div
      className={`calendar-week-day ${
        isToday ? 'is-today' : ''
      }`}
    >
      <button
        type="button"
        className="calendar-day-number"
        aria-current={isToday ? 'date' : undefined}
        aria-label={getDayAriaLabel(day, events, taskMarkers)}
        onClick={() => onAddEvent(day)}
      >
        {day.toLocaleDateString('en-GB', {
          weekday: 'short',
        })}{' '}
        {day.getDate()}
      </button>

      <div
        className="calendar-week-day-items"
        onClick={() => onAddEvent(day)}
      >
        {allDayEvents.map((calendarEvent) => (
          <button
            key={calendarEvent._id}
            type="button"
            className="calendar-event-pill"
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
            {calendarEvent.title}
          </button>
        ))}

        {taskMarkers.map(({ task, kind }) => (
          <button
            key={`${kind}-${task._id}`}
            type="button"
            className={`calendar-task-marker ${taskMarkerVariantClassName(
              kind,
              task.status
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
            className="calendar-event-pill calendar-event-timed"
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
              {calendarEvent.startTime}
            </span>
            {calendarEvent.title}
          </button>
        ))}
      </div>
    </div>
  )
}

function WeekView({
  anchorDate,
  today,
  events,
  taskMarkers,
  onSelectEvent,
  onAddEvent,
  onShowEventTooltip,
  onShowTaskTooltip,
  onHideTooltip,
}) {
  const weekStart = startOfWeek(anchorDate)
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index)
  )

  return (
    <div className="calendar-week">
      {days.map((day) => (
        <WeekDayColumn
          key={day.toISOString()}
          day={day}
          isToday={isSameDay(day, today)}
          events={getEventsForDay(events, day)}
          taskMarkers={getTaskMarkersForDay(taskMarkers, day)}
          onSelectEvent={onSelectEvent}
          onAddEvent={onAddEvent}
          onShowEventTooltip={onShowEventTooltip}
          onShowTaskTooltip={onShowTaskTooltip}
          onHideTooltip={onHideTooltip}
        />
      ))}
    </div>
  )
}

export default WeekView
