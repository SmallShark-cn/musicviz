// ============================================================
// 网易云音乐爬虫模块 — 纯 HTTP 请求（无 Selenium）
// 基于主页 HTML 分析构建
// ============================================================

const axios = require("axios");
const crypto = require("crypto");

// ============================================================
// Cookie / Session 管理
// ============================================================

let cookieJar = "";
let csrfToken = "";

/**
 * 初始化 session：访问首页获取 cookie 和 csrf_token
 */
async function initSession() {
  if (cookieJar && csrfToken) return; // 已初始化

  console.log("[爬虫] 初始化 session...");
  const res = await axios.get("https://music.163.com/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
    maxRedirects: 5,
    timeout: 10000,
  });

  // 提取 cookies
  const setCookie = res.headers["set-cookie"];
  if (setCookie && setCookie.length > 0) {
    const newCookies = setCookie.map((c) => c.split(";")[0]).join("; ");
    cookieJar = cookieJar ? `${cookieJar}; ${newCookies}` : newCookies;
  }

  // 提取 csrf_token（通常在 __csrf cookie 中）
  const csrfMatch = cookieJar.match(/__csrf=([^;]+)/);
  if (csrfMatch) {
    csrfToken = csrfMatch[1];
  }

  // 也尝试从 MUSIC_U cookie 或其他方式
  if (!csrfToken) {
    const musicUMatch = cookieJar.match(/MUSIC_U=([^;]+)/);
    // 有些情况下 csrf 通过页面中 meta 标签传递
    if (typeof res.data === "string") {
      const csrfMatch2 = res.data.match(
        /csrf_token["']?\s*[:=]\s*["']([^"'\s]+)["']/,
      );
      if (csrfMatch2) csrfToken = csrfMatch2[1];
    }
  }

  console.log(
    `[爬虫] Session 就绪, cookie 长度=${cookieJar.length}, csrf=${csrfToken || "无"}`,
  );
}

/**
 * 通用请求方法
 */
async function request(url, options = {}) {
  await initSession();
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    Referer: "https://music.163.com/",
    Origin: "https://music.163.com",
    Cookie: cookieJar,
    ...options.headers,
  };

  try {
    const res = await axios({
      url,
      method: options.method || "GET",
      headers,
      timeout: 15000,
      ...Object.fromEntries(
        Object.entries(options).filter(
          ([k]) => !["method", "headers"].includes(k),
        ),
      ),
    });
    // 更新 cookie
    const setCookie = res.headers["set-cookie"];
    if (setCookie) {
      const newCookies = setCookie.map((c) => c.split(";")[0]).join("; ");
      cookieJar = cookieJar ? `${cookieJar}; ${newCookies}` : newCookies;
    }
    return res.data;
  } catch (err) {
    console.error(`[爬虫] 请求失败: ${url.substring(0, 80)} - ${err.message}`);
    throw err;
  }
}

// ============================================================
// 搜索 API
// ============================================================

/**
 * 搜索建议（suggest API — 输入时实时提示）
 * 对应主页中 search suggest 下拉框的数据源
 */
async function searchSuggest(keyword, type = "100") {
  // type: 100=歌手, 1=单曲, 10=专辑, 1002=用户
  const url = `https://music.163.com/api/search/suggest/web?s=${encodeURIComponent(keyword)}&type=${type}&csrf_token=${csrfToken}`;

  console.log(`[爬虫] suggest: "${keyword}" type=${type}`);
  const data = await request(url);

  if (data.code !== 200) {
    throw new Error(`suggest API 返回 code=${data.code}`);
  }

  return {
    artists: (data.result?.artists || []).map((a) => ({
      id: a.id,
      name: a.name,
      avatar_url: a.picUrl || a.img1v1Url || "",
      alias: a.alias || [],
      music_size: a.musicSize || 0,
      album_size: a.albumSize || 0,
    })),
    songs: (data.result?.songs || []).map((s) => ({
      id: s.id,
      name: s.name,
      artists: (s.artists || []).map((a) => ({ id: a.id, name: a.name })),
      album: s.album ? { id: s.album.id, name: s.album.name } : null,
    })),
    albums: (data.result?.albums || []).map((a) => ({
      id: a.id,
      name: a.name,
      artist: a.artist ? { id: a.artist.id, name: a.artist.name } : null,
      cover_url: a.picUrl || "",
    })),
    order: data.result?.order || [],
  };
}

/**
 * 完整搜索 API
 */
