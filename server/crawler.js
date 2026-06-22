// ============================================================
// 网易云音乐爬虫模块 — 纯 HTTP 请求（无 Selenium）
// 基于主页 HTML 分析构建
// ============================================================

const axios = require("axios");
const crypto = require("crypto");

// ============================================================
// Cookie / Session 管理
// ============================================================

// 用户提供的登录态Cookie（用于获取粉丝数等需要登录的功能）
const USER_COOKIE = '_ntes_nnid=7904eea0e9797c762a2641d9077b5540,1762224547989; _ntes_nuid=7904eea0e9797c762a2641d9077b5540; NMTID=00O68yenl7ArFfKREi6p5FQ4rnKrT0AAAGaTMSqSQ; WEVNSM=1.0.0; WNMCID=xxreko.1762224548968.01.0; WM_TID=Po49cJJHS6NEERVVFEKWzDSgtCSd7PM3; ntes_utid=tid._.HY6x9QHRLgJEV1EQUALDmCD19XGaFw2s._.0; sDeviceId=YD-Bzi5MbMB7mFAUwFQEVLC2DCxtCHLE1i8; __snaker__id=81jjfC65uBb4T9ip; ntes_kaola_ad=1; nts_mail_user=axwl040812@163.com:-1:1; NTES_P_UTID=itWbo7GLjT5sIHvgJibH3uqA8bHeTc3X|1775458611; P_INFO=15922079023|1780825749|1|music|00&99|null&null&null#heb&130100#10#0|&0|null|15922079023; _iuqxldmzr_=32; Hm_lvt_1483fb4774c02a30ffa6f0e2945e9b70=1780901822,1781576402,1782090194; HMACCOUNT=BA6F0F854698C7D1; WM_NI=27lSYQ2E71qBGgO49KHjzVNNmK0YRMGxqYKe%2FrQUObLzkQ7bpKFr%2B%2BGVs2%2FIWDY7Gau%2FLSlz6O5m0Q3ZHG%2F%2BRfyI2Q3vaJ%2BPKnm%2BOGf%2BwgiapeXzalJK%2BrcfCwchj0lPMUo%3D; WM_NIKE=9ca17ae2e6ffcda170e2e6ee97b679fc9c9adaaa7993b08ba6c45e878f8eacc63ea6a6a894f268b19aada4db2af0fea7c3b92af2e9a4b4dc5bf29bf9d2f44a85b981d5bc418cb6b6b7cd46af9500bad14785a8bfbaca6fedae9fb6ce6a90a6a5b2b66ab4958a93aa21858abdd3ae43959c97d8c66bb7f184b4ef72f691fb8eb35bf18688a8ae2192bab7aab15bf1aaafabaa5c89b2a3ccce4da6f5b988ec6bb4bb989be4688a95e593e26e81a9ad89e93cb09083b6ee37e2a3; JSESSIONID-WYYY=ymNkgoOFiE%5CYtssm73%2FzZ1mQ6xOjAZN%2BMZTKxxc%2B83DdBH3Hk9KwkDzo9eP19x5oGZDKbFyHARUgdvRnxei3fMpomPFnmN%2BXPnQQKo8SGlt2k69%2Bov7Th7n%5CdzPpg%2BWKevgvbKUzqzosnlBT6qTrHr6%2BZVFQyqKe4WVisc%2BeXYgZOd2Z%3A1782093735017; gdxidpyhxdE=U1z8jRmys6y%5CC2Usgt0SL%2FTlZWMzmV%2Bo5EdtQxM7rUpg%2FUuO0g9Mi3%2BfyHrDEo%2BI%2Bw%5CKQxUaG%5COIoXS%2BCKDB6vNvy19zVKDtnts0IfvgPv%2F4r%5CIQ9oYNt%2Bnw%2B5ehx%5CrHR6bPiLI68HnHfQnEtXVJC7MXzv2vOsS8zoWCWrbsCszIlb5C%3A1782093595594; __csrf=5926969fd5ec7a23456bb83865e837ff; Hm_lpvt_1483fb4774c02a30ffa6f0e2945e9b70=1782092735';

let cookieJar = USER_COOKIE; // 直接使用登录态Cookie
let csrfToken = "5926969fd5ec7a23456bb83865e837ff"; // 从Cookie中提取的csrf token

/**
 * 初始化 session：访问首页获取 cookie 和 csrf_token
 */
