// Keeps a task's status consistent with its startDate/completedDate,
// regardless of which route or tool is changing it (POST/PATCH
// /api/tasks, the AI Assistant's task tools) -- mirrors
// frontend/src/utils/taskStatusDates.js's resolveTaskStatusDates exactly.
// `today` is injected so a single call site reuses the same "today" value
// for every field it fills in.
function resolveTaskStatusDates({ status, startDate, completedDate }, today) {
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

module.exports = {
  resolveTaskStatusDates,
}
