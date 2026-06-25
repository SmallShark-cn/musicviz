import os
import sys
import time

sys.path.insert(
    0,
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cloudmusic-master"
    ),
)

import re
from collections import Counter

import cloudmusic
import jieba
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer

# 初始化jieba
jieba.initialize()


# 情感分析
class SentimentAnalyzer:
    def __init__(self):
        self.positive_words = set(
            [
                "好听",
                "喜欢",
                "爱",
                "棒",
                "赞",
                "感动",
                "经典",
                "回忆",
                "青春",
                "好听哭",
                "神曲",
                "循环",
                "洗脑",
                "治愈",
                "温暖",
                "怀念",
                "完美",
                "永远",
                "支持",
                "加油",
                "优秀",
                "神级",
                "无敌",
                "炸裂",
                "神仙",
                "太好听",
                "超级好听",
                "非常好听",
                "最好听",
                "好听爆了",
                "永恒",
                "回忆杀",
                "青春回忆",
                "百听不厌",
                "单曲循环",
                "泪目",
                "哭了",
                "走心",
                "戳心",
                "触动",
                "共鸣",
                "厉害",
                "牛逼",
                "太强",
                "绝了",
                "绝绝子",
                "YYDS",
                "顶流",
                "爱了爱了",
                "大爱",
                "超爱",
                "深爱",
                "痴迷",
                "无瑕",
                "无可挑剔",
                "惊艳",
                "惊喜",
                "震撼",
                "力挺",
                "守护",
                "陪伴",
                "感谢",
                "感恩",
            ]
        )
        self.negative_words = set(
            [
                "难听",
                "垃圾",
                "难听死",
                "恶心",
                "糟糕",
                "失望",
                "难听哭",
                "退钱",
                "翻车",
                "无语",
                "尴尬",
                "毁了",
                "抄袭",
                "难听爆了",
                "太难听",
                "超级难听",
                "非常难听",
                "最难听",
                "辣鸡",
                "糟",
                "差",
                "烂",
                "想吐",
                "绝望",
                "心碎",
                "难受",
                "痛苦",
                "悲伤",
                "无奈",
                "丢人",
                "可笑",
                "滑稽",
                "糟蹋",
                "浪费",
                "可惜",
                "遗憾",
                "惋惜",
                "模仿",
                "照搬",
                "雷同",
                "山寨",
                "盗版",
            ]
        )

    def analyze(self, text):
        if not text or not isinstance(text, str):
            return {"sentiment": "neutral", "score": 0.5}

        text = str(text).lower()
        pos_count = sum(1 for word in self.positive_words if word in text)
        neg_count = sum(1 for word in self.negative_words if word in text)

        if pos_count > neg_count:
            return {
                "sentiment": "positive",
                "score": min(1.0, pos_count / (pos_count + neg_count + 1) * 2),
            }
        elif neg_count > pos_count:
            return {
                "sentiment": "negative",
                "score": min(1.0, neg_count / (pos_count + neg_count + 1) * 2),
            }
        else:
            return {"sentiment": "neutral", "score": 0.5}


