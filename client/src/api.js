const BASE_URL = "/api";

export async function fetchApi(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const json = await res.json();
  if (json.code !== 200) {
    throw new Error(json.msg || "请求失败");
  }
  return json.data;
}

// 仪表盘总览
export const getOverview = () => fetchApi("/dashboard/overview");

// 搜索
export const searchArtists = (keyword) =>
  fetchApi(`/search/artists?keyword=${encodeURIComponent(keyword)}`);

// 歌手
export const getArtists = (limit = 50) => fetchApi(`/artists?limit=${limit}`);
export const getArtistDetail = (id) => fetchApi(`/artist/${id}`);
export const getArtistSongs = (id) => fetchApi(`/artist/${id}/songs`);
export const getArtistPopularity = (id) => fetchApi(`/artist/${id}/popularity`);
export const crawlArtist = (id) => fetchApi(`/artist/${id}/crawl`);
export const getSimilarArtists = (id) => fetchApi(`/artist/${id}/similar`);
export const getArtistDesc = (id) => fetchApi(`/artist/${id}/desc`);
export const getArtistTopSongs = (id, limit = 20) =>
  fetchApi(`/artist/${id}/top-songs?limit=${limit}`);
export const getHotSearch = () => fetchApi("/hot-search");
export const getCompareCharts = (ids) =>
  fetchApi(`/compare/charts?ids=${ids.join(",")}`);

// 图表
export const getStylePie = () => fetchApi("/chart/style-pie");
export const getTop10Plays = (artistId) =>
  fetchApi(`/chart/top10-plays${artistId ? `?artist_id=${artistId}` : ""}`);
export const getTop10Comments = (artistId) =>
  fetchApi(`/chart/top10-comments${artistId ? `?artist_id=${artistId}` : ""}`);
export const getPlaysTrend = (artistId) =>
  fetchApi(`/chart/plays-trend${artistId ? `?artist_id=${artistId}` : ""}`);
export const getEraTrend = () => fetchApi("/chart/era-trend");
export const getCommentWordcloud = (artistId) =>
  fetchApi(
    `/chart/comment-wordcloud${artistId ? `?artist_id=${artistId}` : ""}`,
  );
export const getStyleHeatmap = () => fetchApi("/chart/style-heatmap");
export const getStyleBoxplot = () => fetchApi("/chart/style-boxplot");
export const getScatter = () => fetchApi("/chart/scatter");
export const getRadar = (ids) =>
  fetchApi(`/chart/radar${ids ? `?ids=${ids}` : ""}`);
export const getAlbumDonut = () => fetchApi("/chart/album-donut");
export const getViolin = () => fetchApi("/chart/violin");
export const getStackedEra = () => fetchApi("/chart/stacked-era");
export const getSankey = () => fetchApi("/chart/sankey");
export const getGroupedBar = (ids) =>
  fetchApi(`/chart/grouped-bar${ids ? `?ids=${ids}` : ""}`);
export const getBubble = () => fetchApi("/chart/bubble");
export const getRegionMap = () => fetchApi("/chart/region-map");
export const getLyricWordcloud = (ids) =>
  fetchApi(`/lyrics/wordcloud?ids=${ids.join(",")}`);
