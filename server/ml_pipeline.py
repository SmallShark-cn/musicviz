#!/usr/bin/env python3
"""
歌曲潜力评分预测 — 分类模型 v2
==================================
目标：识别"潜力歌曲" — 相对于播放量，评论互动是否超出预期
核心思路：不直接预测评论数，而是预测"评论/播放比"的档位
  - 播放量低但评论多 → 潜力股（死忠粉多，值得推广）
  - 播放量高但评论少 → 被高估（曝光多但互动差）
模型：RandomForest + GradientBoosting
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
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import StandardScaler
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
TRAINING_CURVE_FILE = os.path.join(os.path.dirname(__file__), "training_curve.json")
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
# 2. 清洗 + 构造潜力评分
# ============================================================
section("2. 数据清洗 & 潜力评分构造")

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

# 核心：计算"评论/播放比"，用分位数分档构造潜力评分
# log_ratio 越大 = 相对于播放量，评论越多 = 潜力越高
ratios = []
for d in valid:
    # 避免除零和 log(0)
    ratio = d["comments"] / max(d["plays"], 1)
    log_ratio = math.log(ratio + 1e-10)
    ratios.append(log_ratio)
    d["log_ratio"] = log_ratio

# 用分位数切分为 3 档（低/中/高潜力，边界更清晰）
percentiles = np.percentile(ratios, [33, 67])
log(f"分位数阈值: {[round(p, 4) for p in percentiles]}")

for d in valid:
    lr = d["log_ratio"]
    if lr < percentiles[0]:
        d["potential"] = 1  # 低潜力（播放高但评论少 → 被高估）
    elif lr < percentiles[1]:
        d["potential"] = 2  # 中等潜力
    else:
        d["potential"] = 3  # 高潜力（播放低但评论多 → 潜力股）

potentials = [d["potential"] for d in valid]
unique, counts = np.unique(potentials, return_counts=True)
log(f"清洗后: {len(valid)} 条")
log(f"潜力评分分布 (分位数分档):")
for u, c in zip(unique, counts):
    label = {1: "低潜力", 2: "较低", 3: "中等", 4: "较高", 5: "高潜力(潜力股)"}[u]
    log(f"  {u}分 ({label}): {c} 条 ({c / len(valid) * 100:.1f}%)")

# ============================================================
# 3. 特征工程
# ============================================================
section("3. 特征工程")

# 包含 plays 相关特征 — 模型需要学习"播放量与评论的关系"
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
    "productivity",
    "is_long_song",
    "is_old_song",
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
y = np.array([d["potential"] for d in valid])

selector = SelectKBest(f_classif, k=min(10, len(FEATURES)))
selector.fit(X, y)
selected_idx = selector.get_support()
selected_features = [FEATURES[i] for i in range(len(FEATURES)) if selected_idx[i]]

if len(selected_features) < 5:
    selected_features = FEATURES

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

# 类别权重
class_weights = compute_class_weight("balanced", classes=np.unique(y), y=y)
log(f"类别权重: {dict((int(k), round(float(v), 2)) for k, v in zip(np.unique(y), class_weights))}")

# 分割
X_tr, X_te, y_tr, y_te = train_test_split(
    X_scaled, y, test_size=0.2, random_state=42, stratify=y
)
log(f"训练集: {len(X_tr)}, 测试集: {len(X_te)}")

# ============================================================
# 4. 训练 + 调参
# ============================================================
section("4. 模型训练 & 调参")

training_curves = {
    "rf": {"train_acc": [], "cv_acc": [], "n_estimators": []},
    "gb": {"train_acc": [], "cv_acc": [], "n_estimators": []},
}

# 模型 A: RandomForest
log("\n[模型 A] RandomForest Classifier")
rf_n_estim_list = [10, 30, 50, 80, 100, 150, 200, 250, 300]
rf_best_params = None
rf_best_cv = 0

for n_est in rf_n_estim_list:
    rf_tmp = RandomForestClassifier(
        n_estimators=n_est, max_depth=10, min_samples_split=2,
        min_samples_leaf=1, random_state=42, class_weight="balanced"
    )
    cv_scores = cross_val_score(rf_tmp, X_tr, y_tr, cv=5, scoring="accuracy")
    cv_mean = cv_scores.mean()
    rf_tmp.fit(X_tr, y_tr)
    train_acc = accuracy_score(y_tr, rf_tmp.predict(X_tr))

    training_curves["rf"]["n_estimators"].append(n_est)
    training_curves["rf"]["train_acc"].append(round(train_acc * 100, 2))
    training_curves["rf"]["cv_acc"].append(round(cv_mean * 100, 2))

    log(f"  n={n_est:4d} | 训练={train_acc*100:.1f}% | CV={cv_mean*100:.1f}%")

    if cv_mean > rf_best_cv:
        rf_best_cv = cv_mean
        rf_best_params = {"n_estimators": n_est, "max_depth": 10, "min_samples_split": 2, "min_samples_leaf": 1}

log(f"\n  RF 最佳: n={rf_best_params['n_estimators']}, CV={rf_best_cv*100:.1f}%")

rf_final = RandomForestClassifier(random_state=42, class_weight="balanced", **rf_best_params)
rf_final.fit(X_tr, y_tr)
rf_acc = accuracy_score(y_te, rf_final.predict(X_te))
log(f"  RF 测试集准确率: {rf_acc * 100:.1f}%")

# 模型 B: GradientBoosting
log("\n[模型 B] GradientBoosting Classifier")
gb_n_estim_list = [20, 50, 80, 100, 150, 200]
gb_best_params = None
gb_best_cv = 0

for n_est in gb_n_estim_list:
    gb_tmp = GradientBoostingClassifier(
        n_estimators=n_est, max_depth=5, learning_rate=0.1, random_state=42
    )
    cv_scores = cross_val_score(gb_tmp, X_tr, y_tr, cv=5, scoring="accuracy")
    cv_mean = cv_scores.mean()
    gb_tmp.fit(X_tr, y_tr)
    train_acc = accuracy_score(y_tr, gb_tmp.predict(X_tr))

    training_curves["gb"]["n_estimators"].append(n_est)
    training_curves["gb"]["train_acc"].append(round(train_acc * 100, 2))
    training_curves["gb"]["cv_acc"].append(round(cv_mean * 100, 2))

    log(f"  n={n_est:4d} | 训练={train_acc*100:.1f}% | CV={cv_mean*100:.1f}%")

    if cv_mean > gb_best_cv:
        gb_best_cv = cv_mean
        gb_best_params = {"n_estimators": n_est, "max_depth": 5, "learning_rate": 0.1}

log(f"\n  GB 最佳: n={gb_best_params['n_estimators']}, CV={gb_best_cv*100:.1f}%")

gb_final = GradientBoostingClassifier(random_state=42, **gb_best_params)
gb_final.fit(X_tr, y_tr)
gb_acc = accuracy_score(y_te, gb_final.predict(X_te))
log(f"  GB 测试集准确率: {gb_acc * 100:.1f}%")

# 选最佳模型
candidates = [
    (rf_final, rf_acc, rf_best_cv, rf_best_params, "RandomForest"),
    (gb_final, gb_acc, gb_best_cv, gb_best_params, "GradientBoosting"),
]
best_model, best_test, best_cv, best_params, best_name = max(candidates, key=lambda x: x[1])

log(f"\n  ✅ 最佳模型: {best_name}")
log(f"  ✅ 测试集准确率: {best_test * 100:.1f}%")
log(f"  ✅ 交叉验证准确率: {best_cv * 100:.1f}%")

# 保存训练曲线
with open(TRAINING_CURVE_FILE, "w", encoding="utf-8") as f:
    json.dump(training_curves, f, ensure_ascii=False, indent=2)

# ============================================================
# 5. 特征重要性
# ============================================================
section("5. 特征重要性")

ranked = []
if hasattr(best_model, "feature_importances_"):
    imps = best_model.feature_importances_
    ranked = sorted(zip(selected_features, imps), key=lambda x: x[1], reverse=True)
    for name, imp in ranked:
        log(f"  {name:20s}: {imp * 100:.1f}%")

# ============================================================
# 6. 错误分析
# ============================================================
section("6. 混淆矩阵 & 误差分析")

y_pred = best_model.predict(X_te)
cm = confusion_matrix(y_te, y_pred, labels=[1, 2, 3, 4, 5])
log("混淆矩阵 (行=实际, 列=预测):")
log("        预1   预2   预3   预4   预5")
for i, row in enumerate(cm):
    log(f"  实际{i+1}: " + "".join([f"{v:5d}" for v in row]))


def acc_within_tolerance(y_true, y_pred, tol=0):
    return np.mean(np.abs(y_true - y_pred) <= tol)


log(f"\n  严格准确率: {accuracy_score(y_te, y_pred) * 100:.1f}%")
log(f"  ±1 容错准确率: {acc_within_tolerance(y_te, y_pred, 1) * 100:.1f}%")
log(f"  ±2 容错准确率: {acc_within_tolerance(y_te, y_pred, 2) * 100:.1f}%")

cr = classification_report(y_te, y_pred, labels=[1, 2, 3, 4, 5], zero_division=0)
log(f"\n分类报告:\n{cr}")

# ============================================================
# 7. 全部预测
# ============================================================
section("7. 全部歌曲预测")

y_all = best_model.predict(X_scaled)
y_all_proba = best_model.predict_proba(X_scaled)

results = []
for i, d in enumerate(valid):
    proba = y_all_proba[i]
    conf = float(max(proba))
    results.append(
        {
            "id": int(d["id"]),
            "name": str(d["name"]),
            "artist": str(d["artist_name"]),
            "plays": int(d["plays"]),
            "comments": int(d["comments"]),
            "actual_potential": int(d["potential"]),
            "predicted_potential": int(y_all[i]),
            "confidence": round(conf, 4),
            "is_correct": int(y_all[i]) == int(d["potential"]),
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
    "mode": "potential_classification",
    "target": "potential_score_1to5",
    "target_description": "基于评论/播放比的潜力评分（1=低潜力, 5=高潜力/潜力股）",
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

# ============================================================
# 9. 保存模型（供实时预测用）
# ============================================================
section("9. 保存模型文件")

try:
    import joblib
    model_dir = os.path.dirname(__file__)
    joblib.dump(best_model, os.path.join(model_dir, "ml_model.pkl"))
    joblib.dump(scaler, os.path.join(model_dir, "ml_scaler.pkl"))
    joblib.dump(selected_features, os.path.join(model_dir, "ml_features.pkl"))
    log(f"模型已保存: ml_model.pkl, ml_scaler.pkl, ml_features.pkl")
except ImportError:
    log("⚠️ joblib 未安装，无法保存模型文件（pip install joblib）")

log(f"✅ 完成!")
