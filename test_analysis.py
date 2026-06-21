import sys
sys.path.insert(0, '/Users/smallshark/Desktop/works/Data Visualization/期末/cloudmusic-master')
sys.path.insert(0, '/Users/smallshark/Desktop/works/Data Visualization/期末/server')

import cloudmusic
import jieba
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from collections import Counter

# 测试爬取
print("📡 测试爬取评论...")
api = cloudmusic.api.Api()
result = api.get_commets({'ID': '186166', 'offset': '0', 'total': 'true', 'limit': '20'})
comments = result.get('comments', [])
print(f"✅ 获取到 {len(comments)} 条评论")

# 测试情感分析
print("\n🧠 测试情感分析...")
positive_words = {'好听', '喜欢', '爱', '棒', '赞', '感动', '经典', '回忆', '青春'}
negative_words = {'难听', '垃圾', '恶心', '失望', '无语'}

def analyze_sentiment(text):
    if not text:
        return 'neutral'
    text = str(text).lower()
    pos_count = sum(1 for w in positive_words if w in text)
    neg_count = sum(1 for w in negative_words if w in text)
    if pos_count > neg_count:
        return 'positive'
    elif neg_count > pos_count:
        return 'negative'
    return 'neutral'

sentiment_counts = Counter()
for c in comments:
    sentiment = analyze_sentiment(c.get('content', ''))
    sentiment_counts[sentiment] += 1
print(f"✅ 情感分布: {dict(sentiment_counts)}")

# 测试主题聚类
print("\n🔍 测试主题聚类...")
stopwords = {'的', '了', '和', '是', '就', '都'}

def preprocess(text):
    if not text:
        return ''
    text = re.sub(r'[^\w\s]', '', str(text))
    words = jieba.cut(text)
    return ' '.join([w for w in words if w not in stopwords and len(w) > 1])

processed = [preprocess(c.get('content', '')) for c in comments]
valid_processed = [p for p in processed if p.strip()]

if len(valid_processed) >= 3:
    vectorizer = TfidfVectorizer(max_features=100)
    tfidf_matrix = vectorizer.fit_transform(valid_processed)
    
    kmeans = KMeans(n_clusters=2, random_state=42)
    labels = kmeans.fit_predict(tfidf_matrix)
    
    topics = []
    for i in range(2):
        cluster_indices = [j for j, label in enumerate(labels) if label == i]
        if cluster_indices:
            cluster_texts = [valid_processed[j] for j in cluster_indices]
            all_words = ' '.join(cluster_texts).split()
            top_words = [w for w, _ in Counter(all_words).most_common(3)]
            topics.append({'keywords': top_words, 'count': len(cluster_indices)})
    
    print(f"✅ 生成 {len(topics)} 个主题")
    for i, t in enumerate(topics):
        print(f"   主题{i}: {t['keywords']} ({t['count']}条)")
else:
    print("❌ 有效文本不足，跳过聚类")

print("\n🎉 测试完成!")