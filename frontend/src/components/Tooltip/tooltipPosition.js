// Computes where to place a tooltip anchored to an element's bounding
// rect: centered horizontally (clamped to the viewport), and above the
// element unless there isn't enough room, in which case it flips below.
// Originally written for the Timeline page.

const FLIP_THRESHOLD = 120
const VERTICAL_GAP = 10
const HORIZONTAL_PADDING = 12

export function getTooltipPosition(rect, tooltipWidth = 210) {
  const center = rect.left + rect.width / 2

  const left = Math.min(
    Math.max(center, tooltipWidth / 2 + HORIZONTAL_PADDING),
    window.innerWidth - tooltipWidth / 2 - HORIZONTAL_PADDING
  )

  const placement =
    rect.top < FLIP_THRESHOLD ? 'below' : 'above'

  const top =
    placement === 'below'
      ? rect.bottom + VERTICAL_GAP
      : rect.top - VERTICAL_GAP

  return { left, top, placement }
}
