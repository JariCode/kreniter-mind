const Task = require('../models/Task')

// Moves every descendant of taskId (its subtasks, and their subtasks, and
// so on) into newProjectId, scoped to the given user, so a task's own
// project change can never leave part of its subtree behind in the old
// project.
//
// Used by both taskRoutes.js (PATCH /:id) and the AI Assistant's
// update_task tool (confirm-time execution), so the cascade can never
// drift between the two.
//
// visited mirrors taskParentCycle.js's loop guard: each task is moved at
// most once, even if the existing data already has a parentTaskId cycle.
async function cascadeProjectToSubtasks(userId, taskId, newProjectId) {
  const visited = new Set([String(taskId)])
  let frontierIds = [taskId]

  while (frontierIds.length > 0) {
    const children = await Task.find({
      userId,
      parentTaskId: { $in: frontierIds },
    })

    const nextFrontierIds = []

    for (const child of children) {
      const childId = String(child._id)

      if (visited.has(childId)) {
        continue
      }

      visited.add(childId)
      nextFrontierIds.push(child._id)
    }

    if (nextFrontierIds.length === 0) {
      break
    }

    await Task.updateMany(
      { _id: { $in: nextFrontierIds } },
      { $set: { projectId: newProjectId } }
    )

    frontierIds = nextFrontierIds
  }
}

module.exports = { cascadeProjectToSubtasks }
