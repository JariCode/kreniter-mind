import { createPortal } from 'react-dom'

// Shared hover/focus tooltip renderer, originally written for the
// Timeline page. Portals tooltip content to document.body, positioned
// with position: fixed at the given coordinates (see getTooltipPosition
// in tooltipPosition.js for how left/top/placement are computed).
// `containerClassName` should be a page-specific base class (styled by
// that page's own CSS, e.g. "timeline-tooltip-container");
// "is-above"/"is-below" is appended to it automatically to match
// `placement`.
function HoverTooltip({
  left,
  top,
  placement,
  containerClassName,
  children,
}) {
  return createPortal(
    <div
      className={`${containerClassName} is-${placement}`}
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      {children}
    </div>,
    document.body
  )
}

export default HoverTooltip
