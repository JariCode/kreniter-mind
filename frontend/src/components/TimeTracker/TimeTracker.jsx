import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { createTimeEntry } from '../../api/timeEntries'
import {
  createActiveTimer,
  deleteActiveTimer,
  getActiveTimer,
  updateActiveTimer,
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
      createActiveTimer(newTimer).catch((err) => {
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

      const updatedTimer = {
        ...currentTimer,
        elapsedMs:
          currentTimer.elapsedMs +
          (currentTime -
            currentTimer.segmentStartedAt),
        segmentStartedAt: null,
        status: 'paused',
      }

      updateActiveTimer({
        elapsedMs: updatedTimer.elapsedMs,
        segmentStartedAt: null,
        status: 'paused',
      }).catch((err) => {
        console.error(
          'Failed to pause active timer:',
          err
        )

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

      const updatedTimer = {
        ...currentTimer,
        segmentStartedAt: currentTime,
        status: 'running',
      }

      updateActiveTimer({
        segmentStartedAt:
          new Date(currentTime).toISOString(),
        status: 'running',
      }).catch((err) => {
        console.error(
          'Failed to resume active timer:',
          err
        )

        setError(
          err.message ||
            'Failed to resume active timer.'
        )
      })

      return updatedTimer
    })

    setNow(Date.now())
  }, [])

  const cancelTimer = useCallback(async () => {
    if (!timer) {
      return
    }

    try {
      setError('')

      await deleteActiveTimer()

      setTimer(null)
    } catch (err) {
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

    const finalElapsedMs = getElapsedMs(
      timer,
      Date.now()
    )

    const durationInMinutes =
      finalElapsedMs > 0
        ? Math.max(
            1,
            Math.round(finalElapsedMs / 60000)
          )
        : 0

    setIsSaving(true)
    setError('')

    try {
      const savedEntry = await createTimeEntry({
        projectId: timer.projectId,
        taskId: timer.taskId,
        description: timer.description,
        duration: durationInMinutes,
        startedAt: timer.startedAt,
      })

      await deleteActiveTimer()

      setTimer(null)

      // Ilmoitetaan muille komponenteille,
      // että palvelimella oleva tracked time muuttui.
      setTimeEntriesVersion(
        (version) => version + 1
      )

      return savedEntry
    } catch (err) {
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