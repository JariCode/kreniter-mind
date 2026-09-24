import './Widget.css'

function Widget({
  widget,
  onRemove,
  onDragStart,
  onDrop,
  onResize,
}) {
  function handleDragStart(event) {
    onDragStart(event, widget.id)
  }

  function handleDrop(event) {
    onDrop(event, widget.id)
  }

  function handleResizeStart(event) {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY
    const startWidth = widget.width
    const startHeight = widget.height

    function handleMouseMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY

      const widthChange = Math.round(deltaX / 80)
      const newWidth = Math.min(
        12,
        Math.max(3, startWidth + widthChange)
      )

      const newHeight = Math.max(
        180,
        startHeight + deltaY
      )

      onResize(widget.id, newWidth, newHeight)
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <article
      className="dashboard-widget"
      style={{
        gridColumn: `span ${widget.width}`,
        minHeight: `${widget.height}px`,
      }}
      draggable
      onDragStart={handleDragStart}
      onDrop={handleDrop}
    >
      <div className="widget-header">
        <div className="widget-title">
          <div>
            <span className="widget-kicker">
              {widget.kicker}
            </span>

            <h3>
              {widget.title}
            </h3>
          </div>
        </div>

        <div className="widget-actions">
          <span className="widget-drag-handle">
            ⋮⋮
          </span>

          <button
            className="widget-remove"
            type="button"
            onClick={() => onRemove(widget.id)}
            aria-label={`Remove ${widget.title}`}
          >
            ×
          </button>
        </div>
      </div>

      <div className="widget-content">
        {widget.content}
      </div>

      <div
        className="widget-resize-handle"
        onMouseDown={handleResizeStart}
        aria-hidden="true"
      />
    </article>
  )
}

export default Widget