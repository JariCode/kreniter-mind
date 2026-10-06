const mongoose = require('mongoose')
const Project = require('../models/Project')

// Sentinel the Tasks and Time views store when "No project" is selected.
const NO_PROJECT = 'no-project'

// Validates the selectedProjectId used by the per-user view-selection
// routes (tasks/time/timeline/reports views). An empty value means "no
// project selected" and is allowed as-is. Views that store the "No project"
// option as a sentinel pass allowNoProject: true. Returns { error, status }
// when invalid, otherwise { selectedProjectId } normalized to null, the
// sentinel or the id.
async function validateSelectedProjectId(
  userId,
  rawSelectedProjectId,
  { allowNoProject = false } = {}
) {
  const selectedProjectId = rawSelectedProjectId || null

  if (!selectedProjectId) {
    return { selectedProjectId: null }
  }

  if (allowNoProject && selectedProjectId === NO_PROJECT) {
    return { selectedProjectId: NO_PROJECT }
  }

  if (!mongoose.Types.ObjectId.isValid(selectedProjectId)) {
    return { error: 'Invalid ID', status: 400 }
  }

  const project = await Project.findOne({
    _id: selectedProjectId,
    userId,
  })

  if (!project) {
    return { error: 'Project not found', status: 404 }
  }

  return { selectedProjectId }
}

module.exports = {
  validateSelectedProjectId,
}