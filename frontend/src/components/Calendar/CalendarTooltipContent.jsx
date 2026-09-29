import { statusLabel } from './calendarItems'

const DESCRIPTION_TRUNCATE_LENGTH = 140

function truncate(text) {
  if (!text || text.length <= DESCRIPTION_TRUNCATE_LENGTH) {
    return text
  }

  return `${text.slice(0, DESCRIPTION_TRUNCATE_LENGTH).trimEnd()}…`
}

export function EventTooltipContent({ event, projectName }) {
  return (
    <div className="calendar-tooltip">
      <strong>{event.title}</strong>

      <div className="calendar-tooltip-row">
        <span>
          {event.allDay
            ? 'All day'
            : `${event.startTime}–${event.endTime}`}
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

      <div className="calendar-tooltip-row">
        <span>{kind === 'due' ? 'Due date' : 'Start date'}</span>
      </div>
    </div>
  )
}
