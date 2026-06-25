import os
import sys

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
            "情感/恋爱": ["爱情", "我想你", "我爱你", "分手", "喜欢", "恋爱", "思念", "前任",
                       "告白", "表白", "失恋", "单身", "错过", "遗憾", "舍不得",
                       "想见你", "等你", "在一起", "离开", "想念", "心动", "暗恋"],
            "考试/学业": ["考试", "高考", "考研", "学习", "作业", "毕业", "上课", "自习",
                       "考完", "考场", "期末", "期中", "成绩", "复习", "备考", "加油考",
                       "高考加油", "考研加油", "考过", "挂科", "录取"],
            "职场/生活": ["工作", "加班", "打工", "社畜", "上班", "累", "压力大", "辞职",
                       "赚钱", "工资", "老板", "同事", "求职", "面试", "跳槽", "出差",
                       "搬砖", "房贷", "租房", "通勤"],
            "青春/回忆": ["青春", "回忆", "小时候", "那年", "以前", "那年夏天",
                       "童年", "怀旧", "过去", "时光", "岁月", "回不去了", "曾经",
                       "学生时代", "毕业季", "校园", "年少"],
            "友情/亲情": ["朋友", "兄弟", "闺蜜", "家人", "父母", "孩子", "妈妈", "爸爸",
                       "姐妹", "哥们", "死党", "亲情", "友情", "陪伴",
                       "最好的朋友", "好兄弟", "一家人"],
            "梦想/励志": ["梦想", "坚持", "加油", "努力", "奋斗", "未来", "希望", "相信",
                       "一定会", "不放弃", "向前", "前行", "追梦", "勇敢",
                       "别放弃", "发光", "实现"],
            "生活/日常": ["今天", "终于", "第一次", "日常", "生活", "记录",
                       "打卡", "睡前", "醒来", "晚安", "早安", "心情"],
            "音乐/创作": ["好听", "旋律", "歌词", "翻唱", "编曲", "嗓音", "唱歌", "声线",
                       "前奏", "副歌", "神仙", "开口跪", "绝了",
                       "伴奏", "唱功", "高音", "和声", "词曲", "神曲"],
            "伤感/治愈": ["哭了", "泪目", "流泪", "心碎", "难过", "伤心", "难受", "心痛",
                       "治愈", "感动", "感动哭", "泪崩", "破防", "绷不住了", "温暖"],
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

        for text in text_list:
            matched = self.classify(text)
            for cat in matched:
                cat_count[cat] = cat_count.get(cat, 0) + 1
                if len(cat_examples[cat]) < 3:
                    cat_examples[cat].append(text[:80])

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
    def __init__(self):
        self.crawler = CommentCrawler()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.topic_cluster = TopicCluster()

    def analyze_song_comments(self, song_id, limit=50):
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

        return {
            "sentiment": {
                "positive": sentiment_counts.get("positive", 0),
                "neutral": sentiment_counts.get("neutral", 0),
                "negative": sentiment_counts.get("negative", 0),
            },
            "topics": topics,
            "total_comments": len(comments),
            "sample_comments": comments[:10],
        }


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
