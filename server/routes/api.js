const express = require("express");
const path = require("path");
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
      avatar_url: a.avatar_url || a.picUrl || "",
      followers: a.followers || a.fansSize || 0,
      region: "",
      brief_desc: a.brief_desc || "",
      music_size: a.music_size || a.musicSize || 0,
      album_size: a.album_size || a.albumSize || 0,
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
    const { artist_id } = req.query;

    // 获取Top50热门歌曲的年代分布
    let sql = `SELECT publish_year, SUM(plays) as total_plays, COUNT(*) as song_count
       FROM (
         SELECT * FROM songs 
         WHERE publish_year IS NOT NULL AND publish_year > 0`;
    const params = [];

    if (artist_id) {
      sql += ` AND artist_id = ?`;
      params.push(artist_id);
    }

    sql += ` ORDER BY plays DESC LIMIT 50
       ) AS top_songs
       GROUP BY publish_year
       ORDER BY publish_year ASC`;

    const [rows] = await pool.execute(sql, params);
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
      `SELECT a.id, a.name,
        a.music_size as song_count,
        COALESCE(AVG(s.comments_count), 0) as avg_comments,
        COUNT(s.id) as total_songs
       FROM artists a
       LEFT JOIN songs s ON a.id = s.artist_id
       GROUP BY a.id, a.name, a.music_size
       HAVING total_songs > 0
       ORDER BY song_count DESC
       LIMIT 30`,
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
      // 默认取Top5歌曲最多的歌手（替代粉丝数排序）
      const [top] = await pool.execute(
        "SELECT id FROM artists ORDER BY music_size DESC LIMIT 5",
      );
      artistIds.push(...top.map((r) => r.id));
    }
    const placeholders = artistIds.map(() => "?").join(",");

    const [rows] = await pool.execute(
      `SELECT a.id, a.name, a.followers, a.music_size as song_count,
        a.album_size,
        COALESCE(SUM(s.comments_count), 0) as total_comments,
        COUNT(DISTINCT s.id) as song_count_in_db,
        COUNT(DISTINCT s.publish_year) as era_count
       FROM artists a
       LEFT JOIN songs s ON a.id = s.artist_id
       WHERE a.id IN (${placeholders})
       GROUP BY a.id, a.name, a.followers, a.music_size, a.album_size`,
      artistIds,
    );

    // 转换数据格式，使用年代多样性（标准化到0-100）
    const maxEraCount = Math.max(...rows.map(r => r.era_count || 0), 1);
    const maxComments = Math.max(...rows.map(r => r.total_comments || 0), 1);
    const result = rows.map(row => ({
      id: row.id,
      name: row.name,
      '歌曲数': row.song_count || 0,
      '专辑数': row.album_size || 0,
      '多样性': maxEraCount > 0 ? Math.round((row.era_count || 0) / maxEraCount * 100) : 0,
      '评论数': row.total_comments || 0,
      _raw: {
        song_count: row.song_count,
        album_size: row.album_size,
        followers: row.followers,
        era_count: row.era_count,
        total_comments: row.total_comments,
      }
    }));

    res.json({ code: 200, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 3.13 环形图 — Top5专辑评论占比
router.get("/chart/album-donut", async (req, res) => {
  try {
    const { artist_id } = req.query;
    let sql = `SELECT s.album_name as name, SUM(s.comments_count) as comment_count, a.name as artist_name
       FROM songs s
       JOIN artists a ON s.artist_id = a.id
       WHERE s.album_name IS NOT NULL AND s.album_name != ''`;
    const params = [];

    if (artist_id) {
      sql += ` AND s.artist_id = ?`;
      params.push(artist_id);
    }

    sql += ` GROUP BY s.album_name, a.name ORDER BY comment_count DESC LIMIT 5`;

    const [rows] = await pool.execute(sql, params);
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
    const pops = songs.filter((s) => s.pop > 0).map((s) => s.pop);
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

    // 直接从网页爬取相似歌手
    const similarArtists = await crawler.getSimilarArtists(parseInt(id));

    // 转换为前端期望的格式
    const data = similarArtists.map((a) => ({
      similar_artist_id: a.id,
      name: a.name,
      avatar_url: a.avatar_url,
      similarity_score: a.similarity_score || 0,
    }));

    res.json({ code: 200, data });
  } catch (err) {
    console.error(`[Similar] 获取相似歌手失败: ${err.message}`);
    res.json({ code: 200, data: [], msg: err.message });
  }
});

// 获取歌手描述/简介
router.get("/artist/:id/desc", async (req, res) => {
  try {
    const { id } = req.params;
    const desc = await crawler.getArtistDesc(parseInt(id));
    res.json({ code: 200, data: desc });
  } catch (err) {
    res.json({ code: 500, data: null, msg: err.message });
  }
});

// 获取歌手热门歌曲
router.get("/artist/:id/top-songs", async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;
    const songs = await crawler.getArtistTopSongs(
      parseInt(id),
      parseInt(limit),
    );
    res.json({ code: 200, data: songs });
  } catch (err) {
    res.json({ code: 500, data: [], msg: err.message });
  }
});