async function initSession() {
  if (cookieJar && csrfToken) return; // 已初始化

  console.log("[爬虫] 初始化 session...");
  try {
    // 方法1: 访问首页
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
      // 禁止自动跟随重定向，手动处理以保留 cookie
      validateStatus: () => true,
    });

    // 提取 cookies
    const setCookie = res.headers["set-cookie"];
    if (setCookie && setCookie.length > 0) {
      const newCookies = setCookie.map((c) => c.split(";")[0]).join("; ");
      cookieJar = cookieJar ? `${cookieJar}; ${newCookies}` : newCookies;
    }

    // 方法2: 如果首页没拿到完整cookie，尝试访问登录页面
    if (!cookieJar || cookieJar.length < 100) {
      console.log("[爬虫] 尝试访问登录页面获取更多 cookie...");
      try {
        const loginRes = await axios.get("https://music.163.com/#/login", {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Referer: "https://music.163.com/",
          },
          timeout: 10000,
          validateStatus: () => true,
        });
        const loginSetCookie = loginRes.headers["set-cookie"];
        if (loginSetCookie && loginSetCookie.length > 0) {
          const newCookies = loginSetCookie
            .map((c) => c.split(";")[0])
            .join("; ");
          cookieJar = cookieJar ? `${cookieJar}; ${newCookies}` : newCookies;
        }
      } catch (e) {
        console.log("[爬虫] 登录页面访问失败:", e.message);
      }
    }

    // 方法3: 访问 API 端点
    if (!cookieJar || cookieJar.length < 100) {
      console.log("[爬虫] 尝试 /api 端点...");
      const apiRes = await axios.get("https://music.163.com/api/", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          Referer: "https://music.163.com/",
        },
        timeout: 10000,
        validateStatus: () => true,
      });
      const apiSetCookie = apiRes.headers["set-cookie"];
      if (apiSetCookie && apiSetCookie.length > 0) {
        const newCookies = apiSetCookie.map((c) => c.split(";")[0]).join("; ");
        cookieJar = cookieJar ? `${cookieJar}; ${newCookies}` : newCookies;
      }
    }

    // 提取 csrf_token（通常在 __csrf cookie 中）
    const csrfMatch = cookieJar.match(/__csrf=([^;]+)/);
    if (csrfMatch) {
      csrfToken = csrfMatch[1];
    }

    // 如果还是没有 csrf，尝试从其他 cookie 生成
    if (!csrfToken) {
      // 某些 API 不需要真实的 csrf，可以用任意值
      // 尝试从 MUSIC_U 或其他 cookie 提取
      const musicUMatch = cookieJar.match(/MUSIC_U=([^;]+)/);
      if (musicUMatch) {
        // 使用 MUSIC_U 的前32位作为 csrf
        csrfToken = musicUMatch[1].substring(0, 32);
      } else {
        // 生成一个随机的 csrf token（某些公开 API 允许）
        csrfToken = crypto.randomBytes(16).toString("hex");
      }
    }

    console.log(
      `[爬虫] Session 就绪, cookie 长度=${cookieJar.length}, csrf=${csrfToken ? "已获取" : "无"}`,
    );
  } catch (e) {
    console.error(`[爬虫] 初始化 session 失败: ${e.message}`);
    // 即使失败也生成一个 csrf token
    if (!csrfToken) {
      csrfToken = crypto.randomBytes(16).toString("hex");
    }
  }
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
        // 搜索接口返回粉丝数在 fansSize 字段中
        followers: a.fansSize || 0,
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
function extractRegionFromDesc(desc) {
  if (!desc) return "";

  // 台湾相关
  if (desc.includes("台湾") || desc.includes("台北") || desc.includes("新北")) {
    return "中国台湾";
  }
  // 香港相关
  if (desc.includes("香港")) {
    return "中国香港";
  }
  // 澳门相关
  if (desc.includes("澳门")) {
    return "中国澳门";
  }
  // 美国相关
  if (
    desc.includes("美国") ||
    desc.includes("USA") ||
    desc.includes("American") ||
    /\bUS\b/.test(desc)
  ) {
    return "美国";
  }
  // 日本相关
  if (
    desc.includes("日本") ||
    desc.includes("东京") ||
    /\bJapan\b/i.test(desc) ||
    /\bJapanese\b/i.test(desc)
  ) {
    return "日本";
  }
  // 韩国相关
  if (
    desc.includes("韩国") ||
    desc.includes("首尔") ||
    /\bKorea\b/i.test(desc) ||
    /\bKorean\b/i.test(desc)
  ) {
    return "韩国";
  }
  // 新加坡相关
  if (desc.includes("新加坡") || /\bSingapore\b/i.test(desc)) {
    return "新加坡";
  }
  // 马来西亚相关
  if (
    desc.includes("马来西亚") ||
    /\bMalaysia\b/i.test(desc) ||
    /\bMalaysian\b/i.test(desc)
  ) {
    return "马来西亚";
  }
  // 英国相关
  if (
    desc.includes("英国") ||
    desc.includes("伦敦") ||
    /\bUK\b/.test(desc) ||
    /\bUnited Kingdom\b/i.test(desc) ||
    /\bBritish\b/i.test(desc) ||
    /\bEngland\b/i.test(desc)
  ) {
    return "英国";
  }
  // 法国相关
  if (
    desc.includes("法国") ||
    desc.includes("巴黎") ||
    /\bFrance\b/i.test(desc) ||
    /\bFrench\b/i.test(desc)
  ) {
    return "法国";
  }
  // 德国相关
  if (
    desc.includes("德国") ||
    /\bGermany\b/i.test(desc) ||
    /\bGerman\b/i.test(desc)
  ) {
    return "德国";
  }
  // 荷兰相关
  if (
    desc.includes("荷兰") ||
    /\bNetherlands\b/i.test(desc) ||
    /\bDutch\b/i.test(desc) ||
    /\bHolland\b/i.test(desc)
  ) {
    return "荷兰";
  }
  // 加拿大相关
  if (
    desc.includes("加拿大") ||
    /\bCanada\b/i.test(desc) ||
    /\bCanadian\b/i.test(desc)
  ) {
    return "加拿大";
  }
  // 澳大利亚相关
  if (
    desc.includes("澳大利亚") ||
    desc.includes("澳洲") ||
    /\bAustralia\b/i.test(desc) ||
    /\bAustralian\b/i.test(desc)
  ) {
    return "澳大利亚";
  }
  // 瑞典相关
  if (
    desc.includes("瑞典") ||
    /\bSweden\b/i.test(desc) ||
    /\bSwedish\b/i.test(desc)
  ) {
    return "瑞典";
  }
  // 挪威相关
  if (
    desc.includes("挪威") ||
    /\bNorway\b/i.test(desc) ||
    /\bNorwegian\b/i.test(desc)
  ) {
    return "挪威";
  }
  // 意大利相关
  if (
    desc.includes("意大利") ||
    /\bItaly\b/i.test(desc) ||
    /\bItalian\b/i.test(desc)
  ) {
    return "意大利";
  }
  // 西班牙相关
  if (
    desc.includes("西班牙") ||
    /\bSpain\b/i.test(desc) ||
    /\bSpanish\b/i.test(desc)
  ) {
    return "西班牙";
  }
  // 巴西相关
  if (
    desc.includes("巴西") ||
    /\bBrazil\b/i.test(desc) ||
    /\bBrazilian\b/i.test(desc)
  ) {
    return "巴西";
  }
  // 印度相关
  if (
    desc.includes("印度") ||
    /\bIndia\b/i.test(desc) ||
    /\bIndian\b/i.test(desc)
  ) {
    return "印度";
  }
  // 泰国相关
  if (
    desc.includes("泰国") ||
    /\bThailand\b/i.test(desc) ||
    /\bThai\b/i.test(desc)
  ) {
    return "泰国";
  }
  // 菲律宾相关
  if (
    desc.includes("菲律宾") ||
    /\bPhilippines\b/i.test(desc) ||
    /\bFilipino\b/i.test(desc)
  ) {
    return "菲律宾";
  }
  // 印尼相关
  if (
    desc.includes("印尼") ||
    desc.includes("印度尼西亚") ||
    /\bIndonesia\b/i.test(desc) ||
    /\bIndonesian\b/i.test(desc)
  ) {
    return "印度尼西亚";
  }
  // 无法识别，返回空字符串
  return "";
}

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

  // 从简介中提取地区
  const region = extractRegionFromDesc(briefDesc);

  // 获取粉丝数
  let followers = 0;
  try {
    followers = await getArtistFollowers(artistId);
  } catch (e) {
    console.log(`[爬虫] 获取粉丝数失败: ${e.message}`);
  }

  return {
    id: a.id || artistId,
    name: a.name || "",
    avatar_url: a.picUrl || a.cover || a.img1v1Url || "",
    followers: followers,
    brief_desc: briefDesc,
    region: region,
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
 * 从歌手页面HTML中解析相似歌手
 * URL格式: https://music.163.com/artist?id=7763
 */
async function getSimilarArtists(artistId) {
  console.log(`[爬虫] similar artists: ${artistId}`);

  try {
    // 直接访问歌手页面
    const url = `https://music.163.com/artist?id=${artistId}`;
    console.log(`[爬虫] 获取相似歌手: ${url}`);

    const htmlRes = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Cookie": cookieJar,
        "Referer": "https://music.163.com/",
      },
      timeout: 10000,
    });

    const html = htmlRes.data;

    // 查找相似歌手区域
    // HTML结构: <span class="f-fl">相似歌手</span> 后面跟着 <ul class="m-hdlist">...</ul>
    // 或者直接查找 <a href="/artist?id=xxx" class="nm nm-icn f-thide s-fc0">歌手名</a>

    const similarArtists = [];

    // 方法1: 查找相似歌手区块后的歌手链接
    // 匹配模式: 找到"相似歌手"文本，然后在后面的内容中提取歌手链接
    const simSectionMatch = html.match(/相似歌手[\s\S]*?<ul[^>]*class="m-hdlist"[^>]*>([\s\S]*?)<\/ul>/i);

    if (simSectionMatch) {
      const sectionHtml = simSectionMatch[1];
      // 提取歌手信息: <a href="/artist?id=12345" class="nm nm-icn f-thide s-fc0">歌手名</a>
      const artistRegex = /<a[^>]*href="\/artist\?id=(\d+)"[^>]*class="[^"]*nm[^"]*"[^>]*>([^<]+)<\/a>/gi;
      let match;

      while ((match = artistRegex.exec(sectionHtml)) !== null && similarArtists.length < 6) {
        const id = parseInt(match[1], 10);
        const name = match[2].trim();

        // 尝试提取头像
        const avatarMatch = sectionHtml.match(new RegExp(`<img[^>]*data-src="([^"]+)"[^>]*>`, 'i'));
        const avatar = avatarMatch ? avatarMatch[1].replace(/http:/, 'https:') : '';

        if (id && name) {
          similarArtists.push({
            id,
            name,
            avatar_url: avatar,
            similarity_score: 0,
          });
        }
      }
    }

    // 方法2: 如果方法1失败，尝试更通用的匹配
    if (similarArtists.length === 0) {
      // 查找所有歌手链接，排除当前歌手
      const allArtistsRegex = /<a[^>]*href="\/artist\?id=(\d+)"[^>]*>([^<]+)<\/a>/gi;
      let match;
      const seen = new Set([artistId]);

      while ((match = allArtistsRegex.exec(html)) !== null && similarArtists.length < 6) {
        const id = parseInt(match[1], 10);
        const name = match[2].trim();

        if (id && name && !seen.has(id)) {
          seen.add(id);
          similarArtists.push({
            id,
            name,
            avatar_url: '',
            similarity_score: 0,
          });
        }
      }
    }

    console.log(`[爬虫] 成功获取 ${similarArtists.length} 位相似歌手`);
    return similarArtists;
  } catch (error) {
    console.error(`[爬虫] 获取相似歌手失败:`, error.message);
    return [];
  }
}

