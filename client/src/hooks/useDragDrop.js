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
  YEARLY_TREND: 'yearly_trend',
  GROUPED_BAR: 'grouped_bar',
  PLAYS_TREND: 'plays_trend',
  STYLE_PIE: 'style_pie',
  STYLE_HEATMAP: 'style_heatmap',
  ALBUM_DONUT: 'album_donut',
  STACKED_ERA: 'stacked_era',
  SCATTER: 'scatter',
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
  [CHART_TYPES.YEARLY_TREND]: { icon: '📈', title: '各歌手年度产出趋势', span: 2 },
  [CHART_TYPES.GROUPED_BAR]: { icon: '📊', title: '歌手核心指标分组对比', span: 2 },
  [CHART_TYPES.PLAYS_TREND]: { icon: '📉', title: '播放量排名衰减曲线', span: 1 },
  [CHART_TYPES.STYLE_PIE]: { icon: '🎵', title: '风格标签分布占比', span: 1 },
  [CHART_TYPES.STYLE_HEATMAP]: { icon: '🌡️', title: '风格-粉丝数相关性热力图', span: 2 },
  [CHART_TYPES.ALBUM_DONUT]: { icon: '💿', title: '热门专辑评论占比', span: 1 },
  [CHART_TYPES.STACKED_ERA]: { icon: '📚', title: '不同时期音乐风格演变', span: 2 },
  [CHART_TYPES.SCATTER]: { icon: '🎯', title: '粉丝数 vs 评论数 (散点图)', span: 1 },
};

// 默认布局：15张图
const DEFAULT_LAYOUT = [
  CHART_TYPES.RADAR,
  CHART_TYPES.RANKING,
  CHART_TYPES.GROUPED_BAR,
  CHART_TYPES.YEARLY_TREND,
  CHART_TYPES.LYRIC_WORDCLOUD,
  CHART_TYPES.ERA_PIE,
  CHART_TYPES.PLAYS_TREND,
  CHART_TYPES.SCATTER,
  CHART_TYPES.MAP,
  CHART_TYPES.STYLE_PIE,
  CHART_TYPES.STYLE_HEATMAP,
  CHART_TYPES.ALBUM_DONUT,
  CHART_TYPES.STACKED_ERA,
  CHART_TYPES.SENTIMENT,
  CHART_TYPES.TOPIC,
];

export function useDragDrop() {
  const [activePanelId, setActivePanelId] = useState(null);
  const [dragOverPanelId, setDragOverPanelId] = useState(null);
  const [panelOrder, setPanelOrder] = useState([...DEFAULT_LAYOUT]);

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

      if (targetPanelId === 'grid') {
        if (sourceIndex === -1) {
          newOrder.push(sourcePanelId);
        }
        return newOrder;
      }

      const targetIndex = newOrder.indexOf(targetPanelId);

      if (sourceIndex === -1) {
        if (targetIndex !== -1) {
          newOrder.splice(targetIndex, 0, sourcePanelId);
        } else {
          newOrder.push(sourcePanelId);
        }
      } else if (targetIndex !== -1 && sourceIndex !== targetIndex) {
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
    setPanelOrder([...DEFAULT_LAYOUT]);
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
