const express = require('express')
const { buildCalendarItems } = require('../utils/calendarItems')

const router = express.Router()

// The combined calendar view (CalendarEvent rows plus task start/due/
// completed markers) for a date range, used by the Calendar page, the
// dashboard widget, and the AI Assistant's list_calendar_events tool, so
// all three see exactly the same calendar.
router.get('/items', async (req, res, next) => {
  try {
    const result = await buildCalendarItems(
      req.user._id,
      req.query.from,
      req.query.to
    )

    if (result.error) {
      return res.status(400).json({ error: result.error })
    }

    res.json(result)
  } catch (error) {
    next(error)
  }
})

module.exports = router
