import { formatLargeNumber } from './utils';

export function refreshOverview(setOverview) {
  import('./api').then(({ getOverview }) => {
    getOverview().then(setOverview).catch(() => {});
  });
}

export function refreshStylePie(setStylePieData, { stylePieData }) {
  if (stylePieData) return;
  import('./api').then(({ getStylePie }) => {
    getStylePie().then(setStylePieData).catch(() => {});
  });
}

export function refreshTop10Plays(artistId, setTop10Plays, { top10Plays }) {
  if (top10Plays) return;
  import('./api').then(({ getTop10Plays }) => {
    getTop10Plays(artistId).then(setTop10Plays).catch(() => {});
  });
}

export function refreshScatter(setScatter, { scatter }) {
  if (scatter) return;
  import('./api').then(({ getScatter }) => {
    getScatter().then(setScatter).catch(() => {});
  });
}

export function refreshRadar(setRadar, { radar }) {
  if (radar) return;
  import('./api').then(({ getRadar }) => {
    getRadar().then(setRadar).catch(() => {});
  });
}

export function refreshBubble(setBubble, { bubble }) {
  if (bubble) return;
  import('./api').then(({ getBubble }) => {
    getBubble().then(setBubble).catch(() => {});
  });
}

export function refreshEraTrend(setEraTrend, { eraTrend }) {
  if (eraTrend) return;
  import('./api').then(({ getEraTrend }) => {
    getEraTrend().then(setEraTrend).catch(() => {});
  });
}

export function refreshRegionMap(setRegionMap, { regionMap }) {
  if (regionMap) return;
  import('./api').then(({ getRegionMap }) => {
    getRegionMap().then(setRegionMap).catch(() => {});
  });
}

export function refreshGroupedBar(setGroupedBar, { groupedBar }) {
  if (groupedBar) return;
  import('./api').then(({ getGroupedBar }) => {
    getGroupedBar().then(setGroupedBar).catch(() => {});
  });
}

export function refreshStyleHeatmap(setStyleHeatmap, { styleHeatmap }) {
  if (styleHeatmap) return;
  import('./api').then(({ getStyleHeatmap }) => {
    getStyleHeatmap().then(setStyleHeatmap).catch(() => {});
  });
}

export function refreshAlbumDonut(setAlbumDonut, { albumDonut }) {
  if (albumDonut) return;
  import('./api').then(({ getAlbumDonut }) => {
    getAlbumDonut().then(setAlbumDonut).catch(() => {});
  });
}

export function refreshViolin(setViolin, { violin }) {
  if (violin) return;
  import('./api').then(({ getViolin }) => {
    getViolin().then(setViolin).catch(() => {});
  });
}

export function getRefreshFns(artistId) {
  return {
    overview: (setOverview) => refreshOverview(setOverview),
    stylePie: (setStylePieData) => refreshStylePie(setStylePieData, {}),
    top10Plays: (setTop10Plays) => refreshTop10Plays(artistId, setTop10Plays, {}),
    scatter: (setScatter) => refreshScatter(setScatter, {}),
    radar: (setRadar) => refreshRadar(setRadar, {}),
    bubble: (setBubble) => refreshBubble(setBubble, {}),
    eraTrend: (setEraTrend) => refreshEraTrend(setEraTrend, {}),
    regionMap: (setRegionMap) => refreshRegionMap(setRegionMap, {}),
    groupedBar: (setGroupedBar) => refreshGroupedBar(setGroupedBar, {}),
    styleHeatmap: (setStyleHeatmap) => refreshStyleHeatmap(setStyleHeatmap, {}),
    albumDonut: (setAlbumDonut) => refreshAlbumDonut(setAlbumDonut, {}),
    violin: (setViolin) => refreshViolin(setViolin, {}),
  };
}