/**
 * 获取歌手描述/简介
 * 使用本地 NeteaseCloudMusicApi 服务
 */
async function getArtistDesc(artistId) {
  console.log(`[爬虫] artist desc: ${artistId}`);

  try {
    const url = `http://localhost:4000/artist/desc?id=${artistId}`;

    const res = await axios.get(url, {
      timeout: 10000,
    });

    const data = res.data;

    if (!data || data.code !== 200) {
      console.log(`[爬虫] 获取歌手描述失败: code=${data?.code}`);
      return null;
    }

    console.log(`[爬虫] 成功获取歌手描述`);
    return {
      briefDesc: data.briefDesc || "",
      introduction: data.introduction || [],
    };
  } catch (error) {
    console.error(`[爬虫] 获取歌手描述失败:`, error.message);
    return null;
  }
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
 * 获取歌手粉丝数
 * 从歌手用户主页HTML中解析粉丝数
 * URL格式: https://music.163.com/user/home?id={userId}
 * HTML字段: <strong id="fan_count">14216514</strong>
 */
// 已知歌手的accountId映射表（歌手ID -> 用户ID）
const ARTIST_ACCOUNT_MAP = {
  6452: 281382,    // 周杰伦
  13193: 38672879, // 林俊杰 (旧ID)
  3684: 38672879,  // 林俊杰 (新ID)
  5346: 12138950,  // 张学友
  7763: 35740139,  // 陈奕迅
  1050282: 29879271, // 邓紫棋
  1045124: 460912, // 华晨宇
  5771: 51801979,  // 周深
  1055927: 38361126, // 毛不易
  1024220: 175326, // 薛之谦
  1050662: 12143967, // 李荣浩
  1197201: 29593150, // 吴青峰
  1040383: 29802127, // 买辣椒也用券
};

/**
 * 获取歌手粉丝数
 * @param {number} artistId 歌手ID
 * @param {number} accountId 可选的用户账号ID
 * @returns {Promise<number>} 粉丝数
 */
async function getArtistFollowers(artistId, accountId = null) {
  try {
    // 优先使用传入的accountId，否则使用映射表
    if (!accountId) {
      accountId = ARTIST_ACCOUNT_MAP[artistId];
    }

    if (!accountId) {
      console.log(`[爬虫] 歌手无accountId映射: ${artistId}`);
      return 0;
    }

    // 访问用户主页获取粉丝数
    const userHomeUrl = `https://music.163.com/user/home?id=${accountId}`;
    console.log(`[爬虫] 获取粉丝数: ${userHomeUrl}`);

    const htmlRes = await axios.get(userHomeUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Cookie": cookieJar,
        "Referer": "https://music.163.com/",
      },
      timeout: 10000,
    });

    const html = htmlRes.data;

    // 解析 <strong id="fan_count">14216514</strong>
    const fanCountMatch = html.match(/<strong\s+id="fan_count"[^>]*>(\d+)<\/strong>/i);
    if (fanCountMatch) {
      const fans = parseInt(fanCountMatch[1], 10);
      console.log(`[爬虫] 成功获取粉丝数: ${artistId} -> ${fans}`);
      return fans;
    }

    // 备用：尝试其他格式
    const altMatch = html.match(/id="fan_count"[^>]*>(\d+)/i);
    if (altMatch) {
      const fans = parseInt(altMatch[1], 10);
      console.log(`[爬虫] 成功获取粉丝数(备用): ${artistId} -> ${fans}`);
      return fans;
    }

    console.log(`[爬虫] 未找到粉丝数字段: ${artistId}`);
    return 0;
  } catch (e) {
    console.error(`[爬虫] 获取粉丝数失败: ${artistId} - ${e.message}`);
    return 0;
  }
}

