// ============================================================
// 网易云音乐数据抓取 & 入库模块
// 选入对比列表后自动抓取详细信息并存入数据库
// ============================================================

const { pool } = require("./db");
const crawler = require("./crawler");

/**
 * 抓取歌手详情并存入数据库
 * @param {number} artistId
 * @returns {object} 歌手基本信息
 */
async function crawlAndSaveArtist(artistId) {
  console.log(`[Scraper] 开始抓取歌手: ${artistId}`);

  // 确保表有 album_size/music_size 字段
  try {
    await pool.execute(
      `ALTER TABLE artists ADD COLUMN IF NOT EXISTS album_size INT DEFAULT 0`,
    );
  } catch (e) {
    try {
      await pool.execute(
        `ALTER TABLE artists ADD COLUMN album_size INT DEFAULT 0`,
      );
    } catch { }
  }
  try {
    await pool.execute(
      `ALTER TABLE artists ADD COLUMN IF NOT EXISTS music_size INT DEFAULT 0`,
    );
  } catch (e) {
    try {
      await pool.execute(
        `ALTER TABLE artists ADD COLUMN music_size INT DEFAULT 0`,
      );
    } catch { }
  }

  // 1. 抓取歌手详情
  let detail;
  try {
    detail = await crawler.getArtistDetail(artistId);
  } catch (e) {
    console.error(`[Scraper] 抓取歌手详情失败: ${e.message}`);
    throw e;
  }

  // 1.1 获取粉丝数
  try {
    const followers = await crawler.getArtistFollowers(artistId);
    detail.followers = followers;
    console.log(`[Scraper] 获取到粉丝数: ${followers}`);
  } catch (e) {
    console.error(`[Scraper] 获取粉丝数失败: ${e.message}`);
  }

  // 2. 抓取热门歌曲
  let songs = [];
  try {
    songs = await crawler.getArtistTopSongs(artistId);
    console.log(`[Scraper] 获取到 ${songs.length} 首歌曲`);
  } catch (e) {
    console.error(`[Scraper] 抓取歌曲失败: ${e.message}`);
  }

  // 2.1 获取歌曲评论数（只获取前20首的评论数，避免请求过多）
  if (songs.length > 0) {
    console.log(`[Scraper] 开始获取歌曲评论数...`);
    const topSongIds = songs.slice(0, 20).map((s) => s.id);
    try {
      const commentCounts = await crawler.getBatchCommentCounts(topSongIds);
      for (const s of songs) {
        if (commentCounts[s.id] !== undefined) {
          s.comments_count = commentCounts[s.id];
        }
      }
      console.log(`[Scraper] 评论数获取完成`);
    } catch (e) {
      console.error(`[Scraper] 获取评论数失败: ${e.message}`);
    }
  }

  // 2.5 抓取专辑列表
  let albums = [];
  try {
    const albumRes = await (async () => {
      const axios = require("axios");
      const r0 = await axios
        .get("https://music.163.com/", {
          headers: { "User-Agent": "Mozilla/5.0 ... Chrome/120" },
          timeout: 5000,
        })
        .catch(() => { });
      const ck = r0?.headers?.["set-cookie"]
        ? r0.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ")
        : "";
      const r = await axios.get(
        `https://music.163.com/api/artist/albums/${artistId}`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 ... Chrome/120",
            Referer: "https://music.163.com/",
            Cookie: ck,
          },
          timeout: 10000,
        },
      );
      return r.data;
    })();
    if (albumRes?.code === 200) {
      albums = (albumRes.hotAlbums || []).slice(0, 20);
      console.log(`[Scraper] 获取到 ${albums.length} 张专辑`);
    }
  } catch (e) {
    // 专辑获取失败不影响主流程
  }

  // 2.6 抓取相似歌手
  let similarArtists = [];
  try {
    similarArtists = await crawler.getSimilarArtists(artistId);
    console.log(`[Scraper] 获取到 ${similarArtists.length} 位相似歌手`);
  } catch (e) {
    console.error(`[Scraper] 抓取相似歌手失败: ${e.message}`);
  }

  // 3. 存入数据库
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 存歌手
    await conn.execute(
      `INSERT INTO artists (id, name, avatar_url, followers, description, region, album_size, music_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         avatar_url = VALUES(avatar_url),
         followers = VALUES(followers),
         description = VALUES(description),
         region = VALUES(region),
         album_size = VALUES(album_size),
         music_size = VALUES(music_size)`,
      [
        artistId,
        detail.name || "",
        detail.avatar_url || "",
        detail.followers || 0,
        detail.brief_desc || "",
        detail.region || "",
        detail.album_size || 0,
        detail.music_size || 0,
      ],
    );

    // 存歌曲
    if (songs.length > 0) {
      const songSql = `INSERT INTO songs (id, name, artist_id, album_name, album_id, plays, comments_count, duration, publish_year, ranking)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          album_name = VALUES(album_name),
          plays = VALUES(plays),
          comments_count = VALUES(comments_count),
          duration = VALUES(duration),
          publish_year = VALUES(publish_year),
          ranking = VALUES(ranking)`;

      for (const s of songs) {
        await conn.execute(songSql, [
          s.id,
          s.name || "",
          artistId,
          s.album_name || "",
          s.album_id || 0,
          s.plays || 0,
          s.comments_count || 0,
          s.duration || 0,
          s.publish_year || null,
          s.ranking || 0,
        ]);
      }
    }

    // 存专辑
    if (albums.length > 0) {
      const albumSql = `INSERT INTO albums (id, name, artist_id, publish_time, song_count, comment_count)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          publish_time = VALUES(publish_time),
          song_count = VALUES(song_count),
          comment_count = VALUES(comment_count)`;
      for (const al of albums) {
        const pt = al.publishTime
          ? new Date(al.publishTime).toISOString().split("T")[0]
          : null;
        try {
          await conn.execute(albumSql, [
            al.id,
            al.name || "",
            artistId,
            pt,
            al.size || al.songSize || 0,
            al.info?.commentCount || al.commentCount || 0,
          ]);
        } catch { }
      }
    }

    // 存相似歌手
    if (similarArtists.length > 0) {
      // 先确保相似歌手在 artists 表中有记录
      for (const sim of similarArtists) {
        await conn.execute(
          `INSERT IGNORE INTO artists (id, name, avatar_url) VALUES (?, ?, ?)`,
          [sim.id, sim.name || "", sim.avatar_url || ""]
        );
      }
      // 清除旧的相似歌手关系，插入新的
      await conn.execute(
        `DELETE FROM similar_artists WHERE artist_id = ?`,
        [artistId]
      );
      for (const sim of similarArtists) {
        await conn.execute(
          `INSERT IGNORE INTO similar_artists (artist_id, similar_artist_id, similarity_score) VALUES (?, ?, ?)`,
          [artistId, sim.id, sim.similarity_score || 0]
        );
      }
    }

    await conn.commit();
    console.log(
      `[Scraper] ✅ 歌手 ${detail.name} (${artistId}) 入库完成，${songs.length} 首歌曲`,
    );
  } catch (e) {
    await conn.rollback();
    console.error(`[Scraper] 入库失败: ${e.message}`);
    throw e;
  } finally {
    conn.release();
  }

  return {
    ...detail,
    songs_count: songs.length,
    // 计算平均热度和热度峰值（使用 plays 字段）
    avg_pop: songs.length > 0
      ? Math.round(songs.reduce((sum, s) => sum + (s.plays || 0), 0) / songs.length)
      : 0,
    max_pop: songs.length > 0
      ? Math.max(...songs.map(s => s.plays || 0))
      : 0,
  };
}

module.exports = { crawlAndSaveArtist };
