import {
  getDayAriaLabel,
  getEventsForDay,
  getTaskMarkersForDay,
  taskMarkerLabel,
  taskMarkerVariantClassName,
} from './calendarItems'
import {
  getISOWeek,
  getMonthGrid,
  isSameDay,
  WEEKDAY_LABELS,
} from './calendarDates'

function DayCell({
  day,
  isCurrentMonth,
  isToday,
  events,
  taskMarkers,
  maxEventsPerDay,
  onSelectEvent,
  onAddEvent,
  onShowEventTooltip,
  onShowTaskTooltip,
  onHideTooltip,
}) {
  const visibleEvents = events.slice(0, maxEventsPerDay)
  const hiddenEventCount = events.length - visibleEvents.length

  const visibleTasks = taskMarkers.slice(0, maxEventsPerDay)
  const hiddenTaskCount =
    taskMarkers.length - visibleTasks.length

  return (
    <div
      className={`calendar-day-cell ${
        isCurrentMonth ? '' : 'is-outside'
      } ${isToday ? 'is-today' : ''}`}
      onClick={() => onAddEvent(day)}
    >
      <button
        type="button"
        className="calendar-day-number"
        aria-current={isToday ? 'date' : undefined}
        aria-label={getDayAriaLabel(day, events, taskMarkers)}
        onClick={(event) => {
          event.stopPropagation()
          onAddEvent(day)
        }}
      >
        {day.getDate()}
      </button>

      <div className="calendar-day-items">
        {visibleEvents.map((calendarEvent) => (
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

        {hiddenEventCount > 0 && (
          <span className="calendar-more">
            +{hiddenEventCount} more
          </span>
        )}

        {visibleTasks.map(({ task, kind }) => (
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

        {hiddenTaskCount > 0 && (
          <span className="calendar-more">
            +{hiddenTaskCount} more
          </span>
        )}
      </div>
    </div>
  )
}

function MonthView({
  anchorDate,
  today,
  events,
  taskMarkers,
  maxEventsPerDay,
  onSelectEvent,
  onAddEvent,
  onShowEventTooltip,
  onShowTaskTooltip,
  onHideTooltip,
}) {
  const weeks = getMonthGrid(
    anchorDate.getFullYear(),
    anchorDate.getMonth()
  )

  return (
    <div className="calendar-month">
      <div className="calendar-month-header">
        <span className="calendar-week-number-header" />

        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="calendar-weekday-label">
            {label}
          </span>
        ))}
      </div>

      {weeks.map((week) => (
        <div
          className="calendar-month-week"
          key={week[0].toISOString()}
        >
          <span className="calendar-week-number">
            {getISOWeek(week[0]).week}
          </span>

          {week.map((day) => (
            <DayCell
              key={day.toISOString()}
              day={day}
              isCurrentMonth={
                day.getMonth() === anchorDate.getMonth()
              }
              isToday={isSameDay(day, today)}
              events={getEventsForDay(events, day)}
              taskMarkers={getTaskMarkersForDay(taskMarkers, day)}
              maxEventsPerDay={maxEventsPerDay}
              onSelectEvent={onSelectEvent}
              onAddEvent={onAddEvent}
              onShowEventTooltip={onShowEventTooltip}
              onShowTaskTooltip={onShowTaskTooltip}
              onHideTooltip={onHideTooltip}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default MonthView
