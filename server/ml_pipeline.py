#!/usr/bin/env python3
"""
互动度评分预测 — 分类模型
==================================
目标：预测歌曲互动评分(1-10分)
模型：XGBoost + GridSearchCV 调参
"""

import json
import math
import os
import sys
import warnings
from datetime import datetime

import numpy as np
import pymysql
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.utils.class_weight import compute_class_weight

warnings.filterwarnings("ignore")

DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "12345678",
    "database": "music_dashboard",
    "charset": "utf8mb4",
}

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "ml_result.json")
LOG = []

def log(msg):
    LOG.append(msg)
    print(msg)

def section(title):
    log(f"\n{'=' * 60}\n  {title}\n{'=' * 60}")

# ============================================================
# 1. 数据采集
# ============================================================
section("1. 数据采集")

conn = pymysql.connect(**DB_CONFIG)
cur = conn.cursor(pymysql.cursors.DictCursor)
cur.execute("""
    SELECT s.id, s.name, s.artist_id, s.plays, s.comments_count,
           s.duration, s.publish_year,
           a.name as artist_name, a.music_size, a.album_size
    FROM songs s JOIN artists a ON s.artist_id = a.id
    WHERE s.plays > 0 AND s.comments_count >= 0
""")
rows = cur.fetchall()
conn.close()

log(f"原始数据: {len(rows)} 条")

# ============================================================
# 2. 清洗 + 构造评分
# ============================================================
section("2. 数据清洗 & 评分构造")

valid = []
for r in rows:
    p = float(r["plays"] or 0)
    c = float(r["comments_count"] or 0)
    dur = float(r["duration"] or 0) / 1000
    yr = float(r["publish_year"] or 0)

    if p <= 0:
        continue
    if yr > 2026 or (yr < 1980 and yr != 0):
        continue

    # 互动指数 = log(评论数+1) / log(最大评论数+1) → 0~1
    # 不在这里用，只是概念上的
    valid.append(
        {
            **r,
            "plays": p,
            "comments": c,
            "duration_min": dur / 60,
            "era": 2026 - yr if yr > 0 else 50,
            "music_size": float(r["music_size"] or 0),
            "album_size": float(r["album_size"] or 0),
        }
    )

# 自定义5档评分（基于评论数的实际分布 — 65%数据评论为0）
for d in valid:
    c = d["comments"]
    if c == 0:         d["score"] = 1
    elif c < 500:      d["score"] = 2
    elif c < 5000:     d["score"] = 3
    elif c < 30000:    d["score"] = 4
    else:              d["score"] = 5

scores = [d["score"] for d in valid]
unique, counts = np.unique(scores, return_counts=True)
log(f"清洗后: {len(valid)} 条")
log(f"评分分布:")
for u, c in zip(unique, counts):
    log(f"  {u}分: {c} 条 ({c / len(valid) * 100:.1f}%)")

# ============================================================
# 3. 特征工程
# ============================================================
section("3. 特征工程")

FEATURES = [
    "plays",
    "log_plays",
    "sqrt_plays",
    "duration_min",
    "duration_log",
    "era",
    "era_sqrt",
    "music_size",
    "album_size",
    "productivity",  # music_size / max(era, 1) → 年均产量
    "is_long_song",  # 是否长歌 (>5分钟)
    "is_old_song",  # 是否老歌 (>10年)
]

for d in valid:
    d["log_plays"] = math.log(d["plays"] + 1)
    d["sqrt_plays"] = math.sqrt(d["plays"])
    d["duration_log"] = math.log(d["duration_min"] + 0.1)
    d["era_sqrt"] = math.sqrt(max(d["era"], 0))
    d["productivity"] = d["music_size"] / max(d["era"], 1)
    d["is_long_song"] = 1 if d["duration_min"] > 5 else 0
    d["is_old_song"] = 1 if d["era"] > 10 else 0

log(f"特征数: {len(FEATURES)}")
log(f"特征列表: {FEATURES}")

