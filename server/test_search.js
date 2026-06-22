const axios = require("axios");

async function test() {
  const cookie = '_ntes_nnid=7904eea0e9797c762a2641d9077b5540,1762224547989; _ntes_nuid=7904eea0e9797c762a2641d9077b5540; NMTID=00O68yenl7ArFfKREi6p5FQ4rnKrT0AAAGaTMSqSQ; WEVNSM=1.0.0; WNMCID=xxreko.1762224548968.01.0; WM_TID=Po49cJJHS6NEERVVFEKWzDSgtCSd7PM3; ntes_utid=tid._.HY6x9QHRLgJEV1EQUALDmCD19XGaFw2s._.0; sDeviceId=YD-Bzi5MbMB7mFAUwFQEVLC2DCxtCHLE1i8; __snaker__id=81jjfC65uBb4T9ip; ntes_kaola_ad=1; nts_mail_user=axwl040812@163.com:-1:1; NTES_P_UTID=itWbo7GLjT5sIHvgJibH3uqA8bHeTc3X|1775458611; P_INFO=15922079023|1780825749|1|music|00&99|null&null&null#heb&130100#10#0|&0|null|15922079023; _iuqxldmzr_=32; Hm_lvt_1483fb4774c02a30ffa6f0e2945e9b70=1780901822,1781576402,1782090194; HMACCOUNT=BA6F0F854698C7D1; WM_NI=27lSYQ2E71qBGgO49KHjzVNNmK0YRMGxqYKe%2FrQUObLzkQ7bpKFr%2B%2BGVs2%2FIWDY7Gau%2FLSlz6O5m0Q3ZHG%2F%2BRfyI2Q3vaJ%2BPKnm%2BOGf%2BwgiapeXzalJK%2BrcfCwchj0lPMUo%3D; WM_NIKE=9ca17ae2e6ffcda170e2e6ee97b679fc9c9adaaa7993b08ba6c45e878f8eacc63ea6a6a894f268b19aada4db2af0fea7c3b92af2e9a4b4dc5bf29bf9d2f44a85b981d5bc418cb6b6b7cd46af9500bad14785a8bfbaca6fedae9fb6ce6a90a6a5b2b66ab4958a93aa21858abdd3ae43959c97d8c66bb7f184b4ef72f691fb8eb35bf18688a8ae2192bab7aab15bf1aaafabaa5c89b2a3ccce4da6f5b988ec6bb4bb989be4688a95e593e26e81a9ad89e93cb09083b6ee37e2a3; JSESSIONID-WYYY=ymNkgoOFiE%5CYtssm73%2FzZ1mQ6xOjAZN%2BMZTKxxc%2B83DdBH3Hk9KwkDzo9eP19x5oGZDKbFyHARUgdvRnxei3fMpomPFnmN%2BXPnQQKo8SGlt2k69%2Bov7Th7n%5CdzPpg%2BWKevgvbKUzqzosnlBT6qTrHr6%2BZVFQyqKe4WVisc%2BeXYgZOd2Z%3A1782093735017; gdxidpyhxdE=U1z8jRmys6y%5CC2Usgt0SL%2FTlZWMzmV%2Bo5EdtQxM7rUpg%2FUuO0g9Mi3%2BfyHrDEo%2BI%2Bw%5CKQxUaG%5COIoXS%2BCKDB6vNvy19zVKDtnts0IfvgPv%2F4r%5CIQ9oYNt%2Bnw%2B5ehx%5CrHR6bPiLI68HnHfQnEtXVJC7MXzv2vOsS8zoWCWrbsCszIlb5C%3A1782093595594; __csrf=5926969fd5ec7a23456bb83865e837ff; Hm_lpvt_1483fb4774c02a30ffa6f0e2945e9b70=1782092735';
  
  // 测试搜索API
  console.log("1. 测试搜索API...");
  const keyword = "周杰伦";
  const searchUrl = `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=100&offset=0&limit=10`;
  
  try {
    const res = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Cookie": cookie,
        "Referer": "https://music.163.com/",
      },
    });
    
    console.log("Response code:", res.data.code);
    if (res.data.result?.artists) {
      console.log("\n找到歌手:");
      for (const artist of res.data.result.artists.slice(0, 3)) {
        console.log(`- ${artist.name} (id: ${artist.id}, accountId: ${artist.accountId || 'N/A'})`);
      }
    } else {
      console.log("Response:", JSON.stringify(res.data, null, 2).substring(0, 800));
    }
  } catch (e) {
    console.log("Error:", e.message);
  }
  
  // 测试另一种搜索方式
  console.log("\n2. 测试 weapi/search...");
  try {
    const res = await axios.post(
      'https://music.163.com/weapi/cloudsearch/get/web',
      `params=${encodeURIComponent(JSON.stringify({s: "周杰伦", type: 100, offset: 0, limit: 10}))}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookie,
          "Referer": "https://music.163.com/",
        },
      }
    );
    console.log("weapi search response:", JSON.stringify(res.data, null, 2).substring(0, 800));
  } catch (e) {
    console.log("weapi search error:", e.message);
  }
}

test().catch(console.error);
