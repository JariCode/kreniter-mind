import Widget from './Widget'
import './DashboardGrid.css'

function DashboardGrid({
  widgets,
  onRemoveWidget,
  onMoveWidget,
  onResizeWidget,
}) {
  function handleDragStart(event, widgetId) {
    event.dataTransfer.setData('text/plain', widgetId)
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(event) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(event, targetWidgetId) {
    event.preventDefault()

    const draggedWidgetId = event.dataTransfer.getData('text/plain')

    if (!draggedWidgetId || draggedWidgetId === targetWidgetId) {
      return
    }

    onMoveWidget(draggedWidgetId, targetWidgetId)
  }

  return (
    <section
      className="dashboard-widget-grid"
      onDragOver={handleDragOver}
    >
      {widgets.map((widget) => (
        <Widget
          key={widget.id}
          widget={widget}
          onRemove={onRemoveWidget}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onResize={onResizeWidget}
        />
      ))}
    </section>
  )
}

export default DashboardGrid