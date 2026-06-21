import { useState, useCallback } from 'react';

// 可拖拽的图表类型定义
export const CHART_TYPES = {
  RADAR: 'radar',
  RANKING: 'ranking',
  LYRIC_WORDCLOUD: 'lyric_wordcloud',
  MAP: 'map',
  SENTIMENT: 'sentiment',
  TOPIC: 'topic',
  ERA_PIE: 'era_pie',
  ERA_TREND: 'era_trend',
  GROUPED_BAR: 'grouped_bar',
  SCATTER: 'scatter',
  BUBBLE: 'bubble',
};

// 图表配置信息
export const CHART_CONFIG = {
  [CHART_TYPES.RADAR]: { icon: '📋', title: '多歌手指标对比 (雷达图)', span: 1 },
  [CHART_TYPES.RANKING]: { icon: '🔥', title: 'Top10 歌曲评论数排名', span: 1 },
  [CHART_TYPES.LYRIC_WORDCLOUD]: { icon: '☁️', title: 'Top10歌曲歌词词云', span: 2 },
  [CHART_TYPES.MAP]: { icon: '🗺️', title: '歌手归属地热力地图', span: 3 },
  [CHART_TYPES.SENTIMENT]: { icon: '😊', title: '评论情感分析', span: 1 },
  [CHART_TYPES.TOPIC]: { icon: '🏷️', title: '评论主题聚类', span: 2 },
  [CHART_TYPES.ERA_PIE]: { icon: '🥧', title: '歌曲年代分布占比', span: 1 },
  [CHART_TYPES.ERA_TREND]: { icon: '📈', title: '各歌手年代趋势', span: 1 },
  [CHART_TYPES.GROUPED_BAR]: { icon: '📊', title: '歌手核心指标分组对比', span: 1 },
  [CHART_TYPES.SCATTER]: { icon: '🎯', title: '歌曲数 vs 专辑数 (散点图)', span: 1 },
  [CHART_TYPES.BUBBLE]: { icon: '🎯', title: '歌曲数 × 热度 (气泡图)', span: 2 },
};

export function useDragDrop() {
  const [activePanelId, setActivePanelId] = useState(null);
  const [dragOverPanelId, setDragOverPanelId] = useState(null);
  const [panelOrder, setPanelOrder] = useState([
    CHART_TYPES.RADAR,
    CHART_TYPES.RANKING,
    CHART_TYPES.LYRIC_WORDCLOUD,
    CHART_TYPES.MAP,
    CHART_TYPES.SENTIMENT,
    CHART_TYPES.TOPIC,
  ]);

  // 开始拖拽
  const handleDragStart = useCallback((e, panelId) => {
    setActivePanelId(panelId);
    e.dataTransfer.setData('text/plain', panelId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setActivePanelId(null);
    setDragOverPanelId(null);
  }, []);

  // 拖拽进入
  const handleDragOver = useCallback((e, panelId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverPanelId !== panelId) {
      setDragOverPanelId(panelId);
    }
  }, [dragOverPanelId]);

  // 拖拽离开
  const handleDragLeave = useCallback((e) => {
    // 只有真正离开面板区域才清除
    const relatedTarget = e.relatedTarget;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverPanelId(null);
    }
  }, []);

  // 放置
  const handleDrop = useCallback((e, targetPanelId) => {
    e.preventDefault();
    const sourcePanelId = e.dataTransfer.getData('text/plain');

    if (!sourcePanelId) {
      setActivePanelId(null);
      setDragOverPanelId(null);
      return;
    }

    setPanelOrder(prev => {
      const newOrder = [...prev];
      const sourceIndex = newOrder.indexOf(sourcePanelId);

      // 如果拖拽到网格空白区域（targetPanelId === 'grid'）
      if (targetPanelId === 'grid') {
        // 如果图表不在网格中，添加到末尾
        if (sourceIndex === -1) {
          newOrder.push(sourcePanelId);
        }
        // 如果图表已在网格中，不做任何操作（已经在网格里了）
        return newOrder;
      }

      // 拖拽到某个面板上
      const targetIndex = newOrder.indexOf(targetPanelId);

      if (sourceIndex === -1) {
        // 新图表，插入到目标位置
        if (targetIndex !== -1) {
          newOrder.splice(targetIndex, 0, sourcePanelId);
        } else {
          // 目标不存在，添加到末尾
          newOrder.push(sourcePanelId);
        }
      } else if (targetIndex !== -1 && sourceIndex !== targetIndex) {
        // 已有图表重排序
        newOrder.splice(sourceIndex, 1);
        const newTargetIndex = newOrder.indexOf(targetPanelId);
        newOrder.splice(newTargetIndex, 0, sourcePanelId);
      }

      return newOrder;
    });

    setActivePanelId(null);
    setDragOverPanelId(null);
  }, []);

  // 从菜单添加到网格
  const handleAddFromMenu = useCallback((panelId) => {
    setPanelOrder(prev => {
      if (prev.includes(panelId)) return prev;
      return [...prev, panelId];
    });
  }, []);

  // 从网格移除
  const handleRemoveFromGrid = useCallback((panelId) => {
    setPanelOrder(prev => prev.filter(id => id !== panelId));
  }, []);

  // 重置到默认布局
  const handleResetLayout = useCallback(() => {
    setPanelOrder([
      CHART_TYPES.RADAR,
      CHART_TYPES.RANKING,
      CHART_TYPES.LYRIC_WORDCLOUD,
      CHART_TYPES.MAP,
      CHART_TYPES.SENTIMENT,
      CHART_TYPES.TOPIC,
    ]);
  }, []);

  return {
    activePanelId,
    dragOverPanelId,
    panelOrder,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleAddFromMenu,
    handleRemoveFromGrid,
    handleResetLayout,
  };
}