/**
 * 获取歌曲歌词
 * @param {number} songId 歌曲ID
 * @returns {Promise<string>} 纯歌词文本（已去除时间戳）
 */
async function getSongLyric(songId) {
  const url = `https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`;
  try {
    const data = await request(url);
    if (data.code !== 200 || !data.lrc || !data.lrc.lyric) {
      return "";
    }

    // 过滤制作信息、 credits 等元数据关键词
    const metaKeywords = [
      "制作",
      "编曲",
      "作词",
      "作曲",
      "混音",
      "监制",
      "出品",
      "企划",
      "统筹",
      "吉他",
      "弦乐",
      "人声",
      "录音棚",
      "录音室",
      "录音师",
      "母带",
      "发行",
      "推广",
      "营销",
      "总监",
      "助理",
      "编辑",
      "设计",
      "封面",
      "摄影",
      "造型",
      "化妆",
      "发型",
      "艺人",
      "经纪",
      "公司",
      "有限公司",
      "工作室",
      "团队",
      "鸣谢",
      "SP",
      "OP",
      "ISRC",
      "ISBN",
      "版权",
      "代理",
      "出品人",
      "发行人",
      "A&R",
      "制作人",
      "联合",
      "协力",
      "协助",
      "音乐",
      "总监",
      "指挥",
      "演奏",
      "乐团",
      "乐队",
      "合唱",
      "和声",
      "和音",
      "伴唱",
      "伴奏",
      "键盘",
      "贝斯",
      "鼓手",
      "打击乐",
      "管乐",
      "铜管",
      "木管",
      "小提琴",
      "大提琴",
      "中提琴",
      "低音提琴",
      "竖琴",
      "钢琴",
      "合成器",
      "编程",
      "采样",
      "音效",
      "后期",
      "缩混",
      "母带处理",
      "重新",
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
      "录音",
      "编写",
      "监制",
    ];

    // 去除时间戳 [00:00.000] 和元数据，保留纯歌词
    const lyric = data.lrc.lyric
      .split("\n")
      .map((line) => line.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]/, "").trim())
      .filter((line) => {
        if (!line || line.startsWith("[") || line.startsWith("{")) return false;
        // 过滤包含制作信息的行（行中有1个以上制作关键词且字数<30）
        const metaCount = metaKeywords.filter((k) => line.includes(k)).length;
        if (metaCount >= 1 && line.length < 30) return false;
        if (metaCount >= 2) return false;
        // 过滤纯英文大写（如 NEWBAND, SP, OP 等）
        if (/^[A-Z\s]+$/.test(line) && line.length < 20) return false;
        return true;
      })
      .join("\n");
    return lyric;
  } catch (e) {
    console.error(`[爬虫] 获取歌词失败: ${songId} - ${e.message}`);
    return "";
  }
}


