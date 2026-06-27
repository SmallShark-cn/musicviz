#!/usr/bin/env python3
"""对指定歌手做实时互动度预测"""

import json
import math
import os
import pickle
import sys
import warnings

import numpy as np
import pymysql
from sklearn.ensemble import GradientBoostingClassifier
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


def main():
    ids = sys.argv[1] if len(sys.argv) > 1 else ""
    if not ids:
        print(json.dumps({"error": "no ids"}))
        return
    artist_ids = [int(x.strip()) for x in ids.split(",") if x.strip()]

    conn = pymysql.connect(**DB)
    cur = conn.cursor(pymysql.cursors.DictCursor)

    # 获取这些歌手的歌曲
    placeholders = ",".join(["%s"] * len(artist_ids))
    cur.execute(
        f"""
        SELECT s.id, s.name, s.artist_id, s.plays, s.comments_count, s.duration, s.publish_year,
               a.name as artist_name, a.music_size, a.album_size
        FROM songs s JOIN artists a ON s.artist_id=a.id
        WHERE s.artist_id IN ({placeholders}) AND s.plays>0
    """,
        artist_ids,
    )
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print(json.dumps({"predictions": [], "count": 0}))
        return

    # 特征工程（同训练时）
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
    X = np.array([[d[f] for f in FEATURES] for d in data])

    # 加载训练好的模型
    with open(os.path.join(SCRIPT_DIR, "ml_result.json")) as f:
        saved = json.load(f)

    # 用预处理数据训练简单模型（快速）
    # 或者使用 sklearn pipeline（保存的模型）
    # 当前简化：重新训练（数据少，很快）
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler

    # 用现有数据构造标签
    comments = [math.log(float(r["comments_count"] or 0) + 1) for r in rows]
    scores = []
    for c in [float(r["comments_count"] or 0) for r in rows]:
        if c == 0:
            s = 1
        elif c < 500:
            s = 2
        elif c < 5000:
            s = 3
        elif c < 30000:
            s = 4
        else:
            s = 5
        scores.append(s)

    X_scaled = StandardScaler().fit_transform(X)
    model = GradientBoostingClassifier(
        **saved.get(
            "best_params", {"n_estimators": 100, "max_depth": 5, "learning_rate": 0.1}
        )
    )
    model.fit(X_scaled, scores)
    preds = model.predict(X_scaled)

    results = []
    for i, r in enumerate(rows):
        results.append(
            {
                "id": r["id"],
                "name": r["name"],
                "artist": r["artist_name"],
                "plays": int(r["plays"]),
                "comments": int(r["comments_count"] or 0),
                "actual_score": scores[i],
                "predicted_score": int(preds[i]),
                "is_correct": scores[i] == int(preds[i]),
            }
        )

    correct = sum(1 for r in results if r["is_correct"])
    print(
        json.dumps(
            {
                "predictions": results,
                "count": len(results),
                "accuracy": round(correct / len(results) * 100, 1) if results else 0,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
