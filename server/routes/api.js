const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const crawler = require("../crawler");
const scraper = require("../scraper");
const hotSongs = require("../hot_songs");

// ============================================================
// 🔍 搜索 API — 爬虫实时搜索网易云音乐
// ============================================================

router.get("/search/artists", async (req, res) => {
  const { keyword, limit = 10, offset = 0 } = req.query;
  if (!keyword) return res.json({ code: 400, data: [], msg: "请输入关键词" });

  try {
    // 始终优先用爬虫实时搜索（获取最新数据）
    const result = await crawler.search(
      keyword,
      "100",
      parseInt(limit),
      parseInt(offset),
    );
    const data = result.artists.map((a) => ({
      id: a.id,
      name: a.name,
      avatar_url: a.avatar_url || "",
      followers: 0,
      region: "",
      brief_desc: a.brief_desc || "",
      music_size: a.music_size || 0,
      album_size: a.album_size || 0,
      identity: a.identity || [],
    }));
    console.log(
      `[Search] 爬虫: "${keyword}" → ${data.length} 条 (共 ${result.total})`,
    );
    return res.json({
      code: 200,
      data,
      total: result.total,
      source: "crawler",
    });
  } catch (err) {
    // 爬虫失败时回退本地库
    try {
      const _limit = parseInt(limit),
        _offset = parseInt(offset);
      const [rows] = await pool.query(
        `SELECT id, name, avatar_url, album_size, music_size FROM artists WHERE name LIKE ${pool.escape(`%${keyword}%`)} ORDER BY music_size DESC LIMIT ${_limit} OFFSET ${_offset}`,
      );
      const data = rows.map((r) => ({
        id: r.id,
        name: r.name,
        avatar_url: r.avatar_url || "",
        followers: 0,
        region: "",
        brief_desc: "",
        music_size: r.music_size || 0,
        album_size: r.album_size || 0,
        identity: [],
      }));
      return res.json({ code: 200, data, total: data.length, source: "local" });
    } catch {
      return res.json({ code: 200, data: [], total: 0, source: "none" });
    }
  }
});

// 获取所有歌手（用于大屏初始展示）
router.get("/artists", async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const _limit = parseInt(limit),
      _offset = parseInt(offset);
    const [rows] = await pool.query(
      `SELECT id, name, avatar_url, followers, region
       FROM artists
       ORDER BY followers DESC
       LIMIT ${_limit} OFFSET ${_offset}`,
    );
    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) as total FROM artists",
    );
    res.json({ code: 200, data: rows, total });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// ============================================================
// 🏆 歌手详情 & 核心指标
// ============================================================

