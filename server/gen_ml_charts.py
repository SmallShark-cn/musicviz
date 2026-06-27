"""
生成 ML 数据分布和训练曲线可视化图
用于大作业报告
"""
import json
import numpy as np
import pymysql
import matplotlib.pyplot as plt
from matplotlib import rcParams

# 中文字体
rcParams['font.sans-serif'] = ['Arial Unicode MS', 'PingFang SC', 'Microsoft YaHei']
rcParams['axes.unicode_minus'] = False

DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '12345678',
    'database': 'music_dashboard',
    'charset': 'utf8mb4'
}

# 从数据库获取数据
conn = pymysql.connect(**DB_CONFIG)
cur = conn.cursor(pymysql.cursors.DictCursor)
cur.execute("""
    SELECT s.id, s.name, s.plays, s.comments_count,
           s.duration, s.publish_year,
           a.name as artist_name, a.music_size, a.album_size
    FROM songs s JOIN artists a ON s.artist_id = a.id
    WHERE s.plays > 0 AND s.comments_count >= 0
""")
rows = cur.fetchall()
conn.close()

import math

# 数据清洗
valid = []
for r in rows:
    p = float(r['plays'] or 0)
    c = float(r['comments_count'] or 0)
    dur = float(r['duration'] or 0) / 1000
    yr = float(r['publish_year'] or 0)
    if p <= 0:
        continue
    if yr > 2026 or (yr < 1980 and yr != 0):
        continue
    valid.append({
        'plays': p, 'comments': c,
        'duration_min': dur / 60,
        'era': 2026 - yr if yr > 0 else 50,
        'music_size': float(r['music_size'] or 0),
        'album_size': float(r['album_size'] or 0),
    })

# 评分构造
for d in valid:
    c = d['comments']
    if c == 0: d['score'] = 1
    elif c < 500: d['score'] = 2
    elif c < 5000: d['score'] = 3
    elif c < 30000: d['score'] = 4
    else: d['score'] = 5

scores = [d['score'] for d in valid]

# 加载训练曲线
with open('server/training_curve.json', 'r') as f:
    training_curves = json.load(f)

# ============================================================
# 图1: 评分分布 + 数据量统计
# ============================================================
fig = plt.figure(figsize=(16, 12))

# 1.1 评分分布饼图
ax1 = fig.add_subplot(2, 3, 1)
from collections import Counter
score_counts = Counter(scores)
labels = [f'{k}分' for k in sorted(score_counts.keys())]
values = [score_counts[k] for k in sorted(score_counts.keys())]
colors_pie = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db']
wedges, texts, autotexts = ax1.pie(values, labels=labels, autopct='%1.1f%%',
                                     colors=colors_pie, startangle=90,
                                     textprops={'fontsize': 10})
for t in autotexts:
    t.set_fontsize(9)
ax1.set_title('评分分布 (1-5分)', fontsize=13, fontweight='bold')

# 1.2 评分分布柱状图
ax2 = fig.add_subplot(2, 3, 2)
ax2.bar(labels, values, color=colors_pie, edgecolor='white', linewidth=1.5)
for i, v in enumerate(values):
    ax2.text(i, v + max(values)*0.02, f'{v}\n({v/len(valid)*100:.1f}%)',
             ha='center', va='bottom', fontsize=9, fontweight='bold')
ax2.set_title('各评分歌曲数量', fontsize=13, fontweight='bold')
ax2.set_ylabel('歌曲数')
ax2.set_ylim(0, max(values) * 1.15)

# 1.3 播放量分布 (log scale)
ax3 = fig.add_subplot(2, 3, 3)
plays = [d['plays'] for d in valid]
ax3.hist(plays, bins=50, color='#3498db', edgecolor='white', alpha=0.8)
ax3.set_xscale('log')
ax3.set_title('播放量分布 (对数坐标)', fontsize=13, fontweight='bold')
ax3.set_xlabel('播放量')
ax3.set_ylabel('歌曲数')

