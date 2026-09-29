import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  deleteActiveTimer,
  getActiveTimer,
  pauseActiveTimerAction,
  resumeActiveTimerAction,
  startActiveTimerAction,
  stopActiveTimerAction,
} from '../../api/activeTimer'

const TimeTrackerContext = createContext(null)

function getElapsedMs(timer, currentTime) {
  if (!timer) {
    return 0
  }

  if (timer.status === 'paused') {
    return timer.elapsedMs
  }

  if (!timer.segmentStartedAt) {
    return timer.elapsedMs
  }

  return (
    timer.elapsedMs +
    (currentTime - timer.segmentStartedAt)
  )
}

// A conflict response (409, or 404 meaning "no timer at all") carries the
// server's current state in `activeTimer` when it was caused by another
// tab/action changing the timer first. In that case the view should just
// reconcile to that state instead of showing an error.
function isReconcilableConflict(err) {
  return (
    (err.status === 409 || err.status === 404) &&
    err.data &&
    'activeTimer' in err.data
  )
}

function normalizeActiveTimer(timer) {
  if (!timer) {
    return null
  }

  return {
    ...timer,
    startedAt: timer.startedAt,
    segmentStartedAt: timer.segmentStartedAt
      ? new Date(timer.segmentStartedAt).getTime()
      : null,
    elapsedMs: Number(timer.elapsedMs) || 0,
  }
}

