import { useRef } from 'react'
import CalendarView from '../../components/Calendar/CalendarView'
import './Calendar.css'

function Calendar() {
  const calendarRef = useRef(null)

  return (
    <main className="calendar-page">
      <div className="calendar-header">
        <div>
          <span className="calendar-kicker">
            WORKSPACE
          </span>

          <h1 className="calendar-title">Calendar</h1>

          <p className="calendar-description">
            See your events and task dates in one
            place.
          </p>
        </div>

        <button
          type="button"
          className="calendar-add-button"
          onClick={() =>
            calendarRef.current?.openCreateDialog()
          }
        >
          + Add event
        </button>
      </div>

      <section className="calendar-workspace">
        <CalendarView
          ref={calendarRef}
          storageKey="calendar-view-page"
          maxEventsPerDay={4}
          showAddButton={false}
        />
      </section>
    </main>
  )
}

export default Calendar
