import './WidgetLibrary.css'

function WidgetLibrary({
  availableWidgets,
  onAddWidget,
}) {
  if (availableWidgets.length === 0) {
    return null
  }

  return (
    <section className="widget-library">
      <div className="widget-library-header">
        <span className="widget-library-kicker">
          DASHBOARD
        </span>

        <span className="widget-library-label">
          Add widget
        </span>
      </div>

      <div className="widget-library-list">
        {availableWidgets.map((widget) => (
          <button
            key={widget.type}
            className="widget-library-item"
            type="button"
            onClick={() => onAddWidget(widget.type)}
          >
            <span className="widget-library-icon">
              +
            </span>

            <span>
              {widget.title}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default WidgetLibrary