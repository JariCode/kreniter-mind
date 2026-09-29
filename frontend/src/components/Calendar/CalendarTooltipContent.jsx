import { statusLabel } from './calendarItems'
import { formatShortDate, formatWeekdayDate } from './calendarDates'

const DESCRIPTION_TRUNCATE_LENGTH = 140

function truncate(text) {
  if (!text || text.length <= DESCRIPTION_TRUNCATE_LENGTH) {
    return text
  }

  return `${text.slice(0, DESCRIPTION_TRUNCATE_LENGTH).trimEnd()}…`
}

export function EventTooltipContent({ event, projectName }) {
  const weekdayDate = formatWeekdayDate(new Date(event.date))

  return (
    <div className="calendar-tooltip">
      <strong>{event.title}</strong>

      <div className="calendar-tooltip-row">
        <span>
          {event.allDay
            ? `${weekdayDate}, All day`
            : `${weekdayDate}, ${event.startTime}–${event.endTime}`}
        </span>
      </div>

      {event.description && (
        <p className="calendar-tooltip-description">
          {truncate(event.description)}
        </p>
      )}

      <div className="calendar-tooltip-row">
        <span>Project</span>
        <span>{projectName || 'No project'}</span>
      </div>
    </div>
  )
}

export function TaskTooltipContent({ task, projectName, kind }) {
  return (
    <div className="calendar-tooltip">
      <strong>{task.title}</strong>

      <div className="calendar-tooltip-row">
        <span>Project</span>
        <span>{projectName || 'No project'}</span>
      </div>

      <div className="calendar-tooltip-row">
        <span>Status</span>
        <span>{statusLabel(task.status)}</span>
      </div>

      {task.startDate && (
        <div
          className={`calendar-tooltip-row${
            kind === 'start' ? ' calendar-tooltip-row-active' : ''
          }`}
        >
          <span>Start date</span>
          <span>{formatShortDate(new Date(task.startDate))}</span>
        </div>
      )}

      {task.dueDate && (
        <div
          className={`calendar-tooltip-row${
            kind === 'due' ? ' calendar-tooltip-row-active' : ''
          }`}
        >
          <span>Due date</span>
          <span>{formatShortDate(new Date(task.dueDate))}</span>
        </div>
      )}
    </div>
  )
}
