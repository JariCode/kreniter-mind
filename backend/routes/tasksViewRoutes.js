const express = require('express')
const TasksView = require('../models/TasksView')
const {
  validateSelectedProjectId,
} = require('../utils/viewSelectionValidation')

const router = express.Router()

router.get('/', async (req, res, next) => {
  try {
    let tasksView = await TasksView.findOne({
      userId: req.user._id,
    })

    if (!tasksView) {
      tasksView = await TasksView.create({
        userId: req.user._id,
        selectedProjectId: null,
      })
    }

    res.json(tasksView)
  } catch (error) {
    next(error)
  }
})

router.put('/', async (req, res, next) => {
  try {
    // The Tasks view stores "No project" as the 'no-project' sentinel.
    const validation = await validateSelectedProjectId(
      req.user._id,
      req.body.selectedProjectId,
      { allowNoProject: true }
    )

    if (validation.error) {
      return res.status(validation.status).json({
        error: validation.error,
      })
    }

    const { selectedProjectId } = validation

    const tasksView =
      await TasksView.findOneAndUpdate(
        {
          userId: req.user._id,
        },
        {
          userId: req.user._id,
          selectedProjectId,
        },
        {
          returnDocument: 'after',
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      )

    res.json(tasksView)
  } catch (error) {
    next(error)
  }
})

module.exports = router