# 1.4 评论数分布 (log scale)
ax4 = fig.add_subplot(2, 3, 4)
comments = [d['comments'] for d in valid]
ax4.hist(comments, bins=50, color='#2ecc71', edgecolor='white', alpha=0.8)
ax4.set_xscale('log')
ax4.set_title('评论数分布 (对数坐标)', fontsize=13, fontweight='bold')
ax4.set_xlabel('评论数')
ax4.set_ylabel('歌曲数')

# 1.5 歌曲时长分布
ax5 = fig.add_subplot(2, 3, 5)
durations = [d['duration_min'] for d in valid]
ax5.hist(durations, bins=40, color='#e67e22', edgecolor='white', alpha=0.8)
ax5.set_title('歌曲时长分布 (分钟)', fontsize=13, fontweight='bold')
ax5.set_xlabel('时长 (分钟)')
ax5.set_ylabel('歌曲数')
ax5.axvline(np.median(durations), color='red', linestyle='--', label=f'中位数: {np.median(durations):.1f}min')
ax5.legend(fontsize=9)

# 1.6 年代分布
ax6 = fig.add_subplot(2, 3, 6)
eras = [d['era'] for d in valid]
ax6.hist(eras, bins=30, color='#9b59b6', edgecolor='white', alpha=0.8)
ax6.set_title('歌曲年代分布 (距今多少年)', fontsize=13, fontweight='bold')
ax6.set_xlabel('距今年数')
ax6.set_ylabel('歌曲数')

plt.suptitle(f'ML 数据集概览 — 共 {len(valid)} 条歌曲, 12 个特征, 5 分类任务',
             fontsize=15, fontweight='bold', y=1.01)
plt.tight_layout()
plt.savefig('server/ml_data_distribution.png', dpi=150, bbox_inches='tight')
print('已保存: ml_data_distribution.png')
plt.close()

# ============================================================
# 图2: 训练曲线 (准确率 vs n_estimators)
# ============================================================
fig2, axes = plt.subplots(1, 2, figsize=(16, 6))

# RF 训练曲线
ax = axes[0]
rf_data = training_curves['rf']
ax.plot(rf_data['n_estimators'], rf_data['train_acc'], 'o-', color='#e74c3c',
        linewidth=2.5, markersize=8, label='训练集准确率')
ax.plot(rf_data['n_estimators'], rf_data['cv_acc'], 's--', color='#3498db',
        linewidth=2.5, markersize=8, label='交叉验证准确率')
# 标注最佳点
best_idx = rf_data['cv_acc'].index(max(rf_data['cv_acc']))
best_n = rf_data['n_estimators'][best_idx]
best_cv = rf_data['cv_acc'][best_idx]
ax.annotate(f'最佳: n={best_n}\nCV={best_cv}%',
            xy=(best_n, best_cv),
            xytext=(best_n+20, best_cv-3),
            fontsize=10, fontweight='bold',
            arrowprops=dict(arrowstyle='->', color='gray'),
            bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.7))
ax.set_xlabel('n_estimators (树的数量)', fontsize=12)
ax.set_ylabel('准确率 (%)', fontsize=12)
ax.set_title('RandomForest 训练曲线', fontsize=14, fontweight='bold')
ax.legend(fontsize=11)
ax.grid(True, alpha=0.3)
ax.set_ylim(50, 105)

# GB 训练曲线
ax = axes[1]
gb_data = training_curves['gb']
ax.plot(gb_data['n_estimators'], gb_data['train_acc'], 'o-', color='#e74c3c',
        linewidth=2.5, markersize=8, label='训练集准确率')
ax.plot(gb_data['n_estimators'], gb_data['cv_acc'], 's--', color='#3498db',
        linewidth=2.5, markersize=8, label='交叉验证准确率')
best_idx = gb_data['cv_acc'].index(max(gb_data['cv_acc']))
best_n_gb = gb_data['n_estimators'][best_idx]
best_cv_gb = gb_data['cv_acc'][best_idx]
ax.annotate(f'最佳: n={best_n_gb}\nCV={best_cv_gb}%',
            xy=(best_n_gb, best_cv_gb),
            xytext=(best_n_gb+10, best_cv_gb-3),
            fontsize=10, fontweight='bold',
            arrowprops=dict(arrowstyle='->', color='gray'),
            bbox=dict(boxstyle='round,pad=0.3', facecolor='yellow', alpha=0.7))
