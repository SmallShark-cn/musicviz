#!/usr/bin/env python3
"""实时预测脚本 — 接收 JSON 数据，输出预测结果"""
import json
import math
import sys

import joblib
import numpy as np

# 加载模型
model = joblib.load("ml_model.pkl")
scaler = joblib.load("ml_scaler.pkl")
features = joblib.load("ml_features.pkl")

# 读取输入
input_data = json.loads(sys.argv[1])

def extract_features(song):
    plays = float(song["plays"] or 0)
    duration_min = float(song["duration"] or 0) / 1000 / 60
    publish_year = float(song["publish_year"] or 0)
    music_size = float(song["music_size"] or 0)
    album_size = float(song["album_size"] or 0)
    era = 2026 - publish_year if publish_year > 0 else 50

    return {
        "plays": plays,
        "log_plays": math.log(plays + 1),
        "sqrt_plays": math.sqrt(plays),
        "duration_min": duration_min,
        "duration_log": math.log(duration_min + 0.1),
        "era": era,
        "era_sqrt": math.sqrt(max(era, 0)),
        "music_size": music_size,
        "album_size": album_size,
        "productivity": music_size / max(era, 1),
        "is_long_song": 1 if duration_min > 5 else 0,
        "is_old_song": 1 if era > 10 else 0,
    }

# 预测
results = []
for song in input_data:
    feat = extract_features(song)
    X = np.array([[feat[f] for f in features]])
    X_scaled = scaler.transform(X)
    pred = int(model.predict(X_scaled)[0])
    proba = model.predict_proba(X_scaled)[0]
    conf = float(max(proba))

    results.append({
        "id": song["id"],
        "name": song["name"],
        "plays": song["plays"],
        "comments": song["comments"],
        "predicted_score": pred,
        "confidence": round(conf, 4),
    })

print(json.dumps(results, ensure_ascii=False))
