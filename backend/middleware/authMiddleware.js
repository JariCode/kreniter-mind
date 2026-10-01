const { getAuth, clerkClient } = require('@clerk/express')
const User = require('../models/User')

async function authMiddleware(req, res, next) {
  const { isAuthenticated, userId: clerkId } = getAuth(req)

  if (!isAuthenticated || !clerkId) {
    return res.status(401).json({
      error: 'Unauthorized',
    })
  }

  try {
    // Try a plain update first (no upsert): for a returning user this is the
    // same single query the old code ran, so the common case pays no extra
    // cost. A null result means there is no local record for this clerkId
    // yet -- true for a genuine first sign-in, but it also describes a
    // just-deleted Clerk account for the few seconds its last session token
    // stays cryptographically valid (Clerk's SDK verifies that token's
    // signature and expiry locally, with no network call, so deleting the
    // account doesn't invalidate an already-issued token the instant it
    // happens). Those two cases are indistinguishable from our own database
    // alone, so Clerk's Backend API -- the authoritative source -- is asked
    // whether the account still exists before ever creating a row for it.
    let user = await User.findOneAndUpdate(
      { clerkId },
      { clerkId },
      {
        returnDocument: 'after',
      }
    )

    if (!user) {
      try {
        await clerkClient.users.getUser(clerkId)
      } catch (error) {
        if (error.status === 404) {
          return res.status(401).json({
            error: 'Unauthorized',
          })
        }

        throw error
      }

      user = await User.findOneAndUpdate(
        { clerkId },
        { clerkId },
        {
          returnDocument: 'after',
          upsert: true,
          setDefaultsOnInsert: true,
        }
      )
    }

    req.user = user

    next()
  } catch (error) {
    next(error)
  }
}

module.exports = authMiddleware