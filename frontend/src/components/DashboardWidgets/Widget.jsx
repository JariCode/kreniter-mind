import './Widget.css'

function Widget({
  widget,
  onRemove,
  onDragStart,
  onDrop,
}) {
  function handleDragStart(event) {
    onDragStart(event, widget.id)
  }

  function handleDrop(event) {
    onDrop(event, widget.id)
  }

  return (
    <article
      className={`dashboard-widget ${
        widget.width === 8
          ? 'widget-wide'
          : widget.width === 6
            ? 'widget-six'
            : widget.width === 3
              ? 'widget-third'
              : 'widget-stat'
      }`}
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
    </article>
  )
}

export default Widget