ax.set_xlabel('n_estimators (树的数量)', fontsize=12)
ax.set_ylabel('准确率 (%)', fontsize=12)
ax.set_title('GradientBoosting 训练曲线', fontsize=14, fontweight='bold')
ax.legend(fontsize=11)
ax.grid(True, alpha=0.3)
ax.set_ylim(50, 105)

plt.suptitle('模型训练曲线 — 训练准确率 vs 交叉验证准确率 (检测过拟合)',
             fontsize=15, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('server/ml_training_curves.png', dpi=150, bbox_inches='tight')
print('已保存: ml_training_curves.png')
plt.close()

# ============================================================
# 图3: 特征重要性 + 混淆矩阵说明
# ============================================================
fig3, axes = plt.subplots(1, 2, figsize=(16, 6))

# 3.1 特征重要性
ax = axes[0]
# 从 ml_result.json 读取
with open('server/ml_result.json', 'r') as f:
    ml_result = json.load(f)

feature_imp = ml_result.get('feature_importance', {})
if feature_imp:
    # 按重要性降序排序
    sorted_items = sorted(feature_imp.items(), key=lambda x: x[1], reverse=True)
    names = [item[0] for item in sorted_items]
    imps = [item[1] for item in sorted_items]  # 已经是百分比
    colors_bar = plt.cm.Blues(np.linspace(0.4, 0.9, len(names)))
    ax.barh(range(len(names)), imps, color=colors_bar, edgecolor='white', linewidth=1.5)
    ax.set_yticks(range(len(names)))
    ax.set_yticklabels(names, fontsize=11)
    ax.invert_yaxis()
    ax.set_xlabel('重要性 (%)', fontsize=12)
    ax.set_title('特征重要性排序 (RandomForest)', fontsize=14, fontweight='bold')
    for i, v in enumerate(imps):
        ax.text(v + 0.3, i, f'{v}%', va='center', fontsize=10, fontweight='bold')

# 3.2 过拟合分析示意
ax = axes[1]
# 画一个示意图展示过拟合现象
n_est = list(range(10, 210, 10))
train_acc_sim = [60 + 35 * (1 - np.exp(-n/80)) for n in n_est]
cv_acc_sim = [60 + 8 * (1 - np.exp(-n/30)) - 0.01 * n for n in n_est]
cv_acc_sim = [max(55, min(72, v)) for v in cv_acc_sim]

ax.plot(n_est, train_acc_sim, 'o-', color='#e74c3c', linewidth=2, label='训练准确率 (上升)')
ax.plot(n_est, cv_acc_sim, 's--', color='#3498db', linewidth=2, label='验证准确率 (停滞)')
ax.fill_between(n_est[10:], train_acc_sim[10:], cv_acc_sim[10:],
                alpha=0.2, color='red', label='过拟合区域')
ax.axvline(x=50, color='green', linestyle='--', linewidth=2, label='最佳停止点 (n=50)')
ax.set_xlabel('n_estimators', fontsize=12)
ax.set_ylabel('准确率 (%)', fontsize=12)
ax.set_title('过拟合示意图 (GradientBoosting)', fontsize=14, fontweight='bold')
ax.legend(fontsize=10)
ax.grid(True, alpha=0.3)
ax.set_ylim(50, 100)
ax.annotate('训练集持续上升\n但验证集停滞\n→ 过拟合!',
            xy=(150, 80), xytext=(120, 90),
            fontsize=10, fontweight='bold', color='red',
            arrowprops=dict(arrowstyle='->', color='red'),
            bbox=dict(boxstyle='round,pad=0.3', facecolor='#ffe0e0', alpha=0.8))

plt.suptitle('特征重要性 & 过拟合分析', fontsize=15, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig('server/ml_feature_importance.png', dpi=150, bbox_inches='tight')
print('已保存: ml_feature_importance.png')
plt.close()

print('\n所有图表已生成在 server/ 目录下:')
print('  1. ml_data_distribution.png — 数据分布概览')
print('  2. ml_training_curves.png — 训练曲线 (检测过拟合)')
print('  3. ml_feature_importance.png — 特征重要性 + 过拟合示意')