// 获取歌手详情
router.get("/artist/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [[artist]] = await pool.execute(
      "SELECT * FROM artists WHERE id = ?",
      [id],
    );
    if (!artist) return res.json({ code: 404, msg: "歌手不存在" });

    // 获取核心指标
    const [[stats]] = await pool.execute(
      `SELECT
        COUNT(DISTINCT s.id) as song_count,
        COALESCE(SUM(s.plays), 0) as total_plays,
        COALESCE(SUM(s.comments_count), 0) as total_comments
       FROM songs s WHERE s.artist_id = ?`,
      [id],
    );

    // 获取风格标签
    const [styles] = await pool.execute(
      `SELECT st.name, st.category
       FROM styles st
       JOIN artist_styles ast ON st.id = ast.style_id
       WHERE ast.artist_id = ?`,
      [id],
    );

    res.json({
      code: 200,
      data: { ...artist, ...stats, styles },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// ============================================================
// 📊 可视化数据 API
// ============================================================

// 3.1 饼图 — 风格标签占比
router.get("/chart/style-pie", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT st.name, COUNT(DISTINCT ast.artist_id) as count
       FROM styles st
       JOIN artist_styles ast ON st.id = ast.style_id
       GROUP BY st.id, st.name
       ORDER BY count DESC`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.2 Top10歌曲播放量 (竖柱状图)
router.get("/chart/top10-plays", async (req, res) => {
  try {
    const { artist_id } = req.query;
    let sql = `SELECT s.name, s.plays, a.name as artist_name
               FROM songs s JOIN artists a ON s.artist_id = a.id`;
    const params = [];
    if (artist_id) {
      sql += " WHERE s.artist_id = ?";
      params.push(artist_id);
    }
    sql += " ORDER BY s.plays DESC LIMIT 10";
    const [rows] = await pool.execute(sql, params);
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.3 Top10歌曲评论数 (横柱状图)
router.get("/chart/top10-comments", async (req, res) => {
  try {
    const { artist_id } = req.query;
    let sql = `SELECT s.name, s.comments_count, a.name as artist_name
               FROM songs s JOIN artists a ON s.artist_id = a.id`;
    const params = [];
    if (artist_id) {
      sql += " WHERE s.artist_id = ?";
      params.push(artist_id);
    }
    sql += " ORDER BY s.comments_count DESC LIMIT 10";
    const [rows] = await pool.execute(sql, params);
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.4 播放量随排名下降趋势 (折线图)
router.get("/chart/plays-trend", async (req, res) => {
  try {
    const { artist_id } = req.query;
    let sql = `SELECT s.ranking, s.plays, s.name
               FROM songs s`;
    const params = [];
    if (artist_id) {
      sql += " WHERE s.artist_id = ?";
      params.push(artist_id);
    }
    sql += " ORDER BY s.ranking ASC LIMIT 50";
    const [rows] = await pool.execute(sql, params);
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.5 不同专辑年代热度变化 (折线图)
router.get("/chart/era-trend", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.publish_year, SUM(s.plays) as total_plays, COUNT(*) as song_count
       FROM songs s
       WHERE s.publish_year IS NOT NULL AND s.publish_year > 0
       GROUP BY s.publish_year
       ORDER BY s.publish_year ASC`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.7 评论高频词 (词云)
router.get("/chart/comment-wordcloud", async (req, res) => {
  try {
    const { artist_id, limit = 100 } = req.query;
    let sql = `SELECT c.content FROM comments c`;
    const params = [];
    if (artist_id) {
      sql += ` JOIN songs s ON c.song_id = s.id WHERE s.artist_id = ?`;
      params.push(artist_id);
    }
    sql += ` LIMIT ${parseInt(limit) * 5}`;
    const [rows] = await pool.query(sql, params);
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.8 热力图 — 风格与粉丝数相关性
router.get("/chart/style-heatmap", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT st.name as style,
        AVG(a.followers) as avg_followers,
        COUNT(DISTINCT a.id) as artist_count,
        MIN(a.followers) as min_followers,
        MAX(a.followers) as max_followers
       FROM styles st
       JOIN artist_styles ast ON st.id = ast.style_id
       JOIN artists a ON ast.artist_id = a.id
       GROUP BY st.id, st.name
       ORDER BY avg_followers DESC`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.9 箱线图 — 各风格歌手粉丝分布
router.get("/chart/style-boxplot", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT st.name as style, a.followers
       FROM styles st
       JOIN artist_styles ast ON st.id = ast.style_id
       JOIN artists a ON ast.artist_id = a.id
       ORDER BY st.name`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.10 散点图 — 粉丝数 vs 平均评论数
router.get("/chart/scatter", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.id, a.name, a.followers,
        COALESCE(AVG(s.comments_count), 0) as avg_comments,
        COUNT(s.id) as song_count
       FROM artists a
       LEFT JOIN songs s ON a.id = s.artist_id
       GROUP BY a.id, a.name, a.followers
       HAVING a.followers > 0`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.11 雷达图 — 多歌手对比
router.get("/chart/radar", async (req, res) => {
  try {
    const { ids } = req.query; // 逗号分隔的歌手id
    const artistIds = ids ? ids.split(",").map(Number) : [];
    if (artistIds.length === 0) {
      // 默认取Top5粉丝最多的歌手
      const [top] = await pool.execute(
        "SELECT id FROM artists ORDER BY followers DESC LIMIT 5",
      );
      artistIds.push(...top.map((r) => r.id));
    }
    const placeholders = artistIds.map(() => "?").join(",");

    const [rows] = await pool.execute(
      `SELECT a.id, a.name, a.followers,
        COUNT(DISTINCT s.id) as hot_songs,
        COUNT(DISTINCT ast.style_id) as style_count,
        COALESCE(SUM(s.comments_count), 0) as total_comments
       FROM artists a
       LEFT JOIN songs s ON a.id = s.artist_id
       LEFT JOIN artist_styles ast ON a.id = ast.artist_id
       WHERE a.id IN (${placeholders})
       GROUP BY a.id, a.name, a.followers`,
      artistIds,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.13 环形图 — Top5专辑评论占比
router.get("/chart/album-donut", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT al.name, al.comment_count, a.name as artist_name
       FROM albums al
       JOIN artists a ON al.artist_id = a.id
       ORDER BY al.comment_count DESC
       LIMIT 5`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.14 小提琴图 — 各风格播放量分布
router.get("/chart/violin", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT st.name as style, s.plays
       FROM styles st
       JOIN artist_styles ast ON st.id = ast.style_id
       JOIN songs s ON ast.artist_id = s.artist_id
       WHERE s.plays > 0
       ORDER BY st.name`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.15 堆叠柱状图 — 不同时期风格变化
router.get("/chart/stacked-era", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        CASE
          WHEN s.publish_year < 2000 THEN '2000年前'
          WHEN s.publish_year BETWEEN 2000 AND 2009 THEN '2000-2009'
          WHEN s.publish_year BETWEEN 2010 AND 2014 THEN '2010-2014'
          WHEN s.publish_year BETWEEN 2015 AND 2019 THEN '2015-2019'
          ELSE '2020及以后'
        END as era,
        st.name as style,
        COUNT(DISTINCT s.artist_id) as artist_count
       FROM songs s
       JOIN artist_styles ast ON s.artist_id = ast.artist_id
       JOIN styles st ON ast.style_id = st.id
       WHERE s.publish_year IS NOT NULL AND s.publish_year > 0
       GROUP BY era, st.name
       ORDER BY era, artist_count DESC`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.16 桑基图 — 歌手→风格→粉丝群体
router.get("/chart/sankey", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.name as artist, st.name as style,
        CASE
          WHEN a.followers < 100000 THEN '小型(<10万)'
          WHEN a.followers < 1000000 THEN '中型(10-100万)'
          WHEN a.followers < 5000000 THEN '大型(100-500万)'
          ELSE '超级(>500万)'
        END as fan_level,
        a.followers
       FROM artists a
       JOIN artist_styles ast ON a.id = ast.artist_id
       JOIN styles st ON ast.style_id = st.id
       WHERE a.followers > 0
       LIMIT 200`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.17 分组柱状图 — 不同歌手同一指标对比
router.get("/chart/grouped-bar", async (req, res) => {
  try {
    const { ids } = req.query;
    const artistIds = ids ? ids.split(",").map(Number) : [];
    if (artistIds.length === 0) {
      const [top] = await pool.execute(
        "SELECT id FROM artists ORDER BY followers DESC LIMIT 5",
      );
      artistIds.push(...top.map((r) => r.id));
    }
    const placeholders = artistIds.map(() => "?").join(",");
    const [rows] = await pool.execute(
      `SELECT a.name,
        COUNT(DISTINCT s.id) as song_count,
        COALESCE(SUM(s.plays), 0) as total_plays,
        COALESCE(SUM(s.comments_count), 0) as total_comments
       FROM artists a
       LEFT JOIN songs s ON a.id = s.artist_id
       WHERE a.id IN (${placeholders})
       GROUP BY a.id, a.name
       ORDER BY total_plays DESC`,
      artistIds,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.18 气泡图 — 粉丝/播放/评论三维关系
router.get("/chart/bubble", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT a.name, a.followers,
        COALESCE(SUM(s.plays), 0) as total_plays,
        COALESCE(AVG(s.comments_count), 0) as avg_comments,
        COUNT(DISTINCT s.id) as song_count
       FROM artists a
       LEFT JOIN songs s ON a.id = s.artist_id
       GROUP BY a.id, a.name, a.followers
       HAVING a.followers > 0
       ORDER BY a.followers DESC
       LIMIT 30`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// ============================================================
// 🗺️ 地图数据
// ============================================================

// 4.1 歌手归属地热力地图
router.get("/chart/region-map", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT region, region_code, COUNT(*) as artist_count,
        SUM(followers) as total_followers
       FROM artists
       WHERE region IS NOT NULL AND region != ''
       GROUP BY region, region_code
       ORDER BY total_followers DESC`,
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// ============================================================
// 📈 仪表盘总览
// ============================================================

router.get("/dashboard/overview", async (req, res) => {
  try {
    const [[artistCount]] = await pool.execute(
      "SELECT COUNT(*) as total FROM artists",
    );
    const [[songCount]] = await pool.execute(
      "SELECT COUNT(*) as total FROM songs",
    );
    const [[totalPlays]] = await pool.execute(
      "SELECT COALESCE(SUM(plays), 0) as total FROM songs",
    );
    const [[totalComments]] = await pool.execute(
      "SELECT COALESCE(SUM(comments_count), 0) as total FROM songs",
    );
    const [[styleCount]] = await pool.execute(
      "SELECT COUNT(*) as total FROM styles",
    );

    res.json({
      code: 200,
      data: {
        artist_count: artistCount.total,
        song_count: songCount.total,
        total_plays: totalPlays.total,
        total_comments: totalComments.total,
        style_count: styleCount.total,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 获取单个歌手的歌曲列表
router.get("/artist/:id/songs", async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    const [rows] = await pool.execute(
      `SELECT * FROM songs WHERE artist_id = ? ORDER BY plays DESC LIMIT ?`,
      [id, parseInt(limit)],
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 获取歌手热门歌曲热度（爬虫实时）
router.get("/artist/:id/popularity", async (req, res) => {
  try {
    const { id } = req.params;
    const songs = await crawler.getArtistTopSongs(parseInt(id));
    const pops = songs.filter((s) => s.plays > 0).map((s) => s.plays);
    res.json({
      code: 200,
      data: {
        avg_pop:
          pops.length > 0
            ? Math.round(pops.reduce((a, b) => a + b, 0) / pops.length)
            : 0,
        max_pop: pops.length > 0 ? Math.max(...pops) : 0,
      },
    });
  } catch (err) {
    res.json({ code: 200, data: { avg_pop: 0, max_pop: 0 } });
  }
});

// 抓取歌手数据并入库
router.get("/artist/:id/crawl", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await scraper.crawlAndSaveArtist(parseInt(id));
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error(`[Crawl] 抓取失败: ${err.message}`);
    res.json({ code: 200, data: null, msg: err.message });
  }
});

// 获取相似歌手
router.get("/artist/:id/similar", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT sa.similar_artist_id, sa.similarity_score, a.name, a.avatar_url
       FROM similar_artists sa
       JOIN artists a ON a.id = sa.similar_artist_id
       WHERE sa.artist_id = ?
       ORDER BY sa.similarity_score DESC
       LIMIT 6`,
      [parseInt(id)]
    );
    res.json({ code: 200, data: rows });
  } catch (err) {
    res.json({ code: 200, data: [], msg: err.message });
  }
});

// 批量爬取歌手ID（全量）
router.get("/crawl/ids", async (req, res) => {
  try {
    const artistCrawler = require("../artist_crawler");
    const result = await artistCrawler.crawlAllArtistIds();
    res.json({ code: 200, data: { count: result.length } });
  } catch (err) {
    res.json({ code: 500, data: null, msg: err.message });
  }
});

// 批量爬取歌手详情
router.get("/crawl/details", async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const artistCrawler = require("../artist_crawler");
    const result = await artistCrawler.crawlArtistDetails(
      parseInt(limit),
      parseInt(offset),
    );
    res.json({ code: 200, data: { success: result } });
  } catch (err) {
    res.json({ code: 500, data: null, msg: err.message });
  }
});

// ML: 计算歌手相似度推荐（已禁用，保留供后续使用）
// const recommender = require("../recommender");
// router.get("/ml/similar/:id", async (req, res) => { ... });
// router.get("/ml/compute-all", async (req, res) => { ... });

// 爬取单个排行榜
router.get("/chart/crawl/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const chart = hotSongs.CHARTS[type];
    if (!chart) {
      return res.json({ code: 400, msg: `未知排行榜: ${type}` });
    }

    console.log(`[Chart Crawl] 开始爬取 ${chart.name}...`);
    const songs = await hotSongs.crawlChart(type, 50);

    if (songs.length > 0) {
      await hotSongs.saveChartsToDB({ [type]: songs });
      console.log(`[Chart Crawl] ${chart.name} 爬取成功: ${songs.length} 首`);
    } else {
      console.log(`[Chart Crawl] ${chart.name} 爬取失败，无数据`);
    }

    res.json({
      code: 200,
      data: {
        chartType: type,
        chartName: chart.name,
        count: songs.length,
        success: songs.length > 0,
      },
    });
  } catch (err) {
    console.error(`[Chart Crawl] 爬取失败: ${err.message}`);
    res.json({ code: 200, data: { count: 0, success: false, msg: err.message } });
  }
});

// 热歌榜（全量爬取）
router.get("/hotsongs", async (req, res) => {
  try {
    // 确保表存在（使用复合主键，同一首歌可出现在多个榜单）
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
    } catch { }

    // 清空旧数据并重新爬取所有排行榜
    await pool.execute("DELETE FROM hot_songs");
    const chartsData = await hotSongs.crawlAndSaveAllCharts();
    await hotSongs.saveChartsToDB(chartsData);
    const [songs] = await pool.execute(
      "SELECT * FROM hot_songs ORDER BY chart_type, ranking ASC LIMIT 100",
    );
    const data = songs.map((s) => ({
      ...s,
      artists: s.artists ? JSON.parse(s.artists) : [],
    }));
    res.json({ code: 200, data });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 获取歌手对比图表数据（统一接口，根据爬虫入数据库的数据计算）
router.get("/compare/charts", async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.json({ code: 400, data: null, msg: "请提供歌手ID" });

    const artistIds = ids.split(",").map(Number);
    if (artistIds.length === 0)
      return res.json({ code: 400, data: null, msg: "无效ID" });

    // 1. 获取歌手基本信息
    const placeholders = artistIds.map(() => "?").join(",");
    const [artists] = await pool.execute(
      `SELECT id, name, avatar_url, album_size, music_size FROM artists WHERE id IN (${placeholders})`,
      artistIds,
    );

    // 2. 获取每个歌手的歌曲
    const [allSongs] = await pool.execute(
      `SELECT id, name, artist_id, album_name, plays, duration, publish_year, ranking, comments_count
       FROM songs WHERE artist_id IN (${placeholders}) ORDER BY artist_id, plays DESC`,
      artistIds,
    );

    // 按歌手分组
    const songsByArtist = {};
    for (const s of allSongs) {
      if (!songsByArtist[s.artist_id]) songsByArtist[s.artist_id] = [];
      songsByArtist[s.artist_id].push(s);
    }

    // 3. 构建响应
    const data = { artists: [] };
    for (const a of artists) {
      const songs = songsByArtist[a.id] || [];
      const pops = songs.filter((s) => s.plays > 0).map((s) => s.plays);
      const byYear = {};
      for (const s of songs) {
        if (s.publish_year) {
          const d = Math.floor(s.publish_year / 10) * 10;
          byYear[d] = (byYear[d] || 0) + 1;
        }
      }

      data.artists.push({
        id: a.id,
        name: a.name,
        avatar_url: a.avatar_url,
        song_count: a.music_size || 0,
        album_size: a.album_size || 0,
        avg_pop:
          pops.length > 0
            ? Math.round(pops.reduce((a, b) => a + b, 0) / pops.length)
            : 0,
        max_pop: pops.length > 0 ? Math.max(...pops) : 0,
        // 计算总评论数
        total_comments: songs.reduce(
          (sum, s) => sum + (s.comments_count || 0),
          0,
        ),
        top10: songs.slice(0, 10).map((s, i) => ({
          rank: i + 1,
          name: s.name,
          pop: s.plays,
          comments: s.comments_count || 0,
          album: s.album_name,
          year: s.publish_year,
        })),
        decade_distribution: Object.entries(byYear)
          .sort((a, b) => a[0] - b[0])
          .map(([decade, count]) => ({ decade: decade + "年代", count })),
        yearly_trend: songs
          .filter((s) => s.publish_year)
          .reduce((acc, s) => {
            const y = s.publish_year;
            const existing = acc.find((e) => e.year === y);
            if (existing) existing.count++;
            else acc.push({ year: y, count: 1 });
            return acc;
          }, [])
          .sort((a, b) => a.year - b.year),
      });
    }

    // 4. 全局图表：年代分组、总体热度分布
    const allArtistSongs = allSongs.filter((s) =>
      artistIds.includes(s.artist_id),
    );

    // 年代分组（所有歌手合计）
    const eraGroups = {
      "2000年前": 0,
      "2000-2009": 0,
      "2010-2014": 0,
      "2015-2019": 0,
      "2020及以后": 0,
    };
    for (const s of allArtistSongs) {
      const y = s.publish_year;
      if (!y) continue;
      if (y < 2000) eraGroups["2000年前"]++;
      else if (y < 2010) eraGroups["2000-2009"]++;
      else if (y < 2015) eraGroups["2010-2014"]++;
      else if (y < 2020) eraGroups["2015-2019"]++;
      else eraGroups["2020及以后"]++;
    }

    // 所有歌手歌曲按评论数降序（热度值都是100-95，评论数差异更大更有意义）
    const allTopSongs = allArtistSongs
      .sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0))
      .slice(0, 50)
      .map((s, i) => ({
        rank: i + 1,
        name: s.name,
        pop: s.plays, // 热度值（0-100）
        plays: s.plays,
        comments: s.comments_count || 0, // 评论数
        artist_id: s.artist_id,
      }));

    data.era_pie = Object.entries(eraGroups)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
    data.all_top50 = allTopSongs;

    // 雷达图数据归一化处理
    const maxSongCount = Math.max(...data.artists.map((a) => a.song_count), 1);
    const maxAlbumSize = Math.max(...data.artists.map((a) => a.album_size), 1);
    const maxAvgPop = Math.max(...data.artists.map((a) => a.avg_pop), 1);
    const maxComments = Math.max(
      ...data.artists.map((a) => a.total_comments),
      1,
    );

    data.radar = data.artists.map((a) => ({
      name: a.name,
      // 归一化到 0-100 范围
      歌曲数: Math.round((a.song_count / maxSongCount) * 100),
      专辑数: Math.round((a.album_size / maxAlbumSize) * 100),
      平均热度: maxAvgPop > 0 ? Math.round((a.avg_pop / maxAvgPop) * 100) : 0,
      评论数:
        maxComments > 0
          ? Math.round((a.total_comments / maxComments) * 100)
          : 0,
      // 原始数据也保留，供前端使用
      _raw: {
        song_count: a.song_count,
        album_size: a.album_size,
        avg_pop: a.avg_pop,
        total_comments: a.total_comments,
      },
    }));

    // 多排行榜统计：计算对比歌手在各排行榜中的出现次数
    // 确保 hot_songs 表存在且使用正确的复合主键
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
    } catch { }

    // 从数据库读取排行榜数据（不再自动爬取）
    const [chartsData] = await pool.execute(
      "SELECT chart_type, artists FROM hot_songs",
    );
    const chartCounts = {
      hot: {}, // 热歌榜
      rising: {}, // 飙升榜
      new: {}, // 新歌榜
      original: {}, // 原创榜
    };

    for (const row of chartsData) {
      try {
        const songArtists = JSON.parse(row.artists || "[]");
        const chartType = row.chart_type || "hot";
        if (!chartCounts[chartType]) chartCounts[chartType] = {};

        for (const art of songArtists) {
          // 兼容 artist.id 可能是数字或字符串
          const artId = Number(art.id);
          if (artistIds.includes(artId)) {
            chartCounts[chartType][artId] =
              (chartCounts[chartType][artId] || 0) + 1;
          }
        }
      } catch { }
    }

    // 汇总各歌手在所有排行榜的总次数
    data.chartCounts = data.artists.map((a) => ({
      name: a.name,
      total:
        (chartCounts.hot[a.id] || 0) +
        (chartCounts.rising[a.id] || 0) +
        (chartCounts.new[a.id] || 0) +
        (chartCounts.original[a.id] || 0),
      hot: chartCounts.hot[a.id] || 0,
      rising: chartCounts.rising[a.id] || 0,
      new: chartCounts.new[a.id] || 0,
      original: chartCounts.original[a.id] || 0,
    }));

    res.json({ code: 200, data });
  } catch (err) {
    console.error(`[Compare] 失败: ${err.message}`);
    res.status(500).json({ code: 500, msg: err.message });
  }
});

module.exports = router;