// 获取热搜列表
router.get("/hot-search", async (req, res) => {
  try {
    const crawler = require("../crawler");
    const hotList = await crawler.getHotSearch();
    res.json({ code: 200, data: hotList.slice(0, 15) });
  } catch (err) {
    res.json({ code: 500, data: [], msg: err.message });
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
      `SELECT id, name, avatar_url, album_size, music_size, followers FROM artists WHERE id IN (${placeholders})`,
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
        followers: a.followers || 0,
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
    // 计算年代多样性（不同年代的数量）
    const eraDiversity = data.artists.map((a) => (a.yearly_trend || []).length);
    const maxEraDiversity = Math.max(...eraDiversity, 1);
    const maxComments = Math.max(
      ...data.artists.map((a) => a.total_comments),
      1,
    );

    data.radar = data.artists.map((a, idx) => ({
      name: a.name,
      // 归一化到 0-100 范围
      歌曲数: Math.round((a.song_count / maxSongCount) * 100),
      专辑数: Math.round((a.album_size / maxAlbumSize) * 100),
      风格数: Math.round((((a.yearly_trend || []).length) / maxEraDiversity) * 100), // 用年代多样性替代风格数
      评论数:
        maxComments > 0
          ? Math.round((a.total_comments / maxComments) * 100)
          : 0,
      // 原始数据也保留，供前端使用
      _raw: {
        song_count: a.song_count,
        album_size: a.album_size,
        style_count: (a.yearly_trend || []).length,
        total_comments: a.total_comments,
      },
    }));

    // 5. 多排行榜统计：每次对比都重新爬取最新数据
    console.log("[Compare] 开始爬取最新排行榜...");
    try {
      const chartsData = await hotSongs.crawlAndSaveAllCharts();
      await hotSongs.saveChartsToDB(chartsData);
      console.log("[Compare] 排行榜爬取完成");
    } catch (e) {
      console.log("Compare 爬取排行榜失败:", e.message);
    }

    const [chartsData] = await pool.execute(
      "SELECT chart_type, artists FROM hot_songs",
    );
    const chartCounts = {
      hot: {},
      rising: {},
      new: {},
      original: {},
    };

    for (const row of chartsData) {
      try {
        const songArtists = JSON.parse(row.artists || "[]");
        const chartType = row.chart_type || "hot";
        if (!chartCounts[chartType]) chartCounts[chartType] = {};

        for (const art of songArtists) {
          const artId = Number(art.id);
          if (artistIds.includes(artId)) {
            chartCounts[chartType][artId] =
              (chartCounts[chartType][artId] || 0) + 1;
          }
        }
      } catch (e) { }
    }

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

// 热歌榜（手动刷新排行榜数据）
router.get("/hotsongs", async (req, res) => {
  try {
    // 确保表存在（使用复合主键，同一首歌可出现在多个榜单）
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
    } catch (e) { }

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

// ============================================================
// 🤖 机器学习分析 API
// ============================================================

// 5.1 评论情感分析
router.get("/analysis/sentiment/:songId", async (req, res) => {
  try {
    const { songId } = req.params;
    const { limit = 50 } = req.query;

    const { exec } = require("child_process");
    const scriptPath = path.join(__dirname, "..", "comment_analyzer.py");
    const serverDir = path.join(__dirname, "..");

    exec(
      `python "${scriptPath}" --analyze ${songId} ${limit}`,
      {
        cwd: serverDir,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`[Sentiment Analysis] 执行错误: ${error.message}`);
          res.json({
            code: 200,
            data: {
              sentiment: { positive: 0, neutral: 0, negative: 0 },
              total_comments: 0,
              error: error.message,
            },
          });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          res.json({ code: 200, data });
        } catch (parseError) {
          console.error(
            `[Sentiment Analysis] JSON解析失败: ${parseError.message}`,
          );
          res.json({
            code: 200,
            data: {
              sentiment: { positive: 0, neutral: 0, negative: 0 },
              total_comments: 0,
              error: parseError.message,
            },
          });
        }
      },
    );
  } catch (err) {
    console.error(`[Sentiment Analysis] 失败: ${err.message}`);
    res.json({
      code: 200,
      data: {
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        total_comments: 0,
        error: err.message,
      },
    });
  }
});

// 5.2 评论主题聚类
router.get("/analysis/topics/:songId", async (req, res) => {
  try {
    const { songId } = req.params;
    const { limit = 50 } = req.query;

    const { exec } = require("child_process");
    const scriptPath = path.join(__dirname, "..", "comment_analyzer.py");
    const serverDir = path.join(__dirname, "..");

    exec(
      `python "${scriptPath}" --topics ${songId} ${limit}`,
      {
        cwd: serverDir,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`[Topic Analysis] 执行错误: ${error.message}`);
          res.json({
            code: 200,
            data: {
              topics: [],
              total_comments: 0,
              error: error.message,
            },
          });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          res.json({ code: 200, data });
        } catch (parseError) {
          console.error(`[Topic Analysis] JSON解析失败: ${parseError.message}`);
          res.json({
            code: 200,
            data: {
              topics: [],
              total_comments: 0,
              error: parseError.message,
            },
          });
        }
      },
    );
  } catch (err) {
    console.error(`[Topic Analysis] 失败: ${err.message}`);
    res.json({
      code: 200,
      data: {
        topics: [],
        total_comments: 0,
        error: err.message,
      },
    });
  }
});

// 5.3 综合分析（情感+主题）
// Node 端内存缓存: {(songId, limit): {at: timestamp, data: result}}
const combinedCache = new Map();
const COMBINED_CACHE_TTL = 5 * 60 * 1000; // 5分钟

router.get("/analysis/combined/:songId", async (req, res) => {
  try {
    const { songId } = req.params;
    const { limit = 50 } = req.query;
    const cacheKey = `${songId}_${limit}`;

    // 命中缓存直接返回
    const cached = combinedCache.get(cacheKey);
    if (cached && Date.now() - cached.at < COMBINED_CACHE_TTL) {
      return res.json({ code: 200, data: cached.data, cached: true });
    }

    const { exec } = require("child_process");
    const scriptPath = path.join(__dirname, "..", "comment_analyzer.py");
    const serverDir = path.join(__dirname, "..");

    exec(
      `python "${scriptPath}" --combined ${songId} ${limit}`,
      {
        cwd: serverDir,
        maxBuffer: 50 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`[Combined Analysis] 执行错误: ${error.message}`);
          console.error(`stderr: ${stderr}`);
          const fallback = {
            sentiment: { positive: 0, neutral: 0, negative: 0 },
            topics: [],
            total_comments: 0,
            error: error.message,
            stderr: stderr,
          };
          // 失败结果不缓存，下次重试
          return res.json({ code: 200, data: fallback });
        }
        try {
          console.log(`[Combined Analysis] stdout: ${stdout.slice(0, 200)}...`);
          const data = JSON.parse(stdout);
          // 0 评论不缓存（可能遇到限流），让下次有机会重试
          if (data.total_comments > 0) {
            combinedCache.set(cacheKey, { at: Date.now(), data });
            return res.json({ code: 200, data, cached: false });
          } else {
            return res.json({ code: 200, data });
          }
        } catch (parseError) {
          console.error(
            `[Combined Analysis] JSON解析失败: ${parseError.message}`,
          );
          console.error(`原始输出: "${stdout}"`);
          const fallback = {
            sentiment: { positive: 0, neutral: 0, negative: 0 },
            topics: [],
            total_comments: 0,
            error: parseError.message,
            raw_output: stdout,
          };
          // 解析失败不缓存
          return res.json({ code: 200, data: fallback });
        }
      },
    );
  } catch (err) {
    console.error(`[Combined Analysis] 失败: ${err.message}`);
    res.json({
      code: 200,
      data: {
        sentiment: { positive: 0, neutral: 0, negative: 0 },
        topics: [],
        total_comments: 0,
        error: err.message,
      },
    });
  }
});

