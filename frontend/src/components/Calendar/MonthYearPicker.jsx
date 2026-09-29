import { useEffect, useRef } from 'react'
import { MONTH_NAMES } from './calendarDates'

// Small popup for jumping directly to a month/year, opened by clicking
// the calendar's period label.
function MonthYearPicker({ year, month, onSelect, onClose }) {
  const containerRef = useRef(null)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    function handleOutsideClick(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      )
    }
  }, [onClose])

  function handleMonthChange(event) {
    onSelect(year, Number(event.target.value))
  }

  function handleYearChange(event) {
    const value = Number(event.target.value)

    if (Number.isFinite(value) && event.target.value) {
      onSelect(value, month)
    }
  }

  return (
    <div
      ref={containerRef}
      className="calendar-month-year-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-month-year-picker-title"
      onClick={(event) => event.stopPropagation()}
    >
      <span
        id="calendar-month-year-picker-title"
        className="calendar-picker-title"
      >
        Jump to
      </span>

      <div className="calendar-picker-row">
        <select
          value={month}
          onChange={handleMonthChange}
          aria-label="Month"
        >
          {MONTH_NAMES.map((name, index) => (
            <option key={name} value={index}>
              {name}
            </option>
          ))}
        </select>

        <input
          type="number"
          value={year}
          onChange={handleYearChange}
          aria-label="Year"
        />
      </div>
    </div>
  )
}

export default MonthYearPicker
