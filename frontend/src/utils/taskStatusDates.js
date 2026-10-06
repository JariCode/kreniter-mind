// Keeps a task's status consistent with its startDate/completedDate,
// regardless of which UI path changed it (the edit form, the card's status
// menu, or drag-and-drop between board columns). `today` is injected so a
// single call site can reuse the same "today" string/Date for every field
// it fills in.
export function resolveTaskStatusDates(
  { status, startDate, completedDate },
  today
) {
  if (status === 'completed') {
    return {
      status,
      startDate: startDate || today,
      completedDate: completedDate || today,
    }
  }

  if (status === 'in-progress') {
    return {
      status,
      startDate: startDate || today,
      completedDate: null,
    }
  }

  return {
    status: status || 'todo',
    startDate: startDate || null,
    completedDate: null,
  }
}

// The status implied by editing the Completed date field directly: giving
// it a value always means the task is completed, clearing it while the
// task was completed drops it back to in-progress. Any other status is
// left as-is -- this only models the completed-date shortcut.
export function statusAfterCompletedDateChange(
  currentStatus,
  nextCompletedDate
) {
  if (nextCompletedDate) {
    return 'completed'
  }

  if (currentStatus === 'completed') {
    return 'in-progress'
  }

  return currentStatus
}
