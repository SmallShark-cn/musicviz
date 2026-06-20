// ============================================================
// 全量歌手爬虫 — 从分类页获取所有歌手ID和名称
// 参考: https://music.163.com/discover/artist/cat?id=1001&initial=-1
// ============================================================

const axios = require("axios");
const { pool } = require("./db");
const crawler = require("./crawler");

// 歌手分类ID（来自文章分析）
const CATEGORIES = [
  { id: 1001, name: "华语男" },
  { id: 1002, name: "华语女" },
  { id: 1003, name: "华语组合" },
  { id: 2001, name: "欧美男" },
  { id: 2002, name: "欧美女" },
  { id: 2003, name: "欧美组合" },
  { id: 6001, name: "日本男" },
  { id: 6002, name: "日本女" },
  { id: 6003, name: "日本组合" },
  { id: 7001, name: "韩国男" },
  { id: 7002, name: "韩国女" },
  { id: 7003, name: "韩国组合" },
  { id: 4001, name: "其他男" },
  { id: 4002, name: "其他女" },
  { id: 4003, name: "其他组合" },
];

// initial 参数：-1=热门, 0=其他, 65-90=A-Z
const INITIALS = [-1, 0, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
};

/**
 * 从单个分类页提取歌手列表
 */
async function fetchArtistsFromCategory(catId, initial) {
  const url = `https://music.163.com/discover/artist/cat?id=${catId}&initial=${initial}`;
  const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
  const html = res.data;

  // 匹配歌手ID和名称（对齐文章中的正则）
  const re = /artist\?id=(\d+)"[^>]*class="nm[^"]*"[^>]*title="[^"]*">([^<]+)<\/a>/g;
  const artists = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = parseInt(m[1]);
    const name = m[2].trim();
    if (name && !artists.find((a) => a.id === id)) {
      artists.push({ id, name });
    }
  }
  return artists;
}

/**
 * 全量爬取所有歌手ID（不抓详情，仅存ID/名称映射）
 */
async function crawlAllArtistIds() {
  console.log("===== 全量爬取歌手ID列表 =====");

  // 确保表结构
  try { await pool.execute("ALTER TABLE artists ADD COLUMN IF NOT EXISTS album_size INT DEFAULT 0"); } catch { try { await pool.execute("ALTER TABLE artists ADD COLUMN album_size INT DEFAULT 0"); } catch {} }
  try { await pool.execute("ALTER TABLE artists ADD COLUMN IF NOT EXISTS music_size INT DEFAULT 0"); } catch { try { await pool.execute("ALTER TABLE artists ADD COLUMN music_size INT DEFAULT 0"); } catch {} }

  let total = 0;
  const allArtists = [];

  for (const cat of CATEGORIES) {
    for (const init of INITIALS) {
      try {
        const artists = await fetchArtistsFromCategory(cat.id, init);
        if (artists.length > 0) {
          console.log(`  ${cat.name} initial=${init} → ${artists.length} 位`);
          // 去重并入DB
          for (const a of artists) {
            if (!allArtists.find((x) => x.id === a.id)) {
              allArtists.push(a);
              try {
                await pool.execute(
                  `INSERT IGNORE INTO artists (id, name) VALUES (?, ?)`,
                  [a.id, a.name],
                );
              } catch {}
            }
          }
          total += artists.length;
        }
      } catch (e) {
        // 跳过该页
      }
    }
  }

  console.log(`\n✅ 共获取 ${allArtists.length} 位不重复歌手`);
  return allArtists;
}

/**
 * 批量抓取歌手详情（按顺序，可指定数量）
 */
async function crawlArtistDetails(limit = 50, offset = 0) {
  // 从DB中取还没有详细数据的歌手
  const [rows] = await pool.execute(
    `SELECT id, name FROM artists WHERE music_size IS NULL OR music_size = 0 ORDER BY id LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  console.log(`\n===== 批量抓取详情: ${rows.length} 位 =====`);
  let success = 0;
  for (const row of rows) {
    try {
      const result = await crawler.getArtistDetail(row.id);
      if (result && result.name) {
        await pool.execute(
          `UPDATE artists SET name=?, avatar_url=?, album_size=?, music_size=? WHERE id=?`,
          [result.name, result.avatar_url, result.album_size || 0, result.music_size || 0, row.id],
        );
        success++;
        console.log(`  ✅ ${result.name} (${row.id})`);
      }
    } catch (e) {
      // 跳过
    }
    // 延时避免请求过快
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`✅ 完成: ${success}/${rows.length}`);
  return success;
}

module.exports = { crawlAllArtistIds, crawlArtistDetails, CATEGORIES };
