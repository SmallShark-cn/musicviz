#!/usr/bin/env python3
"""
生成 ML 训练曲线图 — 准确率随 n_estimators 变化
输出: training_curve.png
"""

import json
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

CURVE_FILE = os.path.join(os.path.dirname(__file__), "training_curve.json")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "training_curve.png")

# 中文字体
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'PingFang SC', 'Heiti SC', 'SimHei']
plt.rcParams['axes.unicode_minus'] = False

with open(CURVE_FILE, 'r', encoding='utf-8') as f:
    curves = json.load(f)

fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# ============ 左图: RandomForest ============
ax = axes[0]
rf = curves['rf']
x = rf['n_estimators']
train = rf['train_acc']
cv = rf['cv_acc']

ax.plot(x, train, 'o-', color='#3b82f6', linewidth=2, markersize=6, label='训练集准确率')
ax.plot(x, cv, 's--', color='#ef4444', linewidth=2, markersize=6, label='5折交叉验证准确率')

# 标注最佳点
best_idx = cv.index(max(cv))
ax.annotate(f'最佳: {cv[best_idx]}%', 
            xy=(x[best_idx], cv[best_idx]),
            xytext=(x[best_idx]+20, cv[best_idx]+1),
            fontsize=10, color='#ef4444', fontweight='bold',
            arrowprops=dict(arrowstyle='->', color='#ef4444', lw=1.5))

ax.set_xlabel('n_estimators (树的数量)', fontsize=12)
ax.set_ylabel('准确率 (%)', fontsize=12)
ax.set_title('RandomForest 训练曲线', fontsize=14, fontweight='bold')
ax.legend(fontsize=11, loc='lower right')
ax.grid(True, alpha=0.3)
ax.set_ylim(min(min(train), min(cv)) - 3, 102)

# ============ 右图: GradientBoosting ============
ax = axes[1]
gb = curves['gb']
x = gb['n_estimators']
train = gb['train_acc']
cv = gb['cv_acc']

ax.plot(x, train, 'o-', color='#10b981', linewidth=2, markersize=6, label='训练集准确率')
ax.plot(x, cv, 's--', color='#f59e0b', linewidth=2, markersize=6, label='5折交叉验证准确率')

best_idx = cv.index(max(cv))
ax.annotate(f'最佳: {cv[best_idx]}%', 
            xy=(x[best_idx], cv[best_idx]),
            xytext=(x[best_idx]+15, cv[best_idx]+1),
            fontsize=10, color='#f59e0b', fontweight='bold',
            arrowprops=dict(arrowstyle='->', color='#f59e0b', lw=1.5))

ax.set_xlabel('n_estimators (树的数量)', fontsize=12)
ax.set_ylabel('准确率 (%)', fontsize=12)
ax.set_title('GradientBoosting 训练曲线', fontsize=14, fontweight='bold')
ax.legend(fontsize=11, loc='lower right')
ax.grid(True, alpha=0.3)
ax.set_ylim(min(min(train), min(cv)) - 3, 102)

plt.suptitle('ML 模型训练曲线 — 准确率随树数量变化', fontsize=16, fontweight='bold', y=1.02)
plt.tight_layout()
plt.savefig(OUTPUT_FILE, dpi=150, bbox_inches='tight', facecolor='white')
print(f"训练曲线已保存: {OUTPUT_FILE}")

# 打印关键数据
print("\n=== RandomForest ===")
for i, n in enumerate(rf['n_estimators']):
    gap = rf['train_acc'][i] - rf['cv_acc'][i]
    print(f"  n={n:4d} | 训练={rf['train_acc'][i]:.1f}% | CV={rf['cv_acc'][i]:.1f}% | 差距={gap:.1f}%")

print("\n=== GradientBoosting ===")
for i, n in enumerate(gb['n_estimators']):
    gap = gb['train_acc'][i] - gb['cv_acc'][i]
    print(f"  n={n:4d} | 训练={gb['train_acc'][i]:.1f}% | CV={gb['cv_acc'][i]:.1f}% | 差距={gap:.1f}%")
