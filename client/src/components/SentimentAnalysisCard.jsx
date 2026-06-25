import { useEffect, useState, useRef } from 'react';
import * as echarts from 'echarts';

const SentimentAnalysisCard = ({ songId, songName }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!songId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analysis/combined/${songId}?limit=50`);
        const result = await response.json();
        if (result.code === 200) {
          setData(result.data);
        }
      } catch (error) {
        console.error('获取情感分析数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [songId]);

  useEffect(() => {
    if (!data || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    const { positive, neutral, negative } = data.sentiment || { positive: 0, neutral: 0, negative: 0 };

    // 获取带情感标签的评论
    const comments = data.comments || [];
    const positiveComments = comments.filter(c => c.sentiment === 'positive').slice(0, 3);
    const neutralComments = comments.filter(c => c.sentiment === 'neutral').slice(0, 3);
    const negativeComments = comments.filter(c => c.sentiment === 'negative').slice(0, 3);

    const commentMap = {
      '正面': positiveComments,
      '中性': neutralComments,
      '负面': negativeComments
    };

    const getCommentExamples = (sentiment) => {
      const examples = commentMap[sentiment] || [];
      if (examples.length === 0) return '';
      return examples.map(c => {
        // 过滤掉中括号中的表情文字，如[开心]、[大笑]等
        let content = (c.content || '').replace(/\[[^\]]+\]/g, '').trim();
        content = content.substring(0, 50);
        return `<div style="font-size:11px;color:#aaa;margin-top:4px;padding-left:8px;border-left:2px solid ${sentiment === '正面' ? '#10b981' : sentiment === '中性' ? '#3b82f6' : '#ef4444'}">"${content}${(c.content || '').replace(/\[[^\]]+\]/g, '').trim().length > 50 ? '...' : ''}"</div>`;
      }).join('');
    };

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const { name, value, percent } = params;
          const examples = getCommentExamples(name);
          return `<div style="font-size:13px;font-weight:600">${name}: ${value}条 (${percent}%)</div>
                  ${examples ? `<div style="margin-top:8px;font-size:12px;color:#888">代表评论:</div>${examples}` : ''}`;
        },
        backgroundColor: 'rgba(22, 28, 44, 0.95)',
        borderColor: '#1e2d45',
        textStyle: { color: '#e8eaed' },
        extraCssText: 'max-width: 280px;'
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#9ca3af' },
        itemWidth: 14,
        itemHeight: 14
      },
      series: [
        {
          name: '情感分布',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: 'var(--bg-card)',
            borderWidth: 3
          },
          label: {
            show: false
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#e8eaed'
            },
            itemStyle: {
              shadowBlur: 15,
              shadowColor: 'rgba(236, 65, 65, 0.4)'
            }
          },
          data: [
            { value: positive, name: '正面', itemStyle: { color: '#10b981' } },
            { value: neutral, name: '中性', itemStyle: { color: '#3b82f6' } },
            { value: negative, name: '负面', itemStyle: { color: '#ef4444' } }
          ]
        }
      ]
    };

    chart.setOption(option);

    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      chart.dispose();
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        minHeight: 0
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>正在分析评论情感...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.sentiment) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        minHeight: 0
      }}>
        <p style={{ color: 'var(--text-muted)' }}>暂无数据</p>
      </div>
    );
  }

  const { positive, neutral, negative } = data.sentiment;
  const total = positive + neutral + negative || 1;
  const positivePercent = ((positive / total) * 100).toFixed(1);
  const neutralPercent = ((neutral / total) * 100).toFixed(1);
  const negativePercent = ((negative / total) * 100).toFixed(1);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius)',
      padding: '14px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden',
      flex: 1
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexShrink: 0 }}>
        <span style={{ fontSize: '20px' }}>😊</span>
        <div>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            评论情感分析
          </h3>
          {songName && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {songName} · 共{total}条评论
            </p>
          )}
        </div>
      </div>

      <div ref={chartRef} style={{ flex: '1 1 0', minHeight: 0, width: '100%' }}></div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '10px',
        marginTop: '10px',
        flexShrink: 0
      }}>
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '8px',
          padding: '10px 8px',
          textAlign: 'center',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
            {positive}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            正面 {positivePercent}%
          </div>
        </div>
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          padding: '10px 8px',
          textAlign: 'center',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>
            {neutral}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            中性 {neutralPercent}%
          </div>
        </div>
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '8px',
          padding: '10px 8px',
          textAlign: 'center',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#ef4444' }}>
            {negative}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            负面 {negativePercent}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default SentimentAnalysisCard;