# 特征选择
X = np.array([[d[f] for f in FEATURES] for d in valid])
y = np.array([d["score"] for d in valid])

selector = SelectKBest(f_classif, k=min(10, len(FEATURES)))
selector.fit(X, y)
selected_idx = selector.get_support()
selected_features = [FEATURES[i] for i in range(len(FEATURES)) if selected_idx[i]]

# 如果特征选择没有显著提升，使用全部特征
if len(selected_features) < 5:
    selected_features = FEATURES
    selected_idx = [True] * len(FEATURES)

X = np.array([[d[f] for f in selected_features] for d in valid])
log(f"特征选择后: {len(selected_features)} 个")
log(f"  使用特征: {selected_features}")

log(f"特征重要性 (ANOVA F-score):")
scores_f = selector.scores_
for i in sorted(range(len(FEATURES)), key=lambda i: scores_f[i], reverse=True):
    status = "✓" if FEATURES[i] in selected_features else "✗"
    log(f"  {status} {FEATURES[i]:20s}: {scores_f[i]:.1f}")

# 标准化
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# 计算类别权重（评分多分类用 balanced）
class_weights = compute_class_weight("balanced", classes=np.unique(y), y=y)
weight_dict = {int(k): float(w) for k, w in zip(np.unique(y), class_weights)}
log(
    f"类别权重 (处理不均衡): {dict((k, round(float(v), 2)) for k, v in zip(np.unique(y), class_weights))}"
)

# 分割
X_tr, X_te, y_tr, y_te = train_test_split(
    X_scaled, y, test_size=0.2, random_state=42, stratify=y
)
log(f"训练集: {len(X_tr)}, 测试集: {len(X_te)}")

# ============================================================
# 4. 调参 (XGBoost + RandomForest)
# ============================================================
section("4. GridSearchCV 调参")

# 模型 A: RandomForest
log("\n[模型 B] RandomForest Classifier")
rf_params = {
    "n_estimators": [100, 200, 300],
    "max_depth": [10, 15, None],
    "min_samples_split": [2, 5],
    "min_samples_leaf": [1, 2],
}
log(
    f"  搜索空间: {len(rf_params['n_estimators']) * len(rf_params['max_depth']) * len(rf_params['min_samples_split']) * len(rf_params['min_samples_leaf'])} 种组合"
)

rf_gs = GridSearchCV(
    RandomForestClassifier(random_state=42, class_weight="balanced"),
    rf_params,
    cv=5,
    scoring="accuracy",
    n_jobs=-1,
    verbose=0,
)
rf_gs.fit(X_tr, y_tr)
rf_acc = accuracy_score(y_te, rf_gs.predict(X_te))
log(f"  RF 最佳参数: {rf_gs.best_params_}")
log(f"  RF 交叉验证准确率: {rf_gs.best_score_ * 100:.1f}%")
log(f"  RF 测试集准确率: {rf_acc * 100:.1f}%")

# 模型 B: GradientBoosting
log("\n[模型 B] GradientBoosting Classifier")
gb_params = {
    "n_estimators": [100, 200],
    "max_depth": [3, 5, 7],
    "learning_rate": [0.05, 0.1],
}
log(f"  搜索空间: {2 * 3 * 2} 种组合")

gb_gs = GridSearchCV(
    GradientBoostingClassifier(random_state=42),
    gb_params,
    cv=5,
    scoring="accuracy",
    n_jobs=-1,
    verbose=0,
)
gb_gs.fit(X_tr, y_tr)
gb_acc = accuracy_score(y_te, gb_gs.predict(X_te))
log(f"  GB 最佳参数: {gb_gs.best_params_}")
log(f"  GB 交叉验证准确率: {gb_gs.best_score_ * 100:.1f}%")
log(f"  GB 测试集准确率: {gb_acc * 100:.1f}%")

# 选最佳模型 (比较 A/B/C 三个模型)
candidates = [
    (rf_gs, rf_acc, "RandomForest"),
    (gb_gs, gb_acc, "GradientBoosting"),
]
best_gs, best_test, best_name = max(candidates, key=lambda x: x[1])
best = best_gs.best_estimator_
best_cv = best_gs.best_score_
best_params = best_gs.best_params_