// ============================================================
// 歌词词云 — Top10歌曲歌词
// ============================================================

const jieba = require("nodejieba");

// 中文停用词
const STOP_WORDS = new Set([
  "的",
  "了",
  "和",
  "是",
  "就",
  "都",
  "而",
  "及",
  "与",
  "着",
  "或",
  "一个",
  "没有",
  "我们",
  "你们",
  "他们",
  "它们",
  "这个",
  "那个",
  "这些",
  "那些",
  "什么",
  "怎么",
  "为什么",
  "因为",
  "所以",
  "但是",
  "然而",
  "虽然",
  "还是",
  "在",
  "有",
  "也",
  "很",
  "到",
  "会",
  "可以",
  "能",
  "不",
  "人",
  "都",
  "要",
  "自己",
  "这",
  "那",
  "应该",
  "必须",
  "需要",
  "可能",
  "应该",
  "一",
  "二",
  "三",
  "四",
  "五",
  "六",
  "七",
  "八",
  "九",
  "十",
  "啊",
  "哦",
  "嗯",
  "呢",
  "吧",
  "吗",
  "嘛",
  "呀",
  "哇",
  "哈",
  "呵",
  "我",
  "你",
  "他",
  "她",
  "它",
  "谁",
  "哪",
  "个",
  "种",
  "类",
  "又",
  "再",
  "还",
  "更",
  "最",
  "只",
  "但",
  "而",
  "却",
  "如果",
  "让",
  "给",
  "把",
  "被",
  "对",
  "向",
  "从",
  "比",
  "为",
  "以",
  "过",
  "上",
  "下",
  "中",
  "里",
  "外",
  "内",
  "间",
  "边",
  "面",
  "想",
  "说",
  "看",
  "听",
  "做",
  "来",
  "去",
  "走",
  "回",
  "知道",
  "觉得",
  "感觉",
  "认为",
  "以为",
  "记得",
  "忘记",
  "想起",
  "时间",
  "时候",
  "时刻",
  "时期",
  "年代",
  "日子",
  "今天",
  "明天",
  "现在",
  "当时",
  "以前",
  "后来",
  "之后",
  "之前",
  "开始",
  "结束",
  "地方",
  "这里",
  "那里",
  "到处",
  "四处",
  "哪里",
  "那边",
  "东西",
  "事情",
  "情况",
  "问题",
  "原因",
  "结果",
  "方法",
  "方式",
  "一直",
  "总是",
  "经常",
  "常常",
  "有时",
  "偶尔",
  "从来",
  "永远",
  "非常",
  "特别",
  "比较",
  "相当",
  "十分",
  "极其",
  "太",
  "好",
  "真",
  "已经",
  "曾经",
  "刚刚",
  "正在",
  "将要",
  "就要",
  "快要",
  "才",
  "就",
  "还",
  "又",
  "再",
  "也",
  "都",
  "全",
  "只",
  "仅",
  "光",
  "着",
  "了",
  "过",
  "的",
  "地",
  "得",
  "与",
  "同",
  "和",
  "跟",
  "及",
  "以及",
  "并",
  "且",
  "而",
  "或",
  "如果",
  "假如",
  "假设",
  "即使",
  "尽管",
  "虽然",
  "但是",
  "然而",
  "不仅",
  "不但",
  "而且",
  "并且",
  "或者",
  "还是",
  "要么",
  "由于",
  "因为",
  "所以",
  "因此",
  "因而",
  "于是",
  "从而",
  "只要",
  "只有",
  "无论",
  "不管",
  "不论",
  "即使",
  "哪怕",
  "为了",
  "为着",
  "关于",
  "对于",
  "至于",
  "根据",
  "按照",
  "随着",
  "除了",
  "除开",
  "除去",
  "有关",
  "相关",
  "涉及",
  "每",
  "各",
  "诸",
  "凡",
  "凡例",
  "凡此",
  "所有",
  "一切",
  "有人",
  "有人",
  "人们",
  "人家",
  "别人",
  "人家",
  "大家",
  "有人",
  "有的",
  "有些",
  "某些",
  "有的",
  "之一",
  "之一",
  "之类",
  "等等",
  "云云",
  "什么的",
  "这个",
  "那个",
  "牛班",
  "NEWBAND",
  "银河",
  "方舟",
  "维伴",
  "青桔",
  "汪苏",
  "刘涛",
  "赵建飞",
  "陈韵",
  "王子",
  "首席",
  "爱乐乐团",
  "国际",
  "编写",
  "监制",
  "录音",
]);

