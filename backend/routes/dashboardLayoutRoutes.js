const express = require('express')
const DashboardLayout = require('../models/DashboardLayout')

const router = express.Router()

const defaultWidgets = [
  'projects',
  'tasks',
  'tracked-time',
  'recent-projects',
  'ai-assistant',
]

router.get('/', async (req, res, next) => {
  try {
    let layout = await DashboardLayout.findOne({
      userId: req.user._id,
    })

    if (!layout) {
      layout = await DashboardLayout.create({
        userId: req.user._id,
        widgets: defaultWidgets,
      })
    }

    res.json(layout)
  } catch (error) {
    next(error)
  }
})

router.put('/', async (req, res, next) => {
  try {
    const widgets = req.body.widgets

    if (!Array.isArray(widgets)) {
      return res.status(400).json({
        error: 'Widgets must be an array',
      })
    }

    const layout = await DashboardLayout.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        widgets,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    )

    res.json(layout)
  } catch (error) {
    next(error)
  }
})

module.exports = router