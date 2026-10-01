const express = require('express')
const { verifyWebhook } = require('@clerk/express/webhooks')
const User = require('../models/User')
const { deleteAllUserData } = require('../utils/deleteUserData')

const router = express.Router()

// Clerk signs the webhook body (HMAC via Svix) over the exact raw bytes it
// sent, so this route needs its own raw-body parser instead of the app-wide
// express.json() -- by the time a shared JSON parser ran, the body would
// already be re-serialized and the signature would no longer match. This is
// also why the route is mounted ahead of the app-wide json/sanitize
// middleware in server.js, and does not go through authMiddleware: the
// request isn't an authenticated user action, it's Clerk calling us.
router.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    try {
      if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
        console.error(
          'CLERK_WEBHOOK_SIGNING_SECRET is not set; refusing Clerk webhook request'
        )

        return res.status(500).json({
          error: 'Webhook is not configured',
        })
      }

      let event

      try {
        event = await verifyWebhook(req)
      } catch (error) {
        console.error(
          'Clerk webhook signature verification failed:',
          error.message
        )

        return res.status(400).json({
          error: 'Invalid signature',
        })
      }

      if (event.type !== 'user.deleted') {
        return res.status(200).json({
          received: true,
        })
      }

      const clerkId = event.data.id

      if (!clerkId) {
        return res.status(200).json({
          received: true,
        })
      }

      const user = await User.findOne({ clerkId })

      if (!user) {
        return res.status(200).json({
          received: true,
        })
      }

      const deletedCounts = await deleteAllUserData(
        user._id
      )

      // Counts only -- never log the clerkId or any other identifying
      // detail about the account that was just deleted.
      console.log(
        'Deleted all data for a deleted Clerk account:',
        deletedCounts
      )

      return res.status(200).json({
        received: true,
      })
    } catch (error) {
      next(error)
    }
  }
)

module.exports = router
