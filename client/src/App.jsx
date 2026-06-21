import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "./ThemeContext";
import PieChart from "./components/PieChart";
import BarChart from "./components/BarChart";
import LineChart from "./components/LineChart";
import ScatterChart from "./components/ScatterChart";
import RadarChart from "./components/RadarChart";
import BubbleChart from "./components/BubbleChart";
import GroupedBarChart from "./components/GroupedBarChart";
import MapChart from "./components/MapChart";
import RankingChart from "./components/RankingChart";
import TrendAnalysisChart from "./components/TrendAnalysisChart";
import SentimentAnalysisCard from "./components/SentimentAnalysisCard";
import TopicClusterCard from "./components/TopicClusterCard";
import LyricWordCloud from "./components/LyricWordCloud";
import LoadingPage from "./components/LoadingPage";
import ChartMenu from "./components/ChartMenu";
import { formatLargeNumber } from "./utils";
import * as api from "./api";
import { useDragDrop, CHART_TYPES } from "./hooks/useDragDrop";

const MAX_ARTISTS = 4;

// localStorage 持久化
function loadState(key, fallback) {
  try {
    const v = localStorage.getItem("mv_" + key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveState(key, val) {
  try {
    localStorage.setItem("mv_" + key, JSON.stringify(val));
  } catch { }
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [selectedArtists, setSelectedArtists] = useState(
    loadState("artists", []),
  );
  const [artistDetails, setArtistDetails] = useState(loadState("details", {}));
  const [loading, setLoading] = useState(false);
  const [entered, setEntered] = useState(loadState("entered", false));

  // Search
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef(null);
  const searchRef = useRef(null);
  const landingRef = useRef(null);
  const [searchActive, setSearchActive] = useState(false);

  // 图表数据
  const [compareData, setCompareData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [regionMap, setRegionMap] = useState(loadState("regionMap", {}));

  // 整体加载页面状态
  const [showLoadingPage, setShowLoadingPage] = useState(false);
  const [loadingPageData, setLoadingPageData] = useState({
    artists: [],
    currentArtist: "",
    progress: 0,
    status: "准备中...",
  });

  // 相似歌手数据
  const [similarArtists, setSimilarArtists] = useState({});

  // 歌手描述数据
  const [artistDescs, setArtistDescs] = useState({});

  // 歌手热门歌曲数据
  const [artistTopSongs, setArtistTopSongs] = useState({});

  // 歌手评论数数据
  const [commentCounts, setCommentCounts] = useState({});

  // 热搜数据
  const [hotSearch, setHotSearch] = useState([]);

  // 评论分析 - 选中的歌曲
  const [analysisSong, setAnalysisSong] = useState(null);

  // 歌词词云数据
  const [lyricWordCloudData, setLyricWordCloudData] = useState(null);

  // 图表菜单状态
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 拖拽功能
  const {
    activePanelId,
    dragOverPanelId,
    panelOrder,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleAddFromMenu,
    handleRemoveFromGrid,
    handleResetLayout,
  } = useDragDrop();

  // 歌手简介展开状态（修复：不能在循环中使用 useState）
  const [expandedArtists, setExpandedArtists] = useState({});

  // 国家/地区映射表
  const COUNTRY_REGION_MAP = {
    "中国": "北京",
    "中国内地": "北京",
    "中国大陆": "北京",
    "台湾": "台湾",
    "中国台湾": "台湾",
    "香港": "香港",
    "中国香港": "香港",
    "澳门": "澳门",
    "中国澳门": "澳门",
    "美国": "美国",
    "日本": "日本",
    "韩国": "韩国",
    "新加坡": "新加坡",
    "马来西亚": "马来西亚",
    "英国": "英国",
    "法国": "法国",
    "德国": "德国",
    "加拿大": "加拿大",
    "澳大利亚": "澳大利亚",
  };

  const updateRegion = (artistId, region) => {
    // 将国家级别转换为地区级别
    const normalizedRegion = COUNTRY_REGION_MAP[region] || region;
    setRegionMap((prev) => {
      const next = { ...prev, [artistId]: normalizedRegion };
      saveState("regionMap", next);
      return next;
    });
  };

  // 持久化关键状态
  useEffect(() => {
    saveState("artists", selectedArtists);
  }, [selectedArtists]);
  useEffect(() => {
    saveState("details", artistDetails);
  }, [artistDetails]);
  useEffect(() => {
    saveState("entered", entered);
  }, [entered]);

  const isLanding = !entered || selectedArtists.length === 0;

  // 如果进入后清空了，return to landing
  useEffect(() => {
    if (entered && selectedArtists.length === 0) setEntered(false);
  }, [selectedArtists, entered]);

  // 跟踪上一次的歌手ID列表，只有真正变化时才刷新图表
  const prevArtistIdsRef = useRef("");

  // 刷新图表数据
  const refreshCharts = useCallback(async () => {
    if (selectedArtists.length === 0 || showLoadingPage) return;

    setIsLoading(true);
    try {
      const ids = selectedArtists.map((a) => a.id);
      const data = await api.getCompareCharts(ids);
      setCompareData(data);

      // 加载歌词词云
      try {
        const lyricData = await api.getLyricWordcloud(ids);
        setLyricWordCloudData(lyricData);
      } catch (e) {
        console.error("歌词词云加载失败:", e);
      }
    } catch { }
    setIsLoading(false);
  }, [selectedArtists, showLoadingPage]);

  // 当选中歌手列表真正发生变化时才刷新图表（搜索输入不会触发）
  useEffect(() => {
    if (
      !entered ||
      isLanding ||
      showLoadingPage ||
      selectedArtists.length === 0
    )
      return;
    const idsKey = selectedArtists
      .map((a) => a.id)
      .sort((a, b) => a - b)
      .join(",");
    if (idsKey === prevArtistIdsRef.current) return; // 歌手没变，跳过
    prevArtistIdsRef.current = idsKey;
    refreshCharts();
  }, [entered, isLanding, showLoadingPage, selectedArtists, refreshCharts]);

  // 获取相似歌手
  useEffect(() => {
    if (!entered || selectedArtists.length === 0) return;
    selectedArtists.forEach((a) => {
      if (!similarArtists[a.id]) {
        api.getSimilarArtists(a.id).then((data) => {
          if (data && data.length > 0) {
            setSimilarArtists((prev) => ({ ...prev, [a.id]: data }));
          }
        }).catch(() => { });
      }
    });
  }, [entered, selectedArtists]);

  // 获取歌手描述、热门歌曲和评论数
  useEffect(() => {
    if (!entered || selectedArtists.length === 0) return;
    selectedArtists.forEach((a) => {
      // 获取歌手描述
      if (!artistDescs[a.id]) {
        api.getArtistDesc(a.id).then((data) => {
          if (data) {
            setArtistDescs((prev) => ({ ...prev, [a.id]: data }));
          }
        }).catch(() => { });
      }
      // 获取热门歌曲和评论数
      if (!artistTopSongs[a.id]) {
        api.getArtistTopSongs(a.id, 10).then((data) => {
          if (data && data.length > 0) {
            setArtistTopSongs((prev) => ({ ...prev, [a.id]: data }));
            // 计算评论数
            const totalComments = data.reduce((sum, song) => sum + (song.comments_count || 0), 0);
            setCommentCounts((prev) => ({ ...prev, [a.id]: totalComments }));
            // 自动选择第一首歌用于评论分析（如果没有选中歌曲）
            setAnalysisSong((prev) => {
              if (!prev && data.length > 0) {
                const artist = selectedArtists.find(sa => sa.id === a.id);
                return {
                  id: data[0].id,
                  name: data[0].name,
                  artist: artist?.name || a.name
                };
              }
              return prev;
            });
          }
        }).catch(() => { });
      }
    });
  }, [entered, selectedArtists]);

  // 获取热搜数据
  useEffect(() => {
    if (!entered) return;
    api.getHotSearch().then((data) => {
      if (data && data.length > 0) {
        setHotSearch(data);
      }
    }).catch(() => { });
  }, [entered]);

  // 处理进入可视化
  const handleEnterVisualization = async () => {
    const artistNames = selectedArtists.map(
      (a) => artistDetails[a.id]?.name || a.name,
    );
    const totalArtists = artistNames.length;

    // 显示全屏加载页面（只显示歌手）
    setShowLoadingPage(true);
    setLoadingPageData({
      artists: artistNames.map((name, index) => ({
        name,
        status: index === 0 ? "processing" : "pending",
      })),
      currentArtist: artistNames[0] || "",
      progress: 5,
      status: "正在抓取数据...",
    });

    setIsLoading(true);

    try {
      // 逐个爬取歌手
      for (let i = 0; i < totalArtists; i++) {
        const artistId = selectedArtists[i].id;
        const artistName = artistNames[i];

        setLoadingPageData((prev) => ({
          ...prev,
          artists: prev.artists.map((a, idx) => ({
            ...a,
            status: idx === i ? "processing" : idx < i ? "done" : "pending",
          })),
          currentArtist: artistName,
          progress: 5 + Math.round((i / totalArtists) * 50),
          status: `正在抓取 ${artistName}...`,
        }));

        try {
          await api.crawlArtist(artistId);
        } catch (e) {
          console.error(`抓取歌手 ${artistName} 失败:`, e);
        }

        setLoadingPageData((prev) => ({
          ...prev,
          artists: prev.artists.map((a, idx) => ({
            ...a,
            status: idx <= i ? "done" : "pending",
          })),
        }));
      }

      // 获取图表数据
      setLoadingPageData((prev) => ({
        ...prev,
        progress: 90,
        status: "正在分析数据...",
      }));

      const data = await api.getCompareCharts(selectedArtists.map((a) => a.id));
      setCompareData(data);

      // 隐藏loading页面
      setShowLoadingPage(false);

      // 完成后
      setLoadingPageData((prev) => ({
        ...prev,
        progress: 100,
        status: "加载完成!",
      }));

      setTimeout(() => {
        setShowLoadingPage(false);
        setEntered(true);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error("加载失败:", error);
      setLoadingPageData((prev) => ({
        ...prev,
        progress: 100,
        status: "加载失败，请重试",
      }));
      setTimeout(() => {
        setShowLoadingPage(false);
        setEntered(true);
        setIsLoading(false);
      }, 1500);
    }
  };

  // Search handler
  useEffect(() => {
    if (!keyword.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await api.searchArtists(keyword);
        setSearchResults(data || []);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [keyword]);

  // Click outside search
  useEffect(() => {
    const handler = (e) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target) &&
        landingRef.current &&
        !landingRef.current.contains(e.target)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectArtist = async (artist) => {
    if (selectedArtists.length >= MAX_ARTISTS) return;

    // 防重复
    if (selectedArtists.find((a) => a.id === artist.id)) {
      setShowResults(false);
      setKeyword("");
      return;
    }

    // 如果已经进入可视化页面，显示加载页面
    const isInVisualization = entered && !isLanding;
    if (isInVisualization) {
      setShowLoadingPage(true);
      setLoadingPageData({
        artists: [...selectedArtists, artist].map((a, idx) => ({
          name: artistDetails[a.id]?.name || a.name,
          status: idx === selectedArtists.length ? "processing" : "done",
        })),
        currentArtist: artist.name,
        progress: 30,
        status: `正在抓取 ${artist.name}...`,
      });
    }

    setLoading(true);
    setSelectedArtists((prev) => [...prev, artist]);
    setShowResults(false);
    setKeyword("");

    // 先用搜索结果构建基本信息
    setArtistDetails((prev) => ({
      ...prev,
      [artist.id]: {
        id: artist.id,
        name: artist.name,
        avatar_url: artist.avatar_url || "",
        followers: artist.followers || 0,
        description: artist.brief_desc || "",
        song_count: artist.music_size || 0,
        total_plays: 0,
        total_comments: 0,
        styles: (artist.identity || []).map((i) => ({ name: i.showName || i })),
      },
    }));

    // 异步抓取详情
    try {
      const detail = await api.crawlArtist(artist.id);
      if (detail) {
        setArtistDetails((prev) => ({
          ...prev,
          [artist.id]: {
            ...prev[artist.id],
            name: detail.name || prev[artist.id].name,
            avatar_url: detail.avatar_url || prev[artist.id].avatar_url,
            followers: detail.followers || 0,
            description: detail.brief_desc || "",
            song_count: detail.music_size || prev[artist.id].song_count,
            album_size: detail.album_size || 0,
            avg_pop: prev[artist.id].avg_pop || 0,
            max_pop: prev[artist.id].max_pop || 0,
          },
        }));
        // 自动填充地区信息
        if (detail.region) {
          updateRegion(artist.id, detail.region);
        }
      }
    } catch {
      // 抓取失败，尝试本地数据库
      try {
        const detail = await api.getArtistDetail(artist.id);
        setArtistDetails((prev) => ({
          ...prev,
          [artist.id]: {
            ...prev[artist.id],
            ...detail,
          },
        }));
        // 自动填充地区信息
        if (detail.region) {
          updateRegion(artist.id, detail.region);
        }
      } catch { }
    }

    // 加载热度数据
    try {
      const pop = await api.getArtistPopularity(artist.id);
      setArtistDetails((prev) => ({
        ...prev,
        [artist.id]: {
          ...prev[artist.id],
          avg_pop: pop.avg_pop || prev[artist.id].avg_pop,
          max_pop: pop.max_pop || prev[artist.id].max_pop,
        },
      }));
    } catch { }

    // 如果在可视化页面，获取图表数据
    if (isInVisualization) {
      // 标记歌手抓取完成
      setLoadingPageData((prev) => ({
        ...prev,
        artists: prev.artists.map((a) => ({ ...a, status: "done" })),
        status: "正在分析数据...",
        progress: 90,
      }));

      // 获取图表数据
      const data = await api.getCompareCharts(
        [...selectedArtists, artist].map((a) => a.id),
      );
      setCompareData(data);

      // 隐藏loading页面
      setShowLoadingPage(false);

      // 完成后
      setLoadingPageData((prev) => ({
        ...prev,
        progress: 100,
        status: "加载完成!",
      }));
    }

    setLoading(false);
  };

  const removeArtist = async (id) => {
    const remaining = selectedArtists.filter((a) => a.id !== id);

    setSelectedArtists(remaining);
    setArtistDetails((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    // 删除歌手后刷新整个页面
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  // ==================== 搜索下拉组件 ====================
  const SearchDropdown = () => (
    <div className="search-results">
      {searchResults.length === 0 ? (
        <div className="search-no-result">未找到相关歌手</div>
      ) : (
        searchResults.slice(0, 10).map((a) => {
          const selected = selectedArtists.find((s) => s.id === a.id);
          const full = selectedArtists.length >= MAX_ARTISTS;
          return (
            <div
              key={a.id}
              className={`search-result-item ${selected || full ? "search-result-disabled" : ""}`}
              onClick={() => !selected && !full && selectArtist(a)}
            >
              <img
                className="search-avatar"
                src={
                  a.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=ec4141&color=fff&size=80`
                }
                alt={a.name}
              />
              <div>
                <div className="search-name">
                  {a.name}
                  {selected && <span className="search-added"> ✓ 已选</span>}
                  {full && !selected && (
                    <span className="search-full"> (已满{MAX_ARTISTS}位)</span>
                  )}
                </div>
                <div className="search-followers">
                  {a.music_size > 0 ? `${a.music_size} 首歌` : ""}
                  {a.album_size > 0 ? ` · ${a.album_size} 张专辑` : ""}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ==================== Panel 组件 ====================
  const Panel = ({ icon, title, children, className, bodyClassName }) => (
    <div className={`panel ${className || ""}`}>
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-title-icon">{icon}</span>
          {title}
        </span>
      </div>
      <div className={`panel-body ${bodyClassName || ""}`}>{children}</div>
    </div>
  );

  return (
    <div className="app">
      {/* 整体加载页面 */}
      {showLoadingPage && (
        <LoadingPage
          artists={loadingPageData.artists}
          currentArtist={loadingPageData.currentArtist}
          progress={loadingPageData.progress}
          status={loadingPageData.status}
        />
      )}

      {/* ====== Header ====== */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">♪</div>
            <span className="logo-text">MusicViz</span>
          </div>
          {!isLanding && (
            <>
              <div className="header-divider" />
              <span className="header-subtitle">歌手数据可视化大屏</span>
            </>
          )}
        </div>
        <div className="header-right">
          {!isLanding && (
            <div
              className={`search-container${searchActive ? " search-spotlight" : ""}`}
              ref={searchRef}
            >
              <span className="search-icon">🔍</span>
              <input
                className="search-input"
                type="text"
                placeholder="添加歌手对比..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                onBlur={() => setTimeout(() => setSearchActive(false), 200)}
                onKeyDown={(e) => e.key === "Escape" && setSearchActive(false)}
              />
              {showResults && <SearchDropdown />}
            </div>
          )}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* ====== 搜索页 ====== */}
      {isLanding && (
        <div className="landing-page">
          <div className="landing-content">
            <div className="landing-logo">
              <div className="landing-icon">♪</div>
              <h1>MusicViz</h1>
              <p>网易云音乐 · 歌手数据可视化大屏</p>
              <p className="landing-hint">
                搜索歌手名称，可选最多 {MAX_ARTISTS} 位进行对比
              </p>
            </div>
            <div className="landing-search" ref={landingRef}>
              <span className="landing-search-icon">🔍</span>
              <input
                className="landing-search-input"
                type="text"
                placeholder="搜索歌手名称..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                autoFocus
              />
              {showResults && (
                <div className="search-results landing-results">
                  {searchResults.length === 0 ? (
                    <div className="search-no-result">未找到相关歌手</div>
                  ) : (
                    searchResults.slice(0, 8).map((a) => {
                      const selected = selectedArtists.find(
                        (s) => s.id === a.id,
                      );
                      const full = selectedArtists.length >= MAX_ARTISTS;
                      return (
                        <div
                          key={a.id}
                          className={`search-result-item ${selected || full ? "search-result-disabled" : ""}`}
                          onClick={() => !selected && !full && selectArtist(a)}
                        >
                          <img
                            className="search-avatar"
                            src={
                              a.avatar_url ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=ec4141&color=fff&size=80`
                            }
                            alt={a.name}
                          />
                          <div>
                            <div className="search-name">
                              {a.name}
                              {selected && (
                                <span className="search-added"> ✓ 已选</span>
                              )}
                            </div>
                            <div className="search-followers">
                              {a.music_size > 0 ? `${a.music_size} 首歌` : ""}
                              {a.album_size > 0
                                ? ` · ${a.album_size} 张专辑`
                                : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* 已选歌手标签 */}
            {selectedArtists.length > 0 && (
              <div className="landing-tags">
                {selectedArtists.map((a) => (
                  <span
                    key={a.id}
                    className="landing-tag"
                    onClick={() => removeArtist(a.id)}
                  >
                    <img
                      className="landing-tag-avatar"
                      src={
                        a.avatar_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(a.name)}&background=666&color=fff&size=40`
                      }
                      alt=""
                    />
                    {a.name} ✕
                  </span>
                ))}
                {selectedArtists.length > 0 && (
                  <button
                    className="landing-go-btn"
                    onClick={handleEnterVisualization}
                  >
                    进入可视化 →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====== 可视化大屏 ====== */}
      {!isLanding && (
        <>
          {/* 已选歌手横条 */}
          <div className="artist-bar">
            {selectedArtists.map((a) => {
              const d = artistDetails[a.id] || {};
              return (
                <div key={a.id} className="artist-bar-wrapper">
                  <div className="artist-bar-card">
                    <img
                      className="artist-bar-avatar"
                      src={
                        d.avatar_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=ec4141&color=fff&size=80`
                      }
                      alt={d.name}
                    />
                    <div className="artist-bar-info">
                      <div className="artist-bar-name">{d.name}</div>
                      <div className="artist-bar-stats">
                        <span>🎵 {d.song_count || 0} 首</span>
                        {d.followers > 1000 && (
                          <span>👤 {formatLargeNumber(d.followers)}</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="artist-bar-remove"
                      onClick={() => removeArtist(a.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
            {selectedArtists.length < MAX_ARTISTS && (
              <div
                className="artist-bar-add"
                onClick={() => {
                  const input = document.querySelector(".search-input");
                  if (input) {
                    setSearchActive(true);
                    setTimeout(() => input.focus(), 100);
                  }
                }}
              >
                ＋ 添加歌手
              </div>
            )}
          </div>

          {searchActive && (
            <div
              className="search-backdrop"
              onClick={() => setSearchActive(false)}
            />
          )}

          {/* 歌手数据对比表 */}
          <div className="compare-section">
            <h3 className="compare-title">📊 乐评人 · 歌手数据对比</h3>
            <div className="compare-grid">
              {selectedArtists.map((a) => {
                const d = artistDetails[a.id] || {};
                const maxSong = Math.max(
                  ...selectedArtists.map(
                    (x) => artistDetails[x.id]?.song_count || 0,
                  ),
                  1,
                );
                const maxAlbum = Math.max(
                  ...selectedArtists.map(
                    (x) => artistDetails[x.id]?.album_size || 0,
                  ),
                  1,
                );
                // avg_pop / max_pop 是 0-100 评分，用绝对满分
                return (
                  <div key={a.id} className="compare-card">
                    <div className="compare-card-header">
                      <img
                        className="compare-avatar"
                        src={
                          d.avatar_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=ec4141&color=fff&size=80`
                        }
                        alt={d.name}
                      />
                      <span className="compare-name">{d.name}</span>
                    </div>
                    <div className="compare-metrics">
                      <div className="compare-metric">
                        <span className="metric-label">🎵 歌曲</span>
                        <span className="metric-value">
                          {d.song_count || 0}
                        </span>
                        <div className="metric-bar">
                          <div
                            className="metric-fill"
                            style={{
                              width: `${((d.song_count || 0) / maxSong) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="compare-metric">
                        <span className="metric-label">💿 专辑</span>
                        <span className="metric-value">
                          {d.album_size || 0}
                        </span>
                        <div className="metric-bar">
                          <div
                            className="metric-fill fill-blue"
                            style={{
                              width: `${((d.album_size || 0) / maxAlbum) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="compare-metric">
                        <span className="metric-label">🔥 平均热度</span>
                        <span className="metric-value">{d.avg_pop || 0}</span>
                        <div className="metric-bar">
                          <div
                            className="metric-fill fill-orange"
                            style={{
                              width: `${d.avg_pop || 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* 相似歌手 */}
                    {(similarArtists[a.id] || []).length > 0 && (
                      <div className="compare-similar">
                        <div className="compare-similar-label">相似歌手</div>
                        <div className="compare-similar-list">
                          {(similarArtists[a.id] || []).slice(0, 6).map((sim) => (
                            <a
                              key={sim.similar_artist_id}
                              href={`https://music.163.com/#/artist?id=${sim.similar_artist_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="compare-similar-chip"
                              onClick={(e) => {
                                e.preventDefault();
                                if (selectedArtists.length < MAX_ARTISTS &&
                                  !selectedArtists.find(x => x.id === sim.similar_artist_id)) {
                                  selectArtist({
                                    id: sim.similar_artist_id,
                                    name: sim.name,
                                    avatar_url: sim.avatar_url,
                                  });
                                }
                              }}
                              title={sim.name}
                            >
                              <img
                                className="compare-similar-avatar"
                                src={sim.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sim.name)}&background=666&color=fff&size=32`}
                                alt=""
                              />
                              <span className="compare-similar-name">{sim.name}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 歌手简介卡片 */}
          <div className="artist-info-section">
            <h3 className="section-title">📝 歌手简介</h3>
            <div className="artist-info-grid">
              {selectedArtists.map((a) => {
                const desc = artistDescs[a.id];
                const topSongs = artistTopSongs[a.id] || [];
                const d = artistDetails[a.id] || {};
                // 使用 artistDetails 中的 description 作为简介
                const briefDesc = d.description || "";
                // 使用统一的状态管理，避免在循环中使用 useState
                const isExpanded = expandedArtists[a.id] || false;
                const hasMore = (briefDesc && briefDesc.length > 100) ||
                  (desc?.introduction?.length > 0) ||
                  topSongs.length > 0;

                const toggleExpand = () => {
                  setExpandedArtists((prev) => ({
                    ...prev,
                    [a.id]: !prev[a.id]
                  }));
                };

                return (
                  <div key={a.id} className="artist-info-card">
                    <div className="artist-info-header">
                      <img
                        className="artist-info-avatar"
                        src={d.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(d.name)}&background=ec4141&color=fff&size=60`}
                        alt={d.name}
                      />
                      <div className="artist-info-title">
                        <span className="artist-info-name">{d.name}</span>
                        {d.followers > 0 && (
                          <span className="artist-info-followers">
                            👤 {formatLargeNumber(d.followers)} 粉丝
                          </span>
                        )}
                      </div>
                      {hasMore && (
                        <button
                          className="artist-info-toggle"
                          onClick={toggleExpand}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      )}
                    </div>

                    {/* 歌手描述 - 折叠显示 */}
                    {briefDesc && (
                      <div className={`artist-brief ${isExpanded ? '' : 'collapsed'}`}>
                        <p>{briefDesc}</p>
                      </div>
                    )}

                    {/* 展开内容 */}
                    {isExpanded && (
                      <div className="artist-expanded-content">
                        {/* 主要成就 */}
                        {desc?.introduction?.length > 0 && (
                          <div className="artist-achievements">
                            {desc.introduction.slice(0, 2).map((intro, idx) => (
                              <div key={idx} className="achievement-item">
                                <div className="achievement-title">{intro.ti}</div>
                                <div className="achievement-content">
                                  {intro.txt.split('\n').slice(0, 5).map((line, i) => (
                                    <span key={i} className="achievement-line">{line}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 热门歌曲 */}
                        {topSongs.length > 0 && (
                          <div className="artist-top-songs">
                            <div className="top-songs-title">🎵 热门歌曲</div>
                            <div className="top-songs-list">
                              {topSongs.slice(0, 5).map((song, idx) => (
                                <div key={song.id} className="top-song-item">
                                  <span className="top-song-rank">{idx + 1}</span>
                                  <span className="top-song-name">{song.name}</span>
                                  <span className="top-song-pop">🔥 {song.popularity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 热搜榜 */}
          {hotSearch.length > 0 && (
            <div className="hot-search-section">
              <h3 className="section-title">🔥 实时热搜榜</h3>
              <div className="hot-search-grid">
                {hotSearch.map((item, idx) => (
                  <div key={idx} className="hot-search-item">
                    <span className={`hot-search-rank rank-${idx + 1}`}>{idx + 1}</span>
                    <span className="hot-search-word">{item.searchWord}</span>
                    {item.score > 0 && (
                      <span className="hot-search-score">
                        {item.score > 10000 ? `${(item.score / 10000).toFixed(1)}万` : item.score}
                      </span>
                    )}
                    {item.iconType === 1 && <span className="hot-search-tag hot">热</span>}
                    {item.iconType === 2 && <span className="hot-search-tag new">新</span>}
                    {item.iconType === 3 && <span className="hot-search-tag recommend">荐</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chart Grid — 基于爬虫数据的对比图表 */}
          <div
            className={`main-grid ${dragOverPanelId === 'grid' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'grid')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'grid')}
          >
            {/* 雷达图 */}
            {panelOrder.includes(CHART_TYPES.RADAR) && (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, CHART_TYPES.RADAR)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, CHART_TYPES.RADAR)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, CHART_TYPES.RADAR)}
                className={`panel ${dragOverPanelId === CHART_TYPES.RADAR ? 'drag-over' : ''} ${activePanelId === CHART_TYPES.RADAR ? 'dragging' : ''}`}
              >
                <div className="panel-header">
                  <span className="panel-title">📋 多歌手指标对比 (雷达图)</span>
                  <button
                    className="panel-remove-btn"
                    onClick={() => handleRemoveFromGrid(CHART_TYPES.RADAR)}
                    title="从布局移除"
                  >
                    ×
                  </button>
                </div>
                <div className="panel-body">
                  {compareData?.radar?.length > 0 ? (
                    <RadarChart data={compareData.radar} />
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">📋</div>
                      <p>暂无数据</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Top10 歌曲评论数排名 */}
            {panelOrder.includes(CHART_TYPES.RANKING) && (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, CHART_TYPES.RANKING)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, CHART_TYPES.RANKING)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, CHART_TYPES.RANKING)}
                className={`panel ${dragOverPanelId === CHART_TYPES.RANKING ? 'drag-over' : ''} ${activePanelId === CHART_TYPES.RANKING ? 'dragging' : ''}`}
              >
                <div className="panel-header">
                  <span className="panel-title">🔥 Top10 歌曲评论数排名</span>
                  <button
                    className="panel-remove-btn"
                    onClick={() => handleRemoveFromGrid(CHART_TYPES.RANKING)}
                    title="从布局移除"
                  >
                    ×
                  </button>
                </div>
                <div className="panel-body">
                  {compareData?.all_top50?.length > 0 ? (
                    <RankingChart
                      data={compareData.all_top50.slice(0, 10).map((s, i) => ({
                        rank: i + 1,
                        name: s.name,
                        plays: s.comments,
                        comments: s.comments,
                        artist_name:
                          compareData.artists.find((a) => a.id === s.artist_id)
                            ?.name || "",
                      }))}
                    />
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">🏆</div>
                      <p>暂无数据</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 歌词词云 */}
            {panelOrder.includes(CHART_TYPES.LYRIC_WORDCLOUD) && (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, CHART_TYPES.LYRIC_WORDCLOUD)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, CHART_TYPES.LYRIC_WORDCLOUD)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, CHART_TYPES.LYRIC_WORDCLOUD)}
                className={`panel grid-col-span-2 ${dragOverPanelId === CHART_TYPES.LYRIC_WORDCLOUD ? 'drag-over' : ''} ${activePanelId === CHART_TYPES.LYRIC_WORDCLOUD ? 'dragging' : ''}`}
              >
                <div className="panel-header">
                  <span className="panel-title">☁️ Top10歌曲歌词词云</span>
                  <button
                    className="panel-remove-btn"
                    onClick={() => handleRemoveFromGrid(CHART_TYPES.LYRIC_WORDCLOUD)}
                    title="从布局移除"
                  >
                    ×
                  </button>
                </div>
                <div className="panel-body">
                  {lyricWordCloudData?.words?.length > 0 ? (
                    <LyricWordCloud data={lyricWordCloudData} />
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">☁️</div>
                      <p>暂无歌词数据</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/*
            <Panel icon="🥧" title="歌曲年代分布占比">
              {compareData?.era_pie?.length > 0 ? (
                <PieChart data={compareData.era_pie} />
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🥧</div>
                  <p>暂无数据</p>
                </div>
              )}
            </Panel>
*/}

            {/*
            <Panel icon="📈" title="各歌手年代趋势">
              {compareData?.artists?.length > 0 ? (
                <LineChart
                  data={compareData.artists.flatMap((a) =>
                    (a.yearly_trend || []).map((y) => ({
                      name: y.year.toString(),
                      value: y.count,
                      artist: a.name,
                    })),
                  )}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📈</div>
                  <p>暂无数据</p>
                </div>
              )}
            </Panel>
            */}

            {/*
            <Panel icon="📊" title="歌手核心指标分组对比">
              {compareData?.artists?.length > 0 ? (
                <GroupedBarChart
                  data={compareData.artists.map((a) => ({
                    name: a.name,
                    songs: a.song_count,
                    albums: a.album_size,
                    avg_pop: a.avg_pop,
                  }))}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📊</div>
                  <p>暂无数据</p>
                </div>
              )}
            </Panel>
            */}

            {/*
            <Panel icon="🎯" title="歌曲数 vs 专辑数 (散点图)">
              {compareData?.artists?.length > 1 ? (
                <ScatterChart
                  data={compareData.artists.map((a) => ({
                    name: a.name,
                    x: a.song_count,
                    y: a.album_size,
                  }))}
                />
              ) : compareData?.artists?.length === 1 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎯</div>
                  <p>至少需要2位歌手才能展示散点对比</p>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🎯</div>
                  <p>暂无数据</p>
                </div>
              )}
            </Panel>
            */}

            {/*
            <Panel icon="🔥" title="热歌榜 Top20">
              {hotSongs.length > 0 ? (
                <BarChart
                  data={hotSongs.slice(0, 20).map((s, i) => ({
                    rank: i + 1,
                    name:
                      (s.name || "").length > 10
                        ? s.name.slice(0, 10) + "..."
                        : s.name,
                    plays: s.popularity || 0,
                    artist_name: Array.isArray(s.artists)
                      ? s.artists.map((a) => a.name).join("/")
                      : "",
                  }))}
                />
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🔥</div>
                  <p>正在加载热歌榜...</p>
                </div>
              )}
            </Panel>

            <Panel
              icon="🎯"
              title="歌曲数 × 热度 (气泡图)"
              className="grid-col-span-2"
            >
              {compareData?.artists?.length > 1 ? (
                <BubbleChart
                  data={compareData.artists.map((a) => ({
                    name: a.name,
                    x: a.song_count,
                    y: a.avg_pop,
                    z: a.album_size,
                  }))}
                />
              ) : compareData?.artists?.length === 1 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🎯</div>
                  <p>至少需要2位歌手</p>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">🎯</div>
                  <p>暂无数据</p>
                </div>
              )}
            </Panel>
            */}

            {/* 歌手归属地热力地图 */}
            {panelOrder.includes(CHART_TYPES.MAP) && (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, CHART_TYPES.MAP)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, CHART_TYPES.MAP)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, CHART_TYPES.MAP)}
                className={`panel grid-col-span-3 ${dragOverPanelId === CHART_TYPES.MAP ? 'drag-over' : ''} ${activePanelId === CHART_TYPES.MAP ? 'dragging' : ''}`}
              >
                <div className="panel-header">
                  <span className="panel-title">🗺️ 歌手归属地热力地图</span>
                  <button
                    className="panel-remove-btn"
                    onClick={() => handleRemoveFromGrid(CHART_TYPES.MAP)}
                    title="从布局移除"
                  >
                    ×
                  </button>
                </div>
                <div className="panel-body">
                  {selectedArtists.length > 0 ? (
                    <MapChart
                      artists={
                        compareData?.artists ||
                        selectedArtists.map((a) => ({
                          ...a,
                          avg_pop: 0,
                          song_count: artistDetails[a.id]?.song_count || 0,
                        }))
                      }
                      regionMap={regionMap}
                      onUpdateRegion={updateRegion}
                    />
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">🗺️</div>
                      <p>选择歌手后展示地区分布</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 评论情感分析 */}
            {panelOrder.includes(CHART_TYPES.SENTIMENT) && (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, CHART_TYPES.SENTIMENT)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, CHART_TYPES.SENTIMENT)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, CHART_TYPES.SENTIMENT)}
                className={`panel ${dragOverPanelId === CHART_TYPES.SENTIMENT ? 'drag-over' : ''} ${activePanelId === CHART_TYPES.SENTIMENT ? 'dragging' : ''}`}
              >
                <div className="panel-header">
                  <span className="panel-title">😊 评论情感分析</span>
                  <button
                    className="panel-remove-btn"
                    onClick={() => handleRemoveFromGrid(CHART_TYPES.SENTIMENT)}
                    title="从布局移除"
                  >
                    ×
                  </button>
                </div>
                <div className="panel-body panel-body-tall">
                  <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <label style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                      display: 'block'
                    }}>
                      选择分析歌曲
                    </label>
                    <select
                      value={analysisSong?.id || ''}
                      onChange={(e) => {
                        const allSongs = selectedArtists.flatMap(a =>
                          (artistTopSongs[a.id] || []).map(s => ({ ...s, artistName: a.name }))
                        );
                        const selected = allSongs.find(s => s.id === parseInt(e.target.value));
                        if (selected) {
                          setAnalysisSong({
                            id: selected.id,
                            name: selected.name,
                            artist: selected.artistName
                          });
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {selectedArtists.map(a => {
                        const songs = artistTopSongs[a.id] || [];
                        if (songs.length === 0) return null;
                        return (
                          <optgroup key={a.id} label={`🎵 ${a.name} 的热门歌曲`}>
                            {songs.slice(0, 5).map(song => (
                              <option key={song.id} value={song.id}>
                                {song.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <SentimentAnalysisCard
                    songId={analysisSong?.id || ''}
                    songName={analysisSong ? `${analysisSong.name} - ${analysisSong.artist}` : ''}
                  />
                </div>
              </div>
            )}

            {/* 评论主题聚类 */}
            {panelOrder.includes(CHART_TYPES.TOPIC) && (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, CHART_TYPES.TOPIC)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, CHART_TYPES.TOPIC)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, CHART_TYPES.TOPIC)}
                className={`panel grid-col-span-2 ${dragOverPanelId === CHART_TYPES.TOPIC ? 'drag-over' : ''} ${activePanelId === CHART_TYPES.TOPIC ? 'dragging' : ''}`}
              >
                <div className="panel-header">
                  <span className="panel-title">🏷️ 评论主题聚类</span>
                  <button
                    className="panel-remove-btn"
                    onClick={() => handleRemoveFromGrid(CHART_TYPES.TOPIC)}
                    title="从布局移除"
                  >
                    ×
                  </button>
                </div>
                <div className="panel-body panel-body-tall">
                  <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <label style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      marginBottom: '8px',
                      display: 'block'
                    }}>
                      选择分析歌曲
                    </label>
                    <select
                      value={analysisSong?.id || ''}
                      onChange={(e) => {
                        const allSongs = selectedArtists.flatMap(a =>
                          (artistTopSongs[a.id] || []).map(s => ({ ...s, artistName: a.name }))
                        );
                        const selected = allSongs.find(s => s.id === parseInt(e.target.value));
                        if (selected) {
                          setAnalysisSong({
                            id: selected.id,
                            name: selected.name,
                            artist: selected.artistName
                          });
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {selectedArtists.map(a => {
                        const songs = artistTopSongs[a.id] || [];
                        if (songs.length === 0) return null;
                        return (
                          <optgroup key={a.id} label={`🎵 ${a.name} 的热门歌曲`}>
                            {songs.slice(0, 5).map(song => (
                              <option key={song.id} value={song.id}>
                                {song.name}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                  <TopicClusterCard
                    songId={analysisSong?.id || ''}
                    songName={analysisSong ? `${analysisSong.name} - ${analysisSong.artist}` : ''}
                  />
                </div>
              </div>
            )}
          </div>

          <footer className="footer">
            网易云音乐歌手数据可视化大屏 · Music Dashboard © 2024
          </footer>

          {/* 图表拖拽菜单 */}
          <ChartMenu
            isMenuOpen={isMenuOpen}
            onToggleMenu={() => setIsMenuOpen(!isMenuOpen)}
            activePanelId={activePanelId}
            panelOrder={panelOrder}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onAddToGrid={handleAddFromMenu}
            onRemoveFromGrid={handleRemoveFromGrid}
            onResetLayout={handleResetLayout}
          />
        </>
      )}
    </div>
  );
}