function extractWords(text) {
  // 用jieba分词
  const words = jieba.cut(text, true); // 精确模式
  const freq = {};
  for (const word of words) {
    const w = word.trim();
    if (
      !w ||
      w.length < 2 ||
      STOP_WORDS.has(w) ||
      /^\d+$/.test(w) ||
      /^[a-zA-Z]$/.test(w) ||
      /[\u3000-\u303f\uff00-\uffef]/.test(w)
    ) {
      continue;
    }
    freq[w] = (freq[w] || 0) + 1;
  }
  return freq;
}

router.get("/lyrics/wordcloud", async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ code: 400, msg: "缺少歌手ID参数" });
    }

    const artistIds = ids.split(",").map((id) => parseInt(id.trim()));

    // 获取每个歌手评论数Top的歌曲（取前3首）
    const allSongs = [];
    for (const artistId of artistIds) {
      const [songs] = await pool.query(
        `SELECT id, name, artist_id, comments_count
         FROM songs
         WHERE artist_id = ?
         ORDER BY comments_count DESC
         LIMIT 3`,
        [artistId],
      );
      allSongs.push(...songs);
    }

    // 按评论数排序取Top10
    allSongs.sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0));
    const topSongs = allSongs.slice(0, 10);

    // 获取歌词并分词
    const songLyrics = [];
    const allLyricsText = [];

    for (const song of topSongs) {
      const lyric = await crawler.getSongLyric(song.id);
      if (lyric) {
        songLyrics.push({
          id: song.id,
          name: song.name,
          artistId: song.artist_id,
          lyric: lyric.substring(0, 500), // 返回前500字符用于展示
        });
        allLyricsText.push(lyric);
      }
    }

    // 合并所有歌词并分词
    const combinedText = allLyricsText.join("\n");
    const wordFreq = extractWords(combinedText);

    // 转换为数组并排序
    const wordCloudData = Object.entries(wordFreq)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 100); // 取前100个高频词

    res.json({
      code: 200,
      data: {
        words: wordCloudData,
        songs: songLyrics.map((s) => ({
          id: s.id,
          name: s.name,
          artistId: s.artistId,
        })),
      },
    });
  } catch (err) {
    console.error(`[歌词词云] 失败: ${err.message}`);
    res.status(500).json({ code: 500, msg: err.message });
  }
});

