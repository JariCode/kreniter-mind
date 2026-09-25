const express = require('express')
const TasksView = require('../models/TasksView')

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
    const selectedProjectId =
      req.body.selectedProjectId || null

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
          new: true,
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