// ============================================================
// 热歌榜爬虫 — 从热歌榜获取当前热门歌曲
// 歌单ID: 3778678
// ============================================================

const axios = require("axios");
const { pool } = require("./db");

const PLAYLIST_ID = 3778678;
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
};

async function getCookie() {
  const r = await axios
    .get("https://music.163.com/", { headers: HEADERS, timeout: 5000 })
    .catch(() => ({ headers: {} }));
  return (r.headers["set-cookie"] || []).map((c) => c.split(";")[0]).join("; ");
}

/**
 * 爬取热歌榜Top N歌曲并返回
 */
async function crawlHotSongs(topN = 100) {
  console.log(`[热歌榜] 开始爬取...`);
  const ck = await getCookie();

  // 1. 获取歌单详情拿到trackIds
  const detail = await axios.get(
    `https://music.163.com/api/v1/playlist/detail?id=${PLAYLIST_ID}`,
    { headers: { ...HEADERS, Cookie: ck }, timeout: 10000 },
  );
  const playlist = detail.data?.playlist || {};
  const trackIds = (playlist.trackIds || []).slice(0, topN).map((t) => t.id);
  console.log(
    `[热歌榜] 获取到 ${trackIds.length} 个trackId (共${playlist.trackCount}首)`,
  );

  if (trackIds.length === 0) return [];

  // 2. 分批获取歌曲详情（API每次最多50）
  const BATCH = 50;
  const songs = [];
  for (let i = 0; i < trackIds.length; i += BATCH) {
    const batch = trackIds.slice(i, i + BATCH);
    try {
      const res = await axios.get(
        `https://music.163.com/api/song/detail?ids=[${batch.join(",")}]`,
        { headers: { ...HEADERS, Cookie: ck }, timeout: 10000 },
      );
      const batchSongs = (res.data?.songs || []).map((s) => ({
        id: s.id,
        name: s.name,
        artists: (s.artists || []).map((a) => ({ id: a.id, name: a.name })),
        album: s.album
          ? { id: s.album.id, name: s.album.name, cover: s.album.picUrl }
          : null,
        popularity: s.popularity || 0,
        duration: s.duration || 0,
        publish_time: s.publishTime || null,
        rank: 0, // 后面统一按 trackIds 排序
      }));
      songs.push(...batchSongs);
    } catch (e) {
      console.log(`[热歌榜] 批处理失败: ${e.message}`);
    }
  }

  console.log(`[热歌榜] ✅ 获取到 ${songs.length} 首歌曲`);

  // 按trackIds原始顺序排序并设置正确排名
  const ordered = trackIds
    .map((id, idx) => {
      const s = songs.find((x) => x.id === id);
      if (s) s.rank = idx + 1;
      return s;
    })
    .filter(Boolean);

  console.log(`[热歌榜] 排序完成: ${ordered.length} 首`);
  return ordered;
}

/**
 * 爬取热歌榜并存入数据库
 */
async function crawlAndSaveHotSongs() {
  const songs = await crawlHotSongs(100);
  if (songs.length === 0) return songs;

  // 确保hot_songs表存在
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS hot_songs (
      id BIGINT PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      artists TEXT,
      album_name VARCHAR(500),
      album_id BIGINT,
      popularity INT DEFAULT 0,
      duration INT DEFAULT 0,
      publish_year INT,
      ranking INT DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  } catch {}

  // 清空旧数据写新数据
  await pool.execute("DELETE FROM hot_songs");
  for (const s of songs) {
    try {
      await pool.execute(
        `INSERT INTO hot_songs (id, name, artists, album_name, album_id, popularity, duration, publish_year, ranking) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.name,
          JSON.stringify(s.artists),
          s.album?.name || "",
          s.album?.id || 0,
          s.popularity,
          s.duration,
          s.publish_time ? new Date(s.publish_time).getFullYear() : null,
          s.rank,
        ],
      );
    } catch {}
  }

  console.log(`[热歌榜] ✅ 已存入 ${songs.length} 首到 hot_songs 表`);
  return songs;
}

module.exports = { crawlHotSongs, crawlAndSaveHotSongs };