# 主题聚类
class TopicCluster:
    """基于关键词的评论主题分类器"""
    def __init__(self):
        self.categories = {
            "情感/恋爱": [
                # 核心情感词
                "爱情", "恋爱", "分手", "失恋", "喜欢", "暗恋", "告白", "表白",
                "单身", "前任", "心动", "思念", "想念", "舍不得", "错过", "遗憾",
                "想见你", "在一起", "离开", "等你",
                # 关系角色
                "男友", "女友", "男朋友", "女朋友", "恋人", "对象", "老公", "老婆",
                "情侣", "初恋", "前男友", "前女友", "相亲", "未婚夫", "未婚妻",
                "蓝朋友", "女票", "男票", "另一半", "宝贝", "宝子",
                # 情感状态
                "相爱", "相恋", "暗恋", "表白", "求婚", "结婚", "嫁给我", "娶我",
                "在一起", "分开", "离别", "重逢", "异地", "异地恋", "网恋",
                # 行为动作
                "牵手", "拥抱", "接吻", "亲亲", "约会", "逛街", "看电影", "送花",
                "撒娇", "吃醋", "吵架", "和好", "原谅", "分手快乐", "单身节",
                # 情感形容词
                "甜蜜", "浪漫", "幸福", "幸福", "心动", "心碎", "心酸", "心累",
                "心痛", "心动", "心慌", "脸红", "心跳", "脸红心跳", "怦然心动",
            ],
            "考试/学业": [
                # 各类考试
                "考试", "高考", "中考", "考研", "考公", "公务员", "事业单位",
                "教资", "四六级", "英语四六级", "期末", "期中", "月考", "模拟考",
                "小升初", "初升高", "高考倒计时", "百日誓师", "誓师大会",
                # 学习行为
                "学习", "复习", "备考", "备考中", "背单词", "做题", "刷题",
                "自习", "上课", "下课", "课间", "网课", "网课学习",
                "作业", "写论文", "论文", "毕业设计", "答辩", "开题",
                # 考试结果
                "考完", "考过", "考砸", "挂科", "零分", "满分", "及格",
                "录取", "录取通知书", "落榜", "上岸", "上岸成功",
                "成绩", "分数", "成绩单", "排名", "年级第一", "全班第一",
                # 学校相关
                "毕业", "毕业季", "毕业典礼", "毕业照", "学校", "高中", "初中",
                "大学", "大学生活", "高中生活", "初中生活", "校园", "校园生活",
                "985", "211", "一本", "二本", "大专", "本科", "硕士", "博士",
                "填志愿", "志愿填报", "录取结果", "通知书",
            ],
            "职场/生活": [
                # 工作状态
                "工作", "上班", "下班", "加班", "996", "007", "内卷", "躺平",
                "摆烂", "摸鱼", "划水", "打工", "打工人", "打工仔", "社畜",
                "搬砖", "搬砖人", "打工人", "牛马", "牛马生活",
                # 求职跳槽
                "求职", "面试", "面试中", "面试完", "offer", "拿到offer",
                "跳槽", "换工作", "辞职", "辞职信", "离职", "被裁", "裁员",
                "试用期", "转正", "晋升", "升职", "加薪", "年终奖",
                # 职场关系
                "老板", "上司", "领导", "同事", "同事们", "HR", "hr",
                "甲方", "乙方", "客户", "对接", "汇报", "开会", "会议",
                # 城市生活
                "北漂", "沪漂", "深漂", "广漂", "杭漂", "漂泊", "异乡",
                "租房", "房东", "押金", "搬家", "通勤", "通勤路上",
                "房贷", "车贷", "信用卡", "花呗", "白条", "消费",
                # 生活状态
                "压力大", "压力", "焦虑", "焦虑症", "抑郁", "emo",
                "失眠", "熬夜", "脱发", "头秃", "猝死", "过劳",
            ],
            "青春/回忆": [
                # 青春年华
                "青春", "青春回忆", "青春啊", "青春不散", "青春再见",
                "回忆", "回忆杀", "回忆满满", "满满的回忆", "回忆过去",
                "年少", "少年", "少女", "少年时代", "学生时代",
                # 过去时光
                "小时候", "童年", "儿时", "幼年", "稚气", "童年回忆",
                "那年", "那年夏天", "那年秋天", "那年冬天", "那年春天",
                "以前", "从前", "当年", "当年那个", "曾经", "曾经的我",
                "过去", "过去的", "回不去", "回不去了", "再也回不去",
                "时光", "时光流逝", "岁月", "岁月如歌", "时光不老",
                # 校园回忆
                "校园", "校园生活", "校服", "校服照", "运动会", "军训",
                "迎新", "迎新晚会", "校庆", "毕业典礼", "毕业照", "毕业季",
                "下课", "放学", "课间操", "眼保健操", "广播体操",
                "同桌", "前桌", "后桌", "同班同学", "老同学", "校友",
            ],
            "友情/亲情": [
                # 友情
                "朋友", "好朋友", "好朋友啊", "好朋友", "最好的朋友",
                "闺蜜", "闺蜜情", "兄弟", "好兄弟", "兄弟情", "姐妹", "姐妹情",
                "哥们", "哥儿们", "死党", "发小", "青梅", "竹马",
                "室友", "舍友", "室友们", "同学", "同窗", "同班",
                "战友", "队友情", "同事情",
                # 亲情
                "家人", "家里人", "一家人", "家人闲坐", "灯火可亲",
                "父母", "爸妈", "爸爸妈妈", "父亲", "母亲", "爹妈",
                "爸爸", "妈妈", "父亲节", "母亲节",
                "爷爷", "奶奶", "外公", "外婆", "姥姥", "姥爷",
                "哥哥", "姐姐", "弟弟", "妹妹", "大哥", "大姐",
                "儿子", "女儿", "闺女", "小子",
                "团聚", "团圆", "回家", "回家过年", "回家吃饭", "回家看看",
                # 情感表达
                "陪伴", "陪伴是最长情的告白", "陪伴我", "一路陪伴",
                "想念", "思念", "牵挂", "挂念", "惦记", "记挂",
                "亲情的", "友情的", "家庭", "家人平安", "家人健康",
            ],
            "梦想/励志": [
                # 梦想追求
                "梦想", "我的梦想", "梦想成真", "追梦", "逐梦",
                "理想", "理想主义", "理想的", "信念", "信仰",
                "目标", "我的目标", "人生目标", "短期目标", "长期目标",
                "愿望", "心愿", "愿望清单", "新年愿望",
                # 励志态度
                "坚持", "坚持到底", "坚持不放弃", "永不言弃",
                "努力", "努力中", "努力奋斗", "努力生活", "继续努力",
                "加油", "加油鸭", "加油呀", "加油啊", "奥利给",
                "奋斗", "奋斗吧", "拼搏", "拼了", "拼一把",
                "勇敢", "勇气", "鼓起勇气", "勇往直前", "向前冲",
                "相信", "相信明天", "相信自己", "相信未来", "保持相信",
                # 励志表达
                "不放弃", "永不放弃", "不抛弃", "不抛弃不放弃",
                "向前", "向前看", "前行", "前进", "一路向前",
                "未来", "未来可期", "前途", "前途无量", "前程似锦",
                "一定行", "一定可以", "一定会", "一定成功", "一定实现",
                "发光", "发光发热", "闪闪发光", "活出自己", "做自己",
            ],
            "生活/日常": [
                # 时间状态
                "今天", "今天天气", "今天的", "今日", "今儿", "今天的我",
                "明天", "明天见", "明天的", "明日", "明天会更好",
                "昨天", "昨天的", "昨日", "前几天", "前两天",
                "早上", "上午", "中午", "下午", "晚上", "夜晚", "深夜",
                "凌晨", "天亮", "天黑", "日出", "日落", "夕阳", "晚霞",
                # 日常作息
                "起床", "睡觉", "午觉", "赖床", "早安", "晚安", "午安",
                "早餐", "午餐", "晚餐", "宵夜", "夜宵", "下午茶",
                # 生活方式
                "生活", "好好生活", "日常生活", "生活记录", "记录生活",
                "日常", "日常分享", "日常记录", "日常打卡", "打卡",
                "终于", "终于等到", "终于完成", "终于可以", "终于做完了",
                "第一次", "第一次听", "第一次看", "第一次来", "第一次见",
                # 活动娱乐
                "旅行", "旅游", "出行", "出游", "远行", "出发",
                "逛街", "购物", "买买买", "剁手", "清空购物车",
                "美食", "好吃", "美味", "奶茶", "咖啡", "甜品",
                "健身", "运动", "跑步", "散步", "瑜伽", "游泳",
                "刷剧", "追剧", "游戏", "开黑", "吃鸡", "王者",
                "周末", "假期", "国庆", "春节", "过年", "圣诞",
            ],
            "音乐/创作": [
                # 演唱评价
                "好听", "太好听了", "超级好听", "非常好听", "百听不厌",
                "绝了", "神了", "神仙", "神仙歌曲", "神仙唱功",
                "开口跪", "开口脆", "开口跪系列", "一开口就跪了",
                "嗓音", "好嗓音", "嗓音太美", "音色", "声线", "嗓音独特",
                "唱功", "唱功了得", "唱功在线", "唱功炸裂",
                # 音乐专业
                "旋律", "好旋律", "旋律优美", "旋律动听", "旋律悠扬",
                "歌词", "好歌词", "歌词戳心", "歌词写得好", "词写得",
                "编曲", "编曲炸裂", "编曲用心", "制作精良", "制作团队",
                "前奏", "前奏就跪了", "前奏好听", "间奏", "尾奏",
                "副歌", "副歌高潮", "副歌炸裂", "副歌好听",
                "高音", "高音稳", "高音炸裂", "低音", "中音", "假声",
                "和声", "和声好听", "和声配合", "阿卡贝拉",
                # 创作相关
                "翻唱", "翻唱版", "翻唱不易", "原唱", "原版", "原曲",
                "词曲", "词曲作者", "作曲", "作词", "编曲者",
                "制作人", "录音", "录音棚", "混音", "母带",
                # 现场/演绎
                "现场", "现场版", "现场稳", "现场唱功", "现场演绎",
                "Live", "live版", "livehouse", "演唱会", "音乐会",
                "舞台", "舞台表现", "舞台魅力", "控场", "台风",
                # 听众行为
                "单曲循环", "循环播放", "无限循环", "听哭了", "听麻了",
                "歌单", "我的歌单", "收藏", "已收藏", "加入歌单",
                "粉丝", "歌迷", "追星", "追星族", "追星人",
            ],
            "伤感/治愈": [
                # 哭泣表达
                "哭了", "听哭了", "唱哭了", "哭死", "哭死我", "哭死在这里",
                "泪目", "泪目了", "泪目瞬间", "瞬间泪目",
                "流泪", "流泪了", "听流泪了", "不自觉流泪",
                "泪崩", "泪崩了", "瞬间泪崩", "听到泪崩",
                "泣不成声", "哭成泪人", "哭到", "哭到不行", "哭到崩溃",
                # 心疼表达
                "心碎", "心碎了一地", "心碎的声音", "心碎瞬间",
                "心酸", "好心酸", "心酸瞬间", "太心酸了",
                "心痛", "好心痛", "心痛到", "心痛到无法呼吸",
                "心累", "心好累", "心累到", "心累的瞬间",
                "心塞", "心塞了", "好心塞", "心塞塞",
                # 治愈温暖
                "治愈", "太治愈了", "治愈系", "治愈歌曲", "治愈我",
                "温暖", "好温暖", "温暖瞬间", "温暖治愈",
                "感动", "好感动", "感动哭了", "感动到哭", "感动中国",
                "感谢", "感谢遇见", "感谢你", "感恩", "感恩遇见",
                "释怀", "终于释怀", "学会释怀", "放下", "放下了",
                # 情绪表达
                "破防", "破防了", "突然破防", "绷不住了", "绷不住",
                "emo", "emo了", "emo时刻", "深夜emo", "emo中",
                "崩溃", "崩溃了", "瞬间崩溃", "听完崩溃", "彻底崩溃",
                "孤独", "一个人", "独自", "孤单", "寂寞", "寂寞深夜",
            ],
        }

    def classify(self, text):
        if not text or not isinstance(text, str):
            return []
        matched = []
        for category, keywords in self.categories.items():
            for kw in keywords:
                if kw in text:
                    matched.append(category)
                    break
        return matched

    def cluster(self, comments):
        if len(comments) < 1:
            return []

        text_list = [(c.get("content", "") or "") for c in comments]

        cat_count = {}
        cat_examples = {}
        for cat in self.categories:
            cat_count[cat] = 0
            cat_examples[cat] = []
        # 兜底主题「未分类」用于不匹配任何关键词的评论
        cat_count["未分类"] = 0
        cat_examples["未分类"] = []

        for text in text_list:
            matched = self.classify(text)
            if matched:
                for cat in matched:
                    cat_count[cat] = cat_count.get(cat, 0) + 1
                    # 每个主题最多保留 30 条评论，去重，按顺序
                    if len(cat_examples[cat]) < 30 and text not in cat_examples[cat]:
                        cat_examples[cat].append(text[:500])
            else:
                # 未匹配的评论归入「未分类」兜底主题
                cat_count["未分类"] = cat_count.get("未分类", 0) + 1
                if len(cat_examples["未分类"]) < 30 and text not in cat_examples["未分类"]:
                    cat_examples["未分类"].append(text[:500])

        topics = []
        total = max(len(text_list), 1)
        for cat in sorted(cat_count, key=lambda c: cat_count[c], reverse=True):
            if cat_count[cat] > 0:
                topics.append({
                    "topic_id": len(topics),
                    "name": cat,
                    "keywords": [cat],
                    "count": cat_count[cat],
                    "percentage": round(cat_count[cat] / total * 100),
                    "examples": cat_examples[cat],
                    "all_comments": cat_examples[cat],
                })

        return topics


