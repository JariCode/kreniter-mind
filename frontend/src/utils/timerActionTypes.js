// AI Assistant action types that change the active timer, shared between
// Assistant.jsx and MainContent.jsx so both know when to re-sync the
// TimeTracker context after an action is confirmed.
export const TIMER_ACTION_TYPES = [
  'start_timer',
  'pause_timer',
  'resume_timer',
  'stop_timer',
]
