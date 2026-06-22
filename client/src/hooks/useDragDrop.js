import { useState, useCallback } from 'react';

// 可拖拽的面板类型定义
export const PANEL_TYPES = {
  // 固定面板（不可拖拽）
  COMPARE: 'compare',

  // 可拖拽面板
  ARTIST_INFO: 'artist_info',
  HOT_SEARCH: 'hot_search',
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
  ALBUM_DONUT: 'album_donut',
  STACKED_ERA: 'stacked_era',
  SCATTER: 'scatter',
};

// 面板配置信息
export const PANEL_CONFIG = {
  [PANEL_TYPES.ARTIST_INFO]: { icon: '📝', title: '歌手简介', span: 3 },
  [PANEL_TYPES.HOT_SEARCH]: { icon: '🔥', title: '实时热搜榜', span: 1 },
  [PANEL_TYPES.RADAR]: { icon: '📋', title: '多歌手指标对比 (雷达图)', span: 1 },
  [PANEL_TYPES.RANKING]: { icon: '🔥', title: 'Top10 歌曲评论数排名', span: 1 },
  [PANEL_TYPES.LYRIC_WORDCLOUD]: { icon: '☁️', title: 'Top10歌曲歌词词云', span: 1 },
  [PANEL_TYPES.MAP]: { icon: '🗺️', title: '歌手归属地热力地图', span: 1 },
  [PANEL_TYPES.SENTIMENT]: { icon: '😊', title: '评论情感分析', span: 1 },
  [PANEL_TYPES.TOPIC]: { icon: '🏷️', title: '评论主题聚类', span: 1 },
  [PANEL_TYPES.ERA_PIE]: { icon: '🥧', title: '歌曲年代分布占比', span: 1 },
  [PANEL_TYPES.YEARLY_TREND]: { icon: '📈', title: '各歌手年度产出趋势', span: 1 },
  [PANEL_TYPES.GROUPED_BAR]: { icon: '📊', title: '歌手核心指标分组对比', span: 1 },
  [PANEL_TYPES.PLAYS_TREND]: { icon: '📉', title: '播放量排名衰减曲线', span: 1 },
  [PANEL_TYPES.STYLE_PIE]: { icon: '🎵', title: '风格标签分布占比', span: 1 },
  [PANEL_TYPES.ALBUM_DONUT]: { icon: '💿', title: '热门专辑评论占比', span: 1 },
  [PANEL_TYPES.STACKED_ERA]: { icon: '📚', title: '不同时期音乐风格演变', span: 1 },
  [PANEL_TYPES.SCATTER]: { icon: '🎯', title: '粉丝数 vs 评论数 (散点图)', span: 1 },
};

// 默认布局
const DEFAULT_LAYOUT = [
  PANEL_TYPES.ARTIST_INFO,
  PANEL_TYPES.HOT_SEARCH,
  PANEL_TYPES.RADAR,
  PANEL_TYPES.RANKING,
  PANEL_TYPES.GROUPED_BAR,
  PANEL_TYPES.YEARLY_TREND,
  PANEL_TYPES.LYRIC_WORDCLOUD,
  PANEL_TYPES.ERA_PIE,
  PANEL_TYPES.PLAYS_TREND,
  PANEL_TYPES.SCATTER,
  PANEL_TYPES.MAP,
  PANEL_TYPES.STYLE_PIE,
  PANEL_TYPES.ALBUM_DONUT,
  PANEL_TYPES.STACKED_ERA,
  PANEL_TYPES.SENTIMENT,
  PANEL_TYPES.TOPIC,
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
