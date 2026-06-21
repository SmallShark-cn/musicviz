import React from 'react';
import { CHART_CONFIG, CHART_TYPES } from '../hooks/useDragDrop';

const ALL_CHARTS = Object.entries(CHART_CONFIG).map(([id, config]) => ({
  id,
  ...config,
}));

export default function ChartMenu({
  activePanelId,
  panelOrder,
  onDragStart,
  onDragEnd,
  onAddToGrid,
  onRemoveFromGrid,
  onResetLayout,
  isMenuOpen,
  onToggleMenu,
}) {
  return (
    <>
      {/* 菜单切换按钮 */}
      <button
        onClick={onToggleMenu}
        className="chart-menu-toggle"
        title="图表管理"
      >
        📊
      </button>

      {/* 侧边菜单 */}
      <div className={`chart-menu ${isMenuOpen ? 'open' : ''}`}>
        <div className="chart-menu-header">
          <h3>📊 图表管理</h3>
          <button onClick={onToggleMenu} className="chart-menu-close">
            ✕
          </button>
        </div>

        <div className="chart-menu-content">
          <p className="chart-menu-tip">
            💡 点击图表添加/移除，或拖拽到主区域
          </p>

          {/* 可添加的图表列表 */}
          <div className="chart-menu-section">
            <h4>📋 可用图表</h4>
            <div className="chart-menu-list">
              {ALL_CHARTS.map((chart) => {
                const isInGrid = panelOrder.includes(chart.id);
                return (
                  <div
                    key={chart.id}
                    className={`chart-menu-item ${isInGrid ? 'in-grid' : 'available'}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', chart.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={onDragEnd}
                    onClick={() => {
                      if (isInGrid) {
                        onRemoveFromGrid(chart.id);
                      } else {
                        onAddToGrid(chart.id);
                      }
                    }}
                  >
                    <span className="chart-menu-item-icon">{chart.icon}</span>
                    <span className="chart-menu-item-title">{chart.title}</span>
                    {isInGrid ? (
                      <button
                        className="chart-menu-item-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromGrid(chart.id);
                        }}
                        title="移除"
                      >
                        ×
                      </button>
                    ) : (
                      <span className="chart-menu-item-add">+</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 当前网格中的图表 */}
          <div className="chart-menu-section">
            <h4>🎯 当前布局 ({panelOrder.length}个)</h4>
            <div className="chart-menu-list">
              {panelOrder.length === 0 ? (
                <div className="chart-menu-empty">暂无图表，请从上方添加</div>
              ) : (
                panelOrder.map((chartId, index) => {
                  const chart = CHART_CONFIG[chartId];
                  if (!chart) return null;
                  return (
                    <div
                      key={chartId}
                      className={`chart-menu-item in-grid ${activePanelId === chartId ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', chartId);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={onDragEnd}
                    >
                      <span className="chart-menu-item-index">{index + 1}</span>
                      <span className="chart-menu-item-icon">{chart.icon}</span>
                      <span className="chart-menu-item-title">{chart.title}</span>
                      <button
                        className="chart-menu-item-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromGrid(chartId);
                        }}
                        title="移除"
                      >
                        ×
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 重置按钮 */}
          <button className="chart-menu-reset" onClick={onResetLayout}>
            🔄 重置默认布局
          </button>
        </div>
      </div>

      {/* 遮罩层 */}
      {isMenuOpen && (
        <div className="chart-menu-overlay" onClick={onToggleMenu} />
      )}
    </>
  );
}