# 评论爬取器
class CommentCrawler:
    def __init__(self):
        self.api = cloudmusic.api.Api()

    def get_comments(self, song_id, limit=50):
        try:
            result = self.api.get_commets(
                {
                    "ID": str(song_id),
                    "offset": "0",
                    "total": "true",
                    "limit": str(limit),
                }
            )
            return result.get("comments", [])[:limit]
        except Exception as e:
            print(f"获取评论失败: {e}")
            return []


# 分析服务
class CommentAnalysisService:
    # 内存缓存: {(song_id, limit): (result_dict, timestamp)}
    # 缓存 5 分钟，避免重复请求网易云 API 被限流
    _cache = {}
    _cache_ttl = 300  # 秒

    def __init__(self):
        self.crawler = CommentCrawler()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.topic_cluster = TopicCluster()

    def analyze_song_comments(self, song_id, limit=50):
        # 优先返回缓存
        cache_key = (str(song_id), int(limit))
        now = time.time()
        if cache_key in self._cache:
            cached_result, cached_at = self._cache[cache_key]
            if now - cached_at < self._cache_ttl:
                return cached_result

        comments = self.crawler.get_comments(song_id, limit)
        if not comments:
            return {
                "sentiment": {"positive": 0, "neutral": 0, "negative": 0},
                "topics": [],
                "total_comments": 0,
            }

        sentiment_results = [
            self.sentiment_analyzer.analyze(c.get("content", "")) for c in comments
        ]
        sentiment_counts = Counter(r["sentiment"] for r in sentiment_results)
        topics = self.topic_cluster.cluster(comments)

        result = {
            "sentiment": {
                "positive": sentiment_counts.get("positive", 0),
                "neutral": sentiment_counts.get("neutral", 0),
                "negative": sentiment_counts.get("negative", 0),
            },
            "topics": topics,
            "total_comments": len(comments),
            "sample_comments": comments[:10],
        }

        # 写入缓存
        self._cache[cache_key] = (result, time.time())
        return result