// 评论词云
router.get("/comments/wordcloud", async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ code: 400, msg: "缺少歌手ID参数" });

    const artistIds = ids.split(",").map(function (id) {
      return parseInt(id.trim());
    });

    const allSongs = [];
    for (const artistId of artistIds) {
      const [songs] = await pool.query(
        "SELECT id, name, artist_id, comments_count FROM songs WHERE artist_id = ? ORDER BY comments_count DESC LIMIT 3",
        [artistId],
      );
      allSongs.push(...songs);
    }

    allSongs.sort(function (a, b) {
      return (b.comments_count || 0) - (a.comments_count || 0);
    });
    const topSongs = allSongs.slice(0, 10);

    const allCommentTexts = [];
    const songComments = [];

    for (const song of topSongs) {
      try {
        const comments = await crawler.getSongComments(song.id, 30);
        if (comments.length > 0) {
          songComments.push({
            id: song.id,
            name: song.name,
            artistId: song.artist_id,
            commentCount: comments.length,
          });
          allCommentTexts.push(...comments);
        }
      } catch (e) { }
    }

    const combinedText = allCommentTexts.join("\n");
    const wordFreq = extractWords(combinedText);

    const wordCloudData = Object.entries(wordFreq)
      .map(function (entry) {
        return { name: entry[0], value: entry[1] };
      })
      .sort(function (a, b) {
        return b.value - a.value;
      })
      .slice(0, 100);

    res.json({
      code: 200,
      data: { words: wordCloudData, songs: songComments },
    });
  } catch (err) {
    console.error("[评论词云] 失败:", err.message);
    res.status(500).json({ code: 500, msg: err.message });
  }
});


// ============================================================
// ML 互动度分析
// ============================================================
const { execSync } = require("child_process");
const fs_ml = require("fs");

const ML_RESULT_PATH = path.join(__dirname, "..", "ml_result.json");
const ML_SCRIPT_PATH = path.join(__dirname, "..", "ml_pipeline.py");

router.get("/analysis/interaction", async (req, res) => {
  try {
    if (!fs_ml.existsSync(ML_RESULT_PATH)) {
      console.log("[ML] 运行 ML 流水线...");
      try {
        execSync("python3 \"" + ML_SCRIPT_PATH + "\"", {
          cwd: path.join(__dirname, ".."),
          timeout: 180000,
          encoding: "utf-8"
        });
      } catch (e) {
        if (!fs_ml.existsSync(ML_RESULT_PATH)) {
          return res.json({ code: 500, data: null, msg: "ML训练失败: " + e.message });
        }
      }
    }
    const raw = fs_ml.readFileSync(ML_RESULT_PATH, "utf-8");
    const jsonData = JSON.parse(raw);
    res.json({ code: 200, data: jsonData });
  } catch (err) {
    console.error("[ML] 失败:", err.message);
    res.status(500).json({ code: 500, msg: err.message });
  }
});


module.exports = router;
