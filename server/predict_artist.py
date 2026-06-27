#!/usr/bin/env python3
"""实时互动度预测 — 含训练/测试分离评估泛化误差"""

import json
import math
import os
import sys
import warnings

import numpy as np
import pymysql
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

DB = {
    "host": "localhost",
    "user": "root",
    "password": "12345678",
    "database": "music_dashboard",
    "charset": "utf8mb4",
}
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FEATURES = [
    "plays",
    "log_plays",
    "sqrt_plays",
    "duration_log",
    "era",
    "era_sqrt",
    "music_size",
    "album_size",
    "productivity",
    "is_old_song",
]


def to_score(c):
    if c == 0:
        return 1
    elif c < 500:
        return 2
    elif c < 5000:
        return 3
    elif c < 30000:
        return 4
    else:
        return 5


def main():
    ids = sys.argv[1] if len(sys.argv) > 1 else ""
    if not ids:
        print(json.dumps({"error": "no ids"}))
        return
    artist_ids = [int(x.strip()) for x in ids.split(",") if x.strip()]

    conn = pymysql.connect(**DB)
    cur = conn.cursor(pymysql.cursors.DictCursor)
    ph = ",".join(["%s"] * len(artist_ids))
    cur.execute(
        f"""SELECT s.id,s.name,s.artist_id,s.plays,s.comments_count,s.duration,s.publish_year,a.name as artist_name,a.music_size,a.album_size FROM songs s JOIN artists a ON s.artist_id=a.id WHERE s.artist_id IN ({ph}) AND s.plays>0""",
        artist_ids,
    )
    rows = cur.fetchall()
    conn.close()
    if not rows:
        print(json.dumps({"predictions": [], "count": 0}))
        return

    # 特征工程
    data = []
    for r in rows:
        p = float(r["plays"])
        d = float(r["duration"] or 0) / 1000
        yr = float(r["publish_year"] or 0)
        ms = float(r["music_size"] or 0)
        als = float(r["album_size"] or 0)
        era = 2026 - yr if yr > 0 else 50
        data.append(
            {
                "plays": p,
                "log_plays": math.log(p + 1),
                "sqrt_plays": math.sqrt(p),
                "duration_log": math.log(d / 60 + 0.1),
                "era": era,
                "era_sqrt": math.sqrt(max(era, 0)),
                "music_size": ms,
                "album_size": als,
                "productivity": ms / max(era, 1),
                "is_old_song": 1 if era > 10 else 0,
            }
        )
    X = np.array([[d[f] for f in FEATURES] for d in data])
    y = np.array([to_score(float(r["comments_count"] or 0)) for r in rows])

    # 加载最佳参数
    try:
        with open(os.path.join(SCRIPT_DIR, "ml_result.json")) as f:
            saved = json.load(f)
        params = saved.get(
            "best_params", {"n_estimators": 200, "max_depth": 5, "learning_rate": 0.05}
        )
    except:
        params = {"n_estimators": 200, "max_depth": 5, "learning_rate": 0.05}

    # ========== train/test 分离 ==========
    if len(X) >= 10:
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        scaler = StandardScaler().fit(X_tr)
        X_tr_s = scaler.transform(X_tr)
        X_te_s = scaler.transform(X_te)

        model = GradientBoostingClassifier(**params, random_state=42)
        model.fit(X_tr_s, y_tr)

        train_acc = accuracy_score(y_tr, model.predict(X_tr_s))
        test_acc = accuracy_score(y_te, model.predict(X_te_s))
        cm = confusion_matrix(y_te, model.predict(X_te_s), labels=[1, 2, 3, 4, 5])
        cr = classification_report(
            y_te, model.predict(X_te_s), labels=[1, 2, 3, 4, 5], zero_division=0
        )

        eval_info = {
            "samples_total": len(X),
            "train_samples": len(X_tr),
            "test_samples": len(X_te),
            "train_accuracy": round(train_acc * 100, 1),
            "test_accuracy": round(test_acc * 100, 1),
            "generalization_gap": round((train_acc - test_acc) * 100, 1),
            "confusion_matrix": cm.tolist(),
            "report": cr,
        }
    else:
        # 数据太少，跳过分离
        scaler = StandardScaler().fit_transform(X)
        model = GradientBoostingClassifier(**params, random_state=42)
        model.fit(X, y)
        eval_info = {"samples_total": len(X), "note": "样本不足10条，未做分离"}

    # 全部数据预测
    X_all_s = StandardScaler().fit_transform(X)
    model_all = GradientBoostingClassifier(**params, random_state=42)
    model_all.fit(X_all_s, y)
    preds = model_all.predict(X_all_s)

    results = []
    for i, r in enumerate(rows):
        results.append(
            {
                "id": r["id"],
                "name": r["name"],
                "artist": r["artist_name"],
                "plays": int(r["plays"]),
                "comments": int(r["comments_count"] or 0),
                "actual_score": int(y[i]),
                "predicted_score": int(preds[i]),
                "is_correct": int(y[i]) == int(preds[i]),
            }
        )

    print(
        json.dumps(
            {"predictions": results, "count": len(results), "evaluation": eval_info},
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