# 单例实例
analysis_service = CommentAnalysisService()

# 命令行接口
if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="网易云音乐评论分析工具")
    parser.add_argument("--analyze", type=str, help="分析指定歌曲ID的情感")
    parser.add_argument("--topics", type=str, help="分析指定歌曲ID的主题")
    parser.add_argument("--combined", type=str, help="综合分析（情感+主题）")
    parser.add_argument("limit", nargs="?", default=50, type=int, help="评论数量限制")

    args = parser.parse_args()
    limit = args.limit
    result = None

    if args.analyze:
        service = CommentAnalysisService()
        r = service.analyze_song_comments(args.analyze, limit)
        result = {"sentiment": r["sentiment"], "total_comments": r["total_comments"]}
    elif args.topics:
        service = CommentAnalysisService()
        r = service.analyze_song_comments(args.topics, limit)
        result = {"topics": r["topics"], "total_comments": r["total_comments"]}
    elif args.combined:
        service = CommentAnalysisService()
        r = service.analyze_song_comments(args.combined, limit)
        result = {
            "sentiment": r["sentiment"],
            "topics": r["topics"],
            "total_comments": r["total_comments"],
        }
    else:
        # 默认测试模式
        service = CommentAnalysisService()
        r = service.analyze_song_comments(186166, 30)
        print("情感分布:", r["sentiment"])
        print("主题数量:", len(r["topics"]))
        for topic in r["topics"]:
            print(f"主题{topic['topic_id']}: {topic['keywords']}")
        exit(0)

    if result:
        print(json.dumps(result, ensure_ascii=False))
