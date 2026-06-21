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

// 请求延迟，避免被限流
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCookie() {
  try {
    const r = await axios.get("https://music.163.com/", {
      headers: HEADERS,
      timeout: 5000
    });
    const cookies = r.headers["set-cookie"] || [];
    return cookies.map((c) => c.split(";")[0]).join("; ");
  } catch (e) {
    console.log("[Cookie] 获取失败:", e.message);
    return "";
  }
}

/**
 * 爬取单个排行榜Top N歌曲并返回
 */
async function crawlChart(chartType = "hot", topN = 50) {
  const chart = CHARTS[chartType];
  if (!chart) {
    console.log(`[排行榜] 未知排行榜类型: ${chartType}`);
    return [];
  }

  console.log(`[${chart.name}] 开始爬取...`);

  // 重试机制
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ck = await getCookie();

      // 1. 获取歌单详情拿到trackIds
      const detail = await axios.get(
        `https://music.163.com/api/v1/playlist/detail?id=${chart.id}`,
        { headers: { ...HEADERS, Cookie: ck }, timeout: 10000 }
      );

      const playlist = detail.data?.playlist || {};
      const trackIds = (playlist.trackIds || []).slice(0, topN).map((t) => t.id);

      console.log(`[${chart.name}] 获取到 ${trackIds.length} 个trackId (共${playlist.trackCount}首)`);

      if (trackIds.length === 0) {
        console.log(`[${chart.name}] 没有获取到trackId，可能请求失败`);
        continue;
      }

      // 2. 分批获取歌曲详情（API每次最多50）
      const BATCH = 50;
      const songs = [];

      for (let i = 0; i < trackIds.length; i += BATCH) {
        const batch = trackIds.slice(i, i + BATCH);

        // 每批之间延迟500ms
        if (i > 0) await sleep(500);

        try {
          const res = await axios.get(
            `https://music.163.com/api/song/detail?ids=[${batch.join(",")}]`,
            { headers: { ...HEADERS, Cookie: ck }, timeout: 10000 }
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
          console.log(`[${chart.name}] 批处理失败: ${e.message}`);
        }
      }

      console.log(`[${chart.name}] 获取到 ${songs.length} 首歌曲`);

      // 3. 按trackIds原始顺序排序并设置正确排名
      const ordered = trackIds
        .map((id, idx) => {
          const s = songs.find((x) => x.id === id);
          if (s) s.rank = idx + 1;
          return s;
        })
        .filter(Boolean);

      console.log(`[${chart.name}] 排序完成: ${ordered.length} 首`);
      return ordered;

    } catch (e) {
      lastError = e;
      console.log(`[${chart.name}] 第${attempt}次尝试失败: ${e.message}`);
      if (attempt < 3) {
        await sleep(1000 * attempt); // 递增延迟
      }
    }
  }

  console.log(`[${chart.name}] 爬取失败，已重试3次: ${lastError?.message}`);
  return [];
}

/**
 * 爬取所有排行榜并存入数据库
 */
async function crawlAndSaveAllCharts() {
  const results = {};

  for (const type of Object.keys(CHARTS)) {
    const songs = await crawlChart(type, 50);
    results[type] = songs;

    // 每个榜单之间延迟1秒
    if (type !== Object.keys(CHARTS).pop()) {
      await sleep(1000);
    }
  }

  return results;
}

/**
 * 获取指定排行榜数据
 */
async function getChartSongs(chartType = "hot") {
  const [rows] = await pool.execute(
    `SELECT * FROM hot_songs WHERE chart_type = ? ORDER BY ranking ASC`,
    [chartType]
  );
  return rows;
}

/**
 * 获取所有排行榜数据
 */
async function getAllChartSongs() {
  const [rows] = await pool.execute(`SELECT * FROM hot_songs ORDER BY chart_type, ranking ASC`);
  return rows;
}

/**
 * 批量保存排行榜数据到数据库
 */
async function saveChartsToDB(chartsData) {
  // 确保hot_songs表存在（使用复合主键，同一首歌可出现在多个榜单）
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS hot_songs (
      id BIGINT,
      chart_type VARCHAR(20) DEFAULT 'hot',
      name VARCHAR(500) NOT NULL,
      artists TEXT,
      album_name VARCHAR(500),
      album_id BIGINT,
      popularity INT DEFAULT 0,
      duration INT DEFAULT 0,
      publish_year INT,
      ranking INT DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id, chart_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  } catch (e) {
    console.log(`[排行榜] 创建表失败: ${e.message}`);
  }

  // 按榜单类型分别更新：只有爬取成功的榜单才覆盖旧数据
  let totalSaved = 0;

  for (const [chartType, songs] of Object.entries(chartsData)) {
    if (!songs || songs.length === 0) {
      console.log(`[排行榜] ${chartType} 爬取为空，保留旧数据`);
      continue;
    }

    // 只删除当前榜单的旧数据
    await pool.execute("DELETE FROM hot_songs WHERE chart_type = ?", [chartType]);

    for (const s of songs) {
      try {
        await pool.execute(
          `INSERT INTO hot_songs (id, chart_type, name, artists, album_name, album_id, popularity, duration, publish_year, ranking)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          ]
        );
        totalSaved++;
      } catch (e) {
        console.log(`[排行榜] 插入失败 id=${s.id} chart=${chartType}: ${e.message}`);
      }
    }

    console.log(`[排行榜] ${chartType} 已保存 ${songs.length} 首`);
  }

  console.log(`[排行榜] 共保存 ${totalSaved} 首到 hot_songs 表`);
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
