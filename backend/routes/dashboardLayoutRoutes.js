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

// Every widget type the dashboard actually knows how to render (see
// widgetDefinitions in MainContent.jsx). Kept in sync with that list by
// hand, since the two can't easily share a module across frontend/backend.
const ALLOWED_WIDGET_TYPES = new Set([
  'projects',
  'tasks',
  'tracked-time',
  'recent-projects',
  'timeline',
  'time',
  'notes',
  'ai-assistant',
  'calendar',
])

const MAX_WIDGETS = 20

function isValidWidgetList(widgets) {
  return (
    widgets.length <= MAX_WIDGETS &&
    widgets.every(
      (widget) =>
        typeof widget === 'string' &&
        ALLOWED_WIDGET_TYPES.has(widget)
    )
  )
}

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

    if (!isValidWidgetList(widgets)) {
      return res.status(400).json({
        error: 'Invalid widgets',
      })
    }

    const layout = await DashboardLayout.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        widgets,
      },
      {
        returnDocument: 'after',
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