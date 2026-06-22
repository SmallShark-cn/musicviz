// ============================================================
// 排行榜爬虫 — 支持多个排行榜
// ============================================================

const axios = require("axios");
const { pool } = require("./db");

// 排行榜配置
const CHARTS = {
  hot: { id: 3778678, name: "热歌榜" },
  rising: { id: 19723756, name: "飙升榜" },
  new: { id: 3779629, name: "新歌榜" },
  original: { id: 2884035, name: "原创榜" },
};

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
 * 爬取单个排行榜Top N歌曲并返回
 */
async function crawlChart(chartType = "hot", topN = 100) {
  const chart = CHARTS[chartType];
  if (!chart) {
    console.log("[排行榜] 未知排行榜类型:", chartType);
    return [];
  }

  console.log("[" + chart.name + "] 开始爬取...");
  const ck = await getCookie();

  // 1. 获取歌单详情拿到trackIds
  const detail = await axios.get(
    "https://music.163.com/api/v1/playlist/detail?id=" + chart.id,
    { headers: { ...HEADERS, Cookie: ck }, timeout: 10000 },
  );
  const playlist = detail.data?.playlist || {};
  const trackIds = (playlist.trackIds || []).slice(0, topN).map((t) => t.id);
  console.log(
    "[" + chart.name + "] 获取到 " + trackIds.length + " 个trackId (共" + playlist.trackCount + "首)",
  );

  if (trackIds.length === 0) return [];

  // 2. 分批获取歌曲详情（API每次最多50）
  const BATCH = 50;
  const songs = [];
  for (let i = 0; i < trackIds.length; i += BATCH) {
    const batch = trackIds.slice(i, i + BATCH);
    try {
      const res = await axios.get(
        "https://music.163.com/api/song/detail?ids=[" + batch.join(",") + "]",
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
        rank: 0,
        chart_type: chartType,
        chart_name: chart.name,
      }));
      songs.push(...batchSongs);
    } catch (e) {
      console.log("[" + chart.name + "] 批处理失败:", e.message);
    }
  }

  console.log("[" + chart.name + "] 获取到 " + songs.length + " 首歌曲");

  // 按trackIds原始顺序排序并设置正确排名
  const ordered = trackIds
    .map((id, idx) => {
      const s = songs.find((x) => x.id === id);
      if (s) s.rank = idx + 1;
      return s;
    })
    .filter(Boolean);

  console.log("[" + chart.name + "] 排序完成: " + ordered.length + " 首");
  return ordered;
}

/**
 * 爬取所有排行榜并存入数据库
 */
async function crawlAndSaveAllCharts() {
  const results = {};
  for (const type of Object.keys(CHARTS)) {
    const songs = await crawlChart(type, 50);
    results[type] = songs;
  }
  return results;
}

/**
 * 获取指定排行榜数据
 */
async function getChartSongs(chartType = "hot") {
  const [rows] = await pool.execute(
    "SELECT * FROM hot_songs WHERE chart_type = ? ORDER BY ranking ASC",
    [chartType],
  );
  return rows;
}

/**
 * 获取所有排行榜数据
 */
async function getAllChartSongs() {
  const [rows] = await pool.execute(
    "SELECT * FROM hot_songs ORDER BY chart_type, ranking ASC",
  );
  return rows;
}

/**
 * 批量保存排行榜数据到数据库
 * 按榜单类型分别更新：只有爬取成功的榜单才覆盖旧数据
 */
async function saveChartsToDB(chartsData) {
  // 确保hot_songs表存在（使用复合主键，同一首歌可出现在多个榜单）
  try {
    await pool.execute(
      "CREATE TABLE IF NOT EXISTS hot_songs (" +
        "id BIGINT," +
        "chart_type VARCHAR(20) DEFAULT 'hot'," +
        "name VARCHAR(500) NOT NULL," +
        "artists TEXT," +
        "album_name VARCHAR(500)," +
        "album_id BIGINT," +
        "popularity INT DEFAULT 0," +
        "duration INT DEFAULT 0," +
        "publish_year INT," +
        "ranking INT DEFAULT 0," +
        "last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
        "PRIMARY KEY (id, chart_type)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    );

    // 尝试添加可能缺失的 chart_type 列（兼容旧表）
    try {
      await pool.execute(
        "ALTER TABLE hot_songs ADD COLUMN chart_type VARCHAR(20) DEFAULT 'hot'",
      );
    } catch {}

    // 检测旧表结构：如果主键只有 id 单列，则重建表
    try {
      const [keys] = await pool.execute(
        "SHOW KEYS FROM hot_songs WHERE Key_name = 'PRIMARY'",
      );
      if (keys.length === 1 && keys[0].Column_name === "id") {
        console.log("[排行榜] 检测到旧表结构（单列主键），正在重建...");
        await pool.execute("DROP TABLE IF EXISTS hot_songs");
        await pool.execute(
          "CREATE TABLE hot_songs (" +
            "id BIGINT," +
            "chart_type VARCHAR(20) DEFAULT 'hot'," +
            "name VARCHAR(500) NOT NULL," +
            "artists TEXT," +
            "album_name VARCHAR(500)," +
            "album_id BIGINT," +
            "popularity INT DEFAULT 0," +
            "duration INT DEFAULT 0," +
            "publish_year INT," +
            "ranking INT DEFAULT 0," +
            "last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
            "PRIMARY KEY (id, chart_type)" +
            ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        );
        console.log("[排行榜] 表结构已更新为复合主键");
      }
    } catch (e) {
      console.log("[排行榜] 检查主键结构时出错:", e.message);
    }
  } catch (e) {
    console.log("[排行榜] 创建表失败:", e.message);
  }

  // 按榜单类型分别更新：只有爬取成功的榜单才覆盖旧数据
  let totalSaved = 0;
  for (const [chartType, songs] of Object.entries(chartsData)) {
    if (!songs || songs.length === 0) {
      console.log("[排行榜] " + chartType + " 爬取为空，保留旧数据");
      continue;
    }

    // 只删除当前榜单的旧数据
    await pool.execute("DELETE FROM hot_songs WHERE chart_type = ?", [chartType]);

    for (const s of songs) {
      try {
        await pool.execute(
          "INSERT INTO hot_songs (id, chart_type, name, artists, album_name, album_id, popularity, duration, publish_year, ranking) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            s.id,
            chartType,
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
        totalSaved++;
      } catch (e) {
        console.log(
          "[排行榜] 插入失败 id=" + s.id + " chart=" + chartType + ":",
          e.message,
        );
      }
    }
  }

  console.log("[排行榜] 已存入 " + totalSaved + " 首到 hot_songs 表");
  return totalSaved;
}

module.exports = {
  CHARTS,
  crawlChart,
  crawlAndSaveAllCharts,
  saveChartsToDB,
  getChartSongs,
  getAllChartSongs,
};
