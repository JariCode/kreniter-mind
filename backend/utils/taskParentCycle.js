const Task = require('../models/Task')

// Walks up a task's parentTaskId chain (scoped to the given user) and
// returns true if taskId appears anywhere in that chain — i.e. making
// candidateParent the parent of taskId would create a cycle. The visited
// set guards against an infinite loop if the existing data already has one.
//
// Used by both taskRoutes.js (PATCH /:id) and the AI Assistant's
// update_task tool, so the cycle rule can never drift between the two.
async function wouldCreateParentCycle(userId, taskId, candidateParent) {
  const visited = new Set()
  let currentParentId = candidateParent.parentTaskId

  while (currentParentId) {
    const currentParentIdString = String(currentParentId)

    if (currentParentIdString === String(taskId)) {
      return true
    }

    if (visited.has(currentParentIdString)) {
      break
    }

    visited.add(currentParentIdString)

    const currentParent = await Task.findOne({
      _id: currentParentId,
      userId,
    })

    if (!currentParent) {
      break
    }

    currentParentId = currentParent.parentTaskId
  }

  return false
}

module.exports = { wouldCreateParentCycle }