/**
 * 获取歌曲热门评论内容
 */
async function getSongComments(songId, limit) {
  limit = limit || 50;
  const url = "https://music.163.com/api/v1/resource/comments/R_SO_4_" + songId + "?limit=" + limit + "&offset=0";
  try {
    const data = await request(url);
    if (data.code !== 200) return [];
    return (data.hotComments || data.comments || []).map(function (c) { return c.content || ""; });
  } catch (e) {
    return [];
  }
}

/**
 * 获取热搜列表
 * 使用热歌榜数据模拟热搜榜
 */
async function getHotSearch() {
  console.log(`[爬虫] 获取热搜列表（使用热歌榜数据）`);

  try {
    // 使用热歌榜数据模拟热搜
    const hotSongs = await getHotSongsFromPlaylist();

    // 将歌曲数据转换为热搜格式
    const hotList = hotSongs.map((song, index) => ({
      searchWord: song.name,
      score: Math.max(1000000 - index * 10000, 100000), // 模拟热度值
      iconType: index < 3 ? 1 : 0, // 前三名标为热
      content: `${song.artists} - ${song.album_name}`,
      url: `https://music.163.com/song?id=${song.id}`,
      hotValue: Math.max(1000000 - index * 10000, 100000),
      ranking: index + 1,
    }));

    console.log(`[爬虫] 成功获取 ${hotList.length} 条热搜数据`);
    return hotList;
  } catch (e) {
    console.error(`[爬虫] 获取热搜失败: ${e.message}`);
    return [];
  }
}

