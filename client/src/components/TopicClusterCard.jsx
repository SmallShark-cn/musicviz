import { useEffect, useState } from 'react';

const TopicClusterCard = ({ songId, songName }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopic, setExpandedTopic] = useState(null);

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
        console.error('获取主题聚类数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [songId]);

  const topicColors = [
    { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
    { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#3b82f6' },
    { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)', text: '#8b5cf6' },
    { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
    { bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' }
  ];

  const meaninglessKeywords = new Set([
    '', ' ', '也', '很', '都', '就', '了', '的', '是', '在', '有', '和',
    '我', '你', '他', '她', '它', '我们', '你们', '他们', '它们',
    '这', '那', '这些', '那些', '什么', '怎么', '为什么', '因为', '所以',
    '但是', '然而', '虽然', '还是', '如果', '要是', '假如', '即使', '只要',
    '已经', '正在', '一直', '总是', '经常', '偶尔', '从来', '永远',
    '又', '再', '还', '更', '最', '十分', '完全', '全部',
    '可以', '能', '能够', '会', '应该', '必须', '得', '需要', '不用',
    '被', '把', '给', '让', '使', '叫',
    '出现', '存在', '发生', '进行', '得到', '失去', '成为', '变成',
    '开始', '结束', '继续', '停止', '离开', '回来', '上来', '下去',
    '好像', '仿佛', '似乎', '看来', '听说', '据说', '以为', '觉得',
    '所谓', '等等', '之类',
    '啊啊啊', '啊啊', '呜呜', '呜呜呜', '哈哈', '哈哈哈', '呵呵', '嘿嘿', '嘻嘻',
    '哭了', '笑了', '醉了', '晕了', '疯了', '傻了', '懵了', '无语',
    '这歌', '这首歌', '那首歌', '音乐', '歌', '歌曲', '曲子', '旋律', '歌词', '节奏', '声音', '音',
    '听', '听了', '听到', '听歌', '听着', '听完', '评论', '弹幕', '留言', '评论区',
    '喜欢', '爱', '爱了', '爱了爱了', '大爱', '超爱', '喜欢听', '喜欢这首歌',
    '好听', '好听哭', '太好听', '超级好听', '非常好听', '最好听', '好听爆了',
    '不好听', '难听', '太难听', '超级难听', '非常难听', '最难听',
    '经典', '神曲', '神作', '绝了', '绝绝子', 'YYDS', '永远的神',
    '回忆', '青春', '怀念', '想起', '记得', '忘记', '想起了', '回忆起',
    '感动', '泪目', '流泪', '心碎', '难过', '伤心', '难受',
    '开心', '快乐', '高兴', '幸福', '满足', '欣慰', '舒服', '爽',
    '牛逼', '厉害', '太强', '无敌', '炸裂', '神仙', '神级', '完美',
    '垃圾', '辣鸡', '糟', '差', '烂', '恶心', '失望', '翻车',
    '支持', '加油', '力挺', '守护', '陪伴', '感谢', '感恩', '祝福',
    '循环', '单曲循环', '百听不厌', '无限循环', '循环播放',
    '现场', 'live', '演唱会', '现场版', 'live版', '现场演唱',
    '原唱', '翻唱', '原唱版', '翻唱版', '版本', '不同版本',
    '专辑', 'EP', '单曲', '发行', '发布', '上线', '推出',
    'MV', '视频', '画面', '镜头', '剧情', '故事', '情节',
    '作词', '作曲', '编曲', '制作', '混音', '母带', '录音',
    '吉他', '钢琴', '贝斯', '鼓', '弦乐', '管乐', '电子', '合成器',
    '高音', '低音', '中音', '和声', '合唱', '独唱', '伴唱',
    '节奏', '节拍', '速度', '快慢', '旋律', '曲调', '曲风', '风格',
    '流行', '摇滚', '民谣', '爵士', '古典', '电子', '嘻哈', 'R&B',
    '悲伤', '欢快', '轻松', '沉重', '深情', '激情', '温柔', '震撼',
    '治愈', '温暖', '励志', '正能量', '感人', '走心', '戳心',
    '第一次', '第一遍', '第一次听', '第一次听到', '第一次发现',
    '最后', '最后一次', '最终', '终于', '总算', '终究', '毕竟',
    '一直', '始终', '从来', '总是', '经常', '偶尔', '有时候',
    '其实', '实际上', '事实上', '本质上', '基本上', '大体上',
    '总之', '总而言之', '总的来说', '一句话', '简单说',
    '看来', '看样子', '看起来', '看上去', '似乎', '好像', '仿佛',
    '听说', '据说', '据称', '据报道', '据了解', '据消息',
    '有人', '有人说', '有人认为', '有人觉得', '有人提到',
    '大家', '所有人', '每个人', '某些人', '一部分人', '不少人',
    '自己', '本人', '这里', '那里', '这边', '那边', '到处', '四处', '到处都是',
    '这样', '那样', '这么样', '那么样', '怎么样', '什么样',
    '多少', '几', '几个', '一些', '很多', '许多', '大量', '少量',
    '所有', '全部', '一切', '任何', '每一个', '各个', '各自',
    '其他', '另外', '别的', '其余', '剩下', '其余的', '另外的',
    '相同', '一样', '同样', '类似', '相似', '差不多', '大概',
    '不同', '不一样', '不同的', '不一样的', '有区别', '差别',
    '重要', '关键', '核心', '主要', '基本', '根本', '本质',
    '可能', '也许', '或许', '大概', '估计', '应该', '恐怕',
    '一定', '肯定', '必定', '必然', '务必', '必须', '应该',
    '不能', '不可以', '不可能', '不应该', '不需要', '没必要',
    '可以', '能够', '会', '可以的', '能够的', '会的',
    '需要', '想要', '希望', '期望', '渴望', '盼望', '期待',
    '愿意', '乐意', '甘心', '情愿', '宁愿', '宁可',
    '应该', '应当', '理应', '理当', '该', '不该',
    '必须', '务必', '一定得', '非得', '不得不',
    '可能', '不可能', '有可能', '可能性', '概率', '几率',
    '已经', '曾经', '不曾', '未曾', '从未', '至今',
    '正在', '正', '在', '正在进行', '正在发生',
    '将要', '即将', '快要', '就要', '准备', '打算',
    '会', '将会', '会的', '会有', '会是', '会成为',
    '可能会', '也许会', '或许会', '说不定', '大概会',
    '不会', '不可能', '不会是', '不会有', '不会成为',
    '能', '不能', '能不能', '能否', '是否能', '是否可以',
    '要', '不要', '要不要', '是否要', '是否需要',
    '得', '不得不', '得要', '得有', '得是',
    '应该', '不应该', '应该不', '是否应该', '该不该',
    '可以', '不可以', '可以不', '是否可以', '能不能够',
    '值得', '不值得', '是否值得', '值不值',
    '愿意', '不愿意', '是否愿意', '愿不愿意',
    '想', '不想', '想不想', '是否想', '要不要',
    '希望', '不希望', '是否希望', '希不希望',
    '喜欢', '不喜欢', '是否喜欢', '喜不喜欢',
    '爱', '不爱', '是否爱', '爱不爱',
    '恨', '不恨', '是否恨', '恨不恨',
    '相信', '不相信', '是否相信', '相不相信',
    '知道', '不知道', '是否知道', '知不知道',
    '了解', '不了解', '是否了解', '了不了解',
    '明白', '不明白', '是否明白', '明不明白',
    '理解', '不理解', '是否理解', '理不理解',
    '认为', '不认为', '是否认为', '认不认为',
    '觉得', '不觉得', '是否觉得', '觉不觉得',
    '感觉', '没感觉', '是否感觉', '感不感觉',
    '看到', '没看到', '是否看到', '看没看到',
    '听到', '没听到', '是否听到', '听没听到',
    '想到', '没想到', '是否想到', '想没想到',
    '做到', '没做到', '是否做到', '做没做到',
    '完成', '没完成', '是否完成', '完没完成',
    '实现', '没实现', '是否实现', '实没实现',
    '达到', '没达到', '是否达到', '达没达到',
    '超过', '没超过', '是否超过', '超没超过',
    '通过', '没通过', '是否通过', '通没通过',
    '得到', '没得到', '是否得到', '得没得到',
    '失去', '没失去', '是否失去', '失没失去',
    '获得', '没获得', '是否获得', '获没获得',
    '取得', '没取得', '是否取得', '取没取得',
    '成功', '没成功', '是否成功', '成没成功',
    '失败', '没失败', '是否失败', '失没失败',
    '赢', '没赢', '是否赢', '赢没赢',
    '输', '没输', '是否输', '输没输',
    '胜', '没胜', '是否胜', '胜没胜',
    '败', '没败', '是否败', '败没败',
    '好', '不好', '好不好', '是否好',
    '坏', '不坏', '坏不坏', '是否坏',
    '对', '不对', '对不对', '是否对',
    '错', '没错', '错没错', '是否错',
    '是', '不是', '是不是', '是否是',
    '有', '没有', '有没有', '是否有',
    '在', '不在', '在不在', '是否在',
    '存在', '不存在', '是否存在', '存不存在',
    '发生', '没发生', '是否发生', '发没发生',
    '出现', '没出现', '是否出现', '出没出现',
    '产生', '没产生', '是否产生', '产没产生',
    '形成', '没形成', '是否形成', '形没形成',
    '变成', '没变', '是否变成', '变没变成',
    '成为', '没成为', '是否成为', '成没成为',
    '开始', '没开始', '是否开始', '开没开始',
    '结束', '没结束', '是否结束', '结没结束',
    '继续', '没继续', '是否继续', '继没继续',
    '停止', '没停止', '是否停止', '停没停止',
    '进行', '没进行', '是否进行', '进没进行',
    '做', '没做', '做没做', '是否做',
    '干', '没干', '干没干', '是否干',
    '搞', '没搞', '搞没搞', '是否搞',
    '弄', '没弄', '弄没弄', '是否弄',
    '玩', '没玩', '玩没玩', '是否玩',
    '学', '没学', '学没学', '是否学',
    '看', '没看', '看没看', '是否看',
    '听', '没听', '听没听', '是否听',
    '说', '没说', '说没说', '是否说',
    '写', '没写', '写没写', '是否写',
    '读', '没读', '读没读', '是否读',
    '想', '没想', '想没想', '是否想',
    '吃', '没吃', '吃没吃', '是否吃',
    '喝', '没喝', '喝没喝', '是否喝',
    '睡', '没睡', '睡没睡', '是否睡',
    '走', '没走', '走没走', '是否走',
    '跑', '没跑', '跑没跑', '是否跑',
    '跳', '没跳', '跳没跳', '是否跳',
    '飞', '没飞', '飞没飞', '是否飞',
    '来', '没来', '来没来', '是否来',
    '去', '没去', '去没去', '是否去',
    '上', '没上', '上没上', '是否上',
    '下', '没下', '下没下', '是否下',
    '进', '没进', '进没进', '是否进',
    '出', '没出', '出没出', '是否出',
    '过', '没过', '过没过', '是否过',
    '回', '没回', '回没回', '是否回',
    '给', '没给', '给没给', '是否给',
    '拿', '没拿', '拿没拿', '是否拿',
    '放', '没放', '放没放', '是否放',
    '取', '没取', '取没取', '是否取',
    '送', '没送', '送没送', '是否送',
    '买', '没买', '买没买', '是否买',
    '卖', '没卖', '卖没卖', '是否卖',
    '借', '没借', '借没借', '是否借',
    '还', '没还', '还没还', '是否还',
    '欠', '没欠', '欠没欠', '是否欠',
    '赚', '没赚', '赚没赚', '是否赚',
    '赔', '没赔', '赔没赔', '是否赔',
  ]);

  const filterKeywords = (keywords) => {
    return keywords.filter(k => k && k.trim() && !meaninglessKeywords.has(k.trim()) && !meaninglessKeywords.has(k));
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        height: '100%',
        minHeight: '420px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner"></div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>正在提取评论主题...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.topics || data.topics.length === 0) {
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        height: '100%',
        minHeight: '420px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ color: 'var(--text-muted)' }}>暂无主题数据</p>
      </div>
    );
  }

  const totalComments = data.topics.reduce((sum, t) => sum + t.count, 0);

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius)',
      padding: '20px',
      minHeight: '420px',
      height: '100%'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <span style={{ fontSize: '20px' }}>🏷️</span>
        <div>
          <h3 style={{
            fontSize: '15px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            评论主题聚类
          </h3>
          {songName && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              {songName} · {data.topics.length}个主题 · {totalComments}条相关评论
            </p>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {data.topics.map((topic, index) => {
          const colors = topicColors[index % topicColors.length];
          const isExpanded = expandedTopic === topic.topic_id;
          const filteredKeywords = filterKeywords(topic.keywords);

          return (
            <div
              key={topic.topic_id}
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
                padding: '16px',
                borderLeft: `4px solid ${colors.text}`,
                transition: 'all 0.2s ease',
                maxHeight: isExpanded ? 'none' : '450px',
                overflow: 'hidden'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{
                    background: colors.text,
                    color: 'white',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    主题 {index + 1}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {topic.count}条评论
                  </span>
                </div>
                {topic.count > 3 && (
                  <button
                    onClick={() => setExpandedTopic(isExpanded ? null : topic.topic_id)}
                    style={{
                      background: colors.text,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}
                  >
                    {isExpanded ? '收起' : `查看全部 ${topic.count} 条`}
                  </button>
                )}
              </div>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '12px'
              }}>
                {filteredKeywords.length > 0 ? (
                  filteredKeywords.map((keyword, i) => (
                    <span
                      key={i}
                      style={{
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        color: colors.text,
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}
                    >
                      {keyword}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    暂无有效关键词
                  </span>
                )}
              </div>

              {topic.examples && topic.examples.length > 0 && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '10px',
                  marginTop: '10px'
                }}>
                  <p style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '6px'
                  }}>
                    📝 代表评论
                  </p>
                  <p style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {topic.examples[0]}
                  </p>
                </div>
              )}

              {isExpanded && topic.all_comments && topic.all_comments.length > 0 && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '12px',
                  maxHeight: '500px',
                  overflowY: 'auto'
                }}>
                  <p style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginBottom: '10px',
                    fontWeight: '500'
                  }}>
                    📋 全部 {topic.count} 条评论
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {topic.all_comments.map((comment, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          padding: '8px',
                          borderLeft: `2px solid ${colors.text}`
                        }}
                      >
                        <p style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.5',
                          margin: 0,
                          wordBreak: 'break-word'
                        }}>
                          {comment}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopicClusterCard;