async function search(keyword, type = "100", limit = 30, offset = 0) {
  // type: 100=歌手, 1=单曲, 10=专辑, 1002=用户, 1014=视频, 1006=歌词
  const url = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=${type}&limit=${limit}&offset=${offset}&csrf_token=${csrfToken}`;

  console.log(`[爬虫] search: "${keyword}" type=${type} limit=${limit}`);
  const data = await request(url);

  if (data.code !== 200) {
    throw new Error(`search API 返回 code=${data.code} msg=${data.msg || ""}`);
  }

  const result = data.result || {};

  // 歌手结果
  if (type === "100") {
    return {
      artists: (result.artists || []).map((a) => ({
        id: a.id,
        name: a.name,
        avatar_url: a.picUrl || a.img1v1Url || "",
        alias: a.alias || [],
        music_size: a.musicSize || 0,
        album_size: a.albumSize || 0,
        // fansSize 始终为 null，搜索接口不返回真实粉丝数
        followers: 0,
        brief_desc: a.briefDesc || "",
        trans_name: a.trans || "",
        identity: a.identity || [],
      })),
      total: result.artistCount || 0,
      hasMore: result.hasMore || false,
    };
  }

  // 歌曲结果
  if (type === "1") {
    return {
      songs: (result.songs || []).map((s) => ({
        id: s.id,
        name: s.name,
        artists: (s.artists || []).map((a) => ({ id: a.id, name: a.name })),
        album: s.album
          ? { id: s.album.id, name: s.album.name, cover: s.album.picUrl }
          : null,
        duration: s.duration || 0,
        mvid: s.mvid || 0,
      })),
      total: result.songCount || 0,
      hasMore: result.hasMore || false,
    };
  }

  return { result, code: data.code };
}

// ============================================================
// 歌手详情 API
// ============================================================

/**
 * 获取歌手详情
 */
async function getArtistDetail(artistId) {
  // 使用 /api/artist/{id} 端点（已验证可用）
  const url = `https://music.163.com/api/artist/${artistId}?csrf_token=${csrfToken}`;
  console.log(`[爬虫] artist detail: ${artistId}`);
  const data = await request(url);

  if (!data || data.code === 400) {
    throw new Error(`artist API 返回 code=400, msg=${data?.msg || "参数错误"}`);
  }

  const a = data.artist || data.data?.artist || data.data || {};

  // 额外获取艺人介绍
  let briefDesc = a.briefDesc || "";
  try {
    const introRes = await request(
      `https://music.163.com/api/artist/introduction?id=${artistId}&csrf_token=${csrfToken}`,
    );
    if (introRes && introRes.code === 200 && introRes.briefDesc) {
      briefDesc = introRes.briefDesc;
    }
  } catch { }

  return {
    id: a.id || artistId,
    name: a.name || "",
    avatar_url: a.picUrl || a.cover || a.img1v1Url || "",
    // accountId 不是粉丝数，fansSize 始终为 null
    followers: 0,
    brief_desc: briefDesc,
    region: a.nationality || "",
    music_size: a.musicSize || 0,
    album_size: a.albumSize || 0,
    aliases: a.alias || [],
    identities: a.identifyTags || [],
  };
}

/**
 * 获取歌手热门歌曲 Top50
 */
async function getArtistTopSongs(artistId) {
  const url = `https://music.163.com/api/artist/top/song?id=${artistId}&csrf_token=${csrfToken}`;
  console.log(`[爬虫] artist top songs: ${artistId}`);
  const data = await request(url);

  if (data.code !== 200) {
    throw new Error(`top songs API 返回 code=${data.code}`);
  }

  return (data.songs || data.data?.songs || []).map((s, i) => ({
    id: s.id,
    name: s.name,
    album_name: s.al?.name || s.album?.name || "",
    album_id: s.al?.id || s.album?.id || 0,
    plays: s.pop || 0,
    // 这些字段需要另外获取
    comments_count: 0,
    duration: s.dt || s.duration || 0,
    publish_year: s.publishTime
      ? new Date(s.publishTime).getFullYear()
      : s.al?.publishTime
        ? new Date(s.al.publishTime).getFullYear()
        : null,
    ranking: i + 1,
  }));
}

/**
 * 获取相似歌手
 */
async function getSimilarArtists(artistId) {
  const url = `https://music.163.com/api/artist/simi?id=${artistId}&csrf_token=${csrfToken}`;
  console.log(`[爬虫] similar artists: ${artistId}`);
  const data = await request(url);

  if (data.code !== 200) {
    throw new Error(`similar API 返回 code=${data.code}`);
  }

  return (data.artists || data.data?.artists || []).map((a) => ({
    id: a.id,
    name: a.name,
    avatar_url: a.picUrl || a.img1v1Url || "",
    similarity_score: a.score || 0,
  }));
}

/**
 * 获取歌曲评论数
 * @param {number} songId 歌曲ID
 * @returns {Promise<number>} 评论总数
 */
async function getSongCommentCount(songId) {
  const url = `https://music.163.com/api/v1/resource/comments/R_SO_4_${songId}?limit=1&offset=0`;
  try {
    const data = await request(url);
    if (data.code !== 200) {
      return 0;
    }
    return data.total || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * 批量获取歌曲评论数
 * @param {number[]} songIds 歌曲ID数组
 * @returns {Promise<Object>} { songId: commentCount }
 */
async function getBatchCommentCounts(songIds) {
  const result = {};
  // 并发请求，但限制并发数
  const BATCH_SIZE = 5;
  for (let i = 0; i < songIds.length; i += BATCH_SIZE) {
    const batch = songIds.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (id) => {
      const count = await getSongCommentCount(id);
      return { id, count };
    });
    const results = await Promise.all(promises);
    for (const { id, count } of results) {
      result[id] = count;
    }
    // 避免请求过快
    if (i + BATCH_SIZE < songIds.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return result;
}

/**
 * 获取歌手粉丝数（需要登录态，公开API不返回）
 * 尝试从歌手详情页获取
 */
async function getArtistFollowers(artistId) {
  // 网易云公开API不返回粉丝数，尝试从其他接口获取
  const url = `https://music.163.com/api/artist/detail?id=${artistId}&csrf_token=${csrfToken}`;
  try {
    const data = await request(url);
    if (data.code === 200 && data.data?.artist) {
      // 尝试多个可能的字段
      return (
        data.data.artist.followers ||
        data.data.artist.fansSize ||
        data.data.artist.followeds ||
        0
      );
    }
  } catch (e) { }
  return 0;
}

module.exports = {
  initSession,
  searchSuggest,
  search,
  getArtistDetail,
  getArtistTopSongs,
  getSimilarArtists,
  getSongCommentCount,
  getBatchCommentCounts,
  getArtistFollowers,
  getCookie: () => cookieJar,
  getCsrf: () => csrfToken,
};