log(f"\n  ✅ 最佳模型: {best_name}")
log(f"  ✅ 测试集准确率: {best_test * 100:.1f}%")

# ============================================================
# 5. 特征重要性
# ============================================================
section("5. 特征重要性")

if hasattr(best, "feature_importances_"):
    imps = best.feature_importances_
    ranked = sorted(zip(selected_features, imps), key=lambda x: x[1], reverse=True)
    for name, imp in ranked:
        log(f"  {name:20s}: {imp * 100:.1f}%")

# ============================================================
# 6. 错误分析
# ============================================================
section("6. 混淆矩阵 & 误差分析")

y_pred = best.predict(X_te)
cm = confusion_matrix(y_te, y_pred, labels=list(range(1, 11)))
log("混淆矩阵 (行=实际, 列=预测):")
header = "      " + "".join([f" 预{i:2d}" for i in range(1, 11)])
log(header)
for i, row in enumerate(cm):
    log(f"  实际{i + 1:2d}: " + "".join([f"{v:5d}" for v in row]))

# 允许 ±1 误差的准确率
def acc_within_tolerance(y_true, y_pred, tol=0):
    return np.mean(np.abs(y_true - y_pred) <= tol)

log(f"\n  严格准确率: {accuracy_score(y_te, y_pred) * 100:.1f}%")
log(f"  ±1 容错准确率: {acc_within_tolerance(y_te, y_pred, 1) * 100:.1f}%")
log(f"  ±2 容错准确率: {acc_within_tolerance(y_te, y_pred, 2) * 100:.1f}%")

cr = classification_report(y_te, y_pred, labels=list(range(1, 11)), zero_division=0)
log(f"\n分类报告:\n{cr}")

# ============================================================
# 7. 全部预测
# ============================================================
section("7. 全部歌曲预测")

y_all = best.predict(X_scaled)
y_all_proba = best.predict_proba(X_scaled)

results = []
for i, d in enumerate(valid):
    proba = y_all_proba[i]
    conf = float(max(proba))  # 最高概率作为置信度
    results.append(
        {
            "id": int(d["id"]),
            "name": str(d["name"]),
            "artist": str(d["artist_name"]),
            "plays": int(d["plays"]),
            "comments": int(d["comments"]),
            "actual_score": int(d["score"]),
            "predicted_score": int(y_all[i]),
            "confidence": round(conf, 4),
            "is_correct": int(y_all[i]) == int(d["score"]),
        }
    )

correct = sum(1 for r in results if r["is_correct"])
log(f"全部预测准确率: {correct / len(results) * 100:.1f}%")
log(f"平均置信度: {np.mean([r['confidence'] for r in results]) * 100:.1f}%")

# ============================================================
# 8. 输出
# ============================================================
section("8. 保存结果")

output = {
    "timestamp": datetime.now().isoformat(),
    "mode": "classification",
    "target": "interaction_score_1to10",
    "samples": len(valid),
    "features_used": selected_features,
    "all_features": FEATURES,
    "score_distribution": {int(k): int(v) for k, v in zip(unique, counts)},
    "model_name": best_name,
    "best_params": {
        k: (int(v) if isinstance(v, np.integer) else v) for k, v in best_params.items()
    },
    "cv_accuracy": round(float(best_cv) * 100, 1),
    "test_accuracy": round(float(best_test) * 100, 1),
    "accuracy_within_1": round(float(acc_within_tolerance(y_te, y_pred, 1)) * 100, 1),
    "accuracy_within_2": round(float(acc_within_tolerance(y_te, y_pred, 2)) * 100, 1),
    "feature_importance": {name: round(float(imp) * 100, 1) for name, imp in ranked},
    "predictions": results,
    "log": "\n".join(LOG),
}

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

log(f"\n结果已保存: {OUTPUT_FILE}")
log(f"✅ 完成!")