/**
 * 获取热歌榜数据
 */
async function getHotSongsFromPlaylist(playlistId = '3778678') {
  const url = `https://music.163.com/api/v3/playlist/detail?id=${playlistId}`;
  console.log(`[爬虫] 获取热歌榜: ${playlistId}`);

  try {
    const data = await request(url);

    if (data.code !== 200) {
      console.log(`[爬虫] 热歌榜API返回 code=${data.code}`);
      return [];
    }

    const tracks = data.playlist?.tracks || data.data?.playlist?.tracks || [];

    return tracks.slice(0, 20).map((track) => ({
      id: track.id,
      name: track.name,
      artists: (track.artists || track.ar || []).map(a => a.name).join(' / '),
      album_name: track.album?.name || track.al?.name || '',
      plays: track.pop || 0,
      duration: track.duration || track.dt || 0,
    }));
  } catch (e) {
    console.error(`[爬虫] 获取热歌榜失败: ${e.message}`);
    return [];
  }
}

module.exports = {
  initSession,
  searchSuggest,
  search,
  getArtistDetail,
  getArtistTopSongs,
  getArtistDesc,
  getSimilarArtists,
  getSongCommentCount,
  getBatchCommentCounts,
  getArtistFollowers,
  getSongLyric,
  getSongComments,
  getHotSearch,
  getCookie: () => cookieJar,
  getCsrf: () => csrfToken,
};
