import React from 'react';

export default function DraggablePanel({
  panelId,
  children,
  className = '',
  bodyClassName,
  icon,
  title,
  isDragOver,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onRemove,
  dragHandleClass = 'panel-header',
}) {
  const getClassNames = () => {
    let classes = `panel ${className}`;
    if (isDragOver) classes += ' drag-over';
    if (isDragging) classes += ' dragging';
    return classes;
  };

  return (
    <div
      className={getClassNames()}
      draggable
      onDragStart={(e) => onDragStart(e, panelId)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, panelId)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, panelId)}
    >
      <div className={dragHandleClass}>
        <span className="panel-title">
          <span className="panel-title-icon">{icon}</span>
          {title}
        </span>
        {onRemove && (
          <button
            className="panel-remove-btn"
            onClick={() => onRemove(panelId)}
            title="从布局移除"
          >
            ×
          </button>
        )}
      </div>
      <div className={`panel-body ${bodyClassName || ''}`}>
        {children}
      </div>
    </div>
  );
}
