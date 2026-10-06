import { apiRequest } from './api'
import { toDateParam } from './calendarEvents'

// The combined calendar view for a date range -- CalendarEvent rows plus
// task start/due/completed markers, already merged server-side (the same
// aggregator the AI Assistant uses), so the Calendar page and widget never
// have to do that merging themselves.
export function getCalendarItems(from, to) {
  return apiRequest(
    `/calendar/items?from=${toDateParam(from)}&to=${toDateParam(to)}`
  )
}