export function TimeTrackerProvider({ children }) {
  const [timer, setTimer] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [timeEntriesVersion, setTimeEntriesVersion] =
    useState(0)
  const broadcastChannelRef = useRef(null)

  // Haetaan aktiivinen timer tietokannasta sovelluksen käynnistyessä.
  useEffect(() => {
    let cancelled = false

    async function loadActiveTimer() {
      try {
        const savedTimer = await getActiveTimer()

        if (cancelled) {
          return
        }

        const normalizedTimer =
          normalizeActiveTimer(savedTimer)

        setTimer(normalizedTimer)

        if (normalizedTimer) {
          setNow(Date.now())
        }
      } catch (err) {
        if (cancelled) {
          return
        }

        console.error(
          'Failed to load active timer:',
          err
        )

        setError(
          err.message ||
            'Failed to load active timer.'
        )
      }
    }

    loadActiveTimer()

    return () => {
      cancelled = true
    }
  }, [])

  // Päivitetään käynnissä oleva timer kerran sekunnissa.
  useEffect(() => {
    if (!timer || timer.status !== 'running') {
      return
    }

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [timer?.status])

  const elapsedMs = getElapsedMs(timer, now)

  const elapsedSeconds = Math.floor(
    elapsedMs / 1000
  )

  const elapsedMinutes = elapsedMs / 60000

  const startTimer = useCallback(
    ({
      projectId = null,
      taskId = null,
      description = '',
    } = {}) => {
      if (timer) {
        return false
      }

      const currentTime = Date.now()

      const newTimer = {
        projectId: projectId || null,
        taskId: taskId || null,
        description: description || '',
        startedAt:
          new Date(currentTime).toISOString(),
        segmentStartedAt: currentTime,
        elapsedMs: 0,
        status: 'running',
      }

      setError('')
      setTimer(newTimer)
      setNow(currentTime)

      // Tallennetaan aktiivinen timer tietokantaan.
      startActiveTimerAction({
        taskId,
        projectId,
        description,
        now: currentTime,
      })
        .then((savedTimer) => {
          setTimer(normalizeActiveTimer(savedTimer))
          broadcastTimerChanged()
        })
        .catch((err) => {
          if (isReconcilableConflict(err)) {
            setTimer(
              normalizeActiveTimer(
                err.data.activeTimer
              )
            )

            return
          }

          console.error(
            'Failed to save active timer:',
            err
          )

          setTimer(null)

          setError(
            err.message ||
              'Failed to save active timer.'
          )
        })

      return true
    },
    [timer]
  )

  const pauseTimer = useCallback(() => {
    setTimer((currentTimer) => {
      if (
        !currentTimer ||
        currentTimer.status !== 'running'
      ) {
        return currentTimer
      }

      const currentTime = Date.now()
      const previousTimer = currentTimer

      const updatedTimer = {
        ...currentTimer,
        elapsedMs: getElapsedMs(
          currentTimer,
          currentTime
        ),
        segmentStartedAt: null,
        status: 'paused',
      }

      pauseActiveTimerAction(currentTime)
        .then((savedTimer) => {
          setTimer(normalizeActiveTimer(savedTimer))
          broadcastTimerChanged()
        })
        .catch((err) => {
          if (isReconcilableConflict(err)) {
            setTimer(
              normalizeActiveTimer(
                err.data.activeTimer
              )
            )

            return
          }

          console.error(
            'Failed to pause active timer:',
            err
          )

          setTimer(previousTimer)

          setError(
            err.message ||
              'Failed to pause active timer.'
          )
        })

      return updatedTimer
    })

    setNow(Date.now())
  }, [])

  const resumeTimer = useCallback(() => {
    setTimer((currentTimer) => {
      if (
        !currentTimer ||
        currentTimer.status !== 'paused'
      ) {
        return currentTimer
      }

      const currentTime = Date.now()
      const previousTimer = currentTimer

      const updatedTimer = {
        ...currentTimer,
        segmentStartedAt: currentTime,
        status: 'running',
      }

      resumeActiveTimerAction(currentTime)
        .then((savedTimer) => {
          setTimer(normalizeActiveTimer(savedTimer))
          broadcastTimerChanged()
        })
        .catch((err) => {
          if (isReconcilableConflict(err)) {
            setTimer(
              normalizeActiveTimer(
                err.data.activeTimer
              )
            )

            return
          }

          console.error(
            'Failed to resume active timer:',
            err
          )

          setTimer(previousTimer)

          setError(
            err.message ||
              'Failed to resume active timer.'
          )
        })

      return updatedTimer
    })

    setNow(Date.now())
  }, [])

  // Re-syncs from the server without pushing a local change to it, for
  // when the timer was changed elsewhere (e.g. a confirmed AI Assistant
  // timer action) and the dashboard/Tasks page just need to catch up.
  const refreshActiveTimer = useCallback(async () => {
    try {
      const savedTimer = await getActiveTimer()

      const normalizedTimer =
        normalizeActiveTimer(savedTimer)

      setTimer(normalizedTimer)

      if (normalizedTimer) {
        setNow(Date.now())
      }
    } catch (err) {
      console.error(
        'Failed to refresh active timer:',
        err
      )

      setError(
        err.message ||
          'Failed to refresh active timer.'
      )
    }
  }, [])

  // Catches up with the server when the tab was in the background and is
  // now visible/focused again, in case the timer changed while it wasn't.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshActiveTimer()
      }
    }

    function handleFocus() {
      refreshActiveTimer()
    }

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )
      window.removeEventListener('focus', handleFocus)
    }
  }, [refreshActiveTimer])

  // Instantly syncs tabs of the same browser: whenever one tab changes the
  // timer, it posts on this channel, and every other tab re-fetches.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return
    }

    const channel = new BroadcastChannel(
      'active-timer-sync'
    )

    broadcastChannelRef.current = channel

    channel.onmessage = () => {
      refreshActiveTimer()
    }

    return () => {
      channel.close()
      broadcastChannelRef.current = null
    }
  }, [refreshActiveTimer])

  function broadcastTimerChanged() {
    broadcastChannelRef.current?.postMessage('changed')
  }

  const cancelTimer = useCallback(async () => {
    if (!timer) {
      return
    }

    try {
      setError('')

      await deleteActiveTimer()

      setTimer(null)
      broadcastTimerChanged()
    } catch (err) {
      if (isReconcilableConflict(err)) {
        setTimer(
          normalizeActiveTimer(err.data.activeTimer)
        )

        return
      }

      console.error(
        'Failed to cancel active timer:',
        err
      )

      setError(
        err.message ||
          'Failed to cancel active timer.'
      )

      throw err
    }
  }, [timer])

  const stopTimer = useCallback(async () => {
    if (!timer || isSaving) {
      return null
    }

    setIsSaving(true)
    setError('')

    try {
      const {
        timeEntry: savedEntry,
        activeTimer: savedTimer,
      } = await stopActiveTimerAction(Date.now())

      setTimer(normalizeActiveTimer(savedTimer))
      broadcastTimerChanged()

      // Ilmoitetaan muille komponenteille,
      // että palvelimella oleva tracked time muuttui.
      setTimeEntriesVersion(
        (version) => version + 1
      )

      return savedEntry
    } catch (err) {
      if (isReconcilableConflict(err)) {
        setTimer(
          normalizeActiveTimer(err.data.activeTimer)
        )

        // Another tab already stopped it and saved the entry, so this
        // tab's own tracked-time views need to catch up too.
        setTimeEntriesVersion(
          (version) => version + 1
        )

        return null
      }

      console.error(
        'Failed to save time entry:',
        err
      )

      setError(
        err.message ||
          'Failed to save time entry.'
      )

      return null
    } finally {
      setIsSaving(false)
    }
  }, [timer, isSaving])

  const value = useMemo(
    () => ({
      activeTimer: timer,
      elapsedMs,
      elapsedSeconds,
      elapsedMinutes,
      isSaving,
      error,
      timeEntriesVersion,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      cancelTimer,
      refreshActiveTimer,
    }),
    [
      timer,
      elapsedMs,
      elapsedSeconds,
      elapsedMinutes,
      isSaving,
      error,
      timeEntriesVersion,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      cancelTimer,
      refreshActiveTimer,
    ]
  )

  return (
    <TimeTrackerContext.Provider value={value}>
      {children}
    </TimeTrackerContext.Provider>
  )
}

export function useTimeTracker() {
  const context = useContext(TimeTrackerContext)

  if (!context) {
    throw new Error(
      'useTimeTracker must be used inside TimeTrackerProvider'
    )
  }

  return context
}