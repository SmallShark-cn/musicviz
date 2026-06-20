// ============================================================
// 机器学习 — 歌手相似度推荐系统
// 基于内容特征向量 + 余弦相似度
// ============================================================

const { pool } = require("./db");

/**
 * 构建歌手的特征向量
 * 从 songs 表和 artists 表中提取数值特征
 */
async function buildFeatureVector(artistId) {
  const [[artist]] = await pool.execute(
    `SELECT id, album_size, music_size FROM artists WHERE id = ?`,
    [artistId],
  );
  if (!artist) return null;

  const [songs] = await pool.execute(
    `SELECT plays, duration, publish_year FROM songs WHERE artist_id = ? ORDER BY plays DESC`,
    [artistId],
  );
  if (songs.length === 0) return null;

  const pops = songs.filter((s) => s.plays > 0).map((s) => s.plays);
  const years = songs
    .filter((s) => s.publish_year)
    .map((s) => s.publish_year);
  const durations = songs
    .filter((s) => s.duration > 0)
    .map((s) => s.duration);

  const avgPop = pops.length > 0
    ? pops.reduce((a, b) => a + b, 0) / pops.length
    : 0;
  const maxPop = pops.length > 0 ? Math.max(...pops) : 0;
  const yearRange =
    years.length > 1 ? Math.max(...years) - Math.min(...years) : 0;
  const avgYear = years.length > 0
    ? years.reduce((a, b) => a + b, 0) / years.length
    : 0;
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  // 特征向量: [歌曲数, 专辑数, 平均热度, 最高热度, 活跃年数, 平均年份偏移(从1980起), 平均时长]
  return [
    Math.log((artist.music_size || 1) + 1),      // 歌曲数（log平滑）
    Math.log((artist.album_size || 1) + 1),       // 专辑数
    avgPop / 100,                                   // 平均热度 (0-1)
    maxPop / 100,                                   // 最高热度 (0-1)
    Math.min(yearRange / 30, 1),                   // 活跃跨度 (归一化到0-1)
    Math.min(Math.max((avgYear - 1980) / 40, 0), 1), // 年代偏移 (1980-2020→0-1)
    Math.min(avgDuration / 600000, 1),             // 平均时长 (到10分钟归一化)
  ];
}

/**
 * 余弦相似度
 */
function cosineSimilarity(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * 为单个歌手计算Top-N相似歌手并写入数据库
 */
async function computeSimilarArtists(artistId, topN = 10) {
  const vecA = await buildFeatureVector(artistId);
  if (!vecA) return [];

  // 取所有有歌曲数据的歌手
  const [candidates] = await pool.execute(
    `SELECT DISTINCT s.artist_id FROM songs s WHERE s.artist_id != ?`,
    [artistId],
  );

  const similarities = [];
  for (const c of candidates) {
    const vecB = await buildFeatureVector(c.artist_id);
    if (vecB) {
      const sim = cosineSimilarity(vecA, vecB);
      similarities.push({ id: c.artist_id, score: sim });
    }
  }

  // 按相似度排序取Top-N
  similarities.sort((a, b) => b.score - a.score);
  const top = similarities.slice(0, topN);

  // 写入数据库
  await pool.execute("DELETE FROM similar_artists WHERE artist_id = ?", [
    artistId,
  ]);
  for (const t of top) {
    if (t.score > 0.1) {
      await pool
        .execute(
          `INSERT INTO similar_artists (artist_id, similar_artist_id, similarity_score) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE similarity_score = VALUES(similarity_score)`,
          [artistId, t.id, Math.round(t.score * 100) / 100],
        )
        .catch(() => {});
    }
  }

  console.log(
    `[ML] ${artistId} → Top${topN} 相似歌手计算完成 (最高相似度: ${top[0]?.score?.toFixed(3) || 0})`,
  );
  return top;
}

/**
 * 批量计算所有歌手的相似度
 */
async function computeAllSimilarities() {
  const [artists] = await pool.execute(
    `SELECT DISTINCT s.artist_id FROM songs s`,
  );
  console.log(`[ML] 开始批量计算 ${artists.length} 位歌手的相似度...`);

  let count = 0;
  for (const a of artists) {
    try {
      await computeSimilarArtists(a.artist_id, 5);
      count++;
      if (count % 20 === 0)
        console.log(`[ML] 已完成 ${count}/${artists.length}`);
    } catch (e) {
      // 跳过
    }
  }
  console.log(`[ML] ✅ 批量计算完成: ${count}/${artists.length}`);
}

module.exports = { computeSimilarArtists, computeAllSimilarities, buildFeatureVector };
