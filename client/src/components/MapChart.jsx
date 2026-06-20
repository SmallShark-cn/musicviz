import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

const KNOWN_REGIONS = {
  6452: "中国台湾",
  2116: "中国香港",
  7763: "中国香港",
  3684: "新加坡",
  9272: "新加坡",
  7219: "中国台湾",
  5346: "中国台湾",
};

const REGION_GROUPS = {
  "🇨🇳 中国": [
    "中国北京",
    "中国上海",
    "中国广州",
    "中国深圳",
    "中国浙江",
    "中国江苏",
    "中国台湾",
    "中国香港",
    "中国澳门",
  ],
  "🌏 亚洲": [
    "日本",
    "韩国",
    "新加坡",
    "马来西亚",
    "印度尼西亚",
    "泰国",
    "越南",
    "印度",
    "菲律宾",
    "阿联酋",
    "沙特阿拉伯",
    "土耳其",
  ],
  "🌍 欧洲": [
    "英国",
    "法国",
    "德国",
    "意大利",
    "西班牙",
    "荷兰",
    "瑞士",
    "瑞典",
    "挪威",
    "俄罗斯",
    "爱尔兰",
    "葡萄牙",
    "希腊",
    "波兰",
  ],
  "🌎 美洲": [
    "美国",
    "加拿大",
    "巴西",
    "墨西哥",
    "阿根廷",
    "哥伦比亚",
    "智利",
    "秘鲁",
  ],
  "🌏 大洋洲": ["澳大利亚", "新西兰"],
  "🌍 非洲": ["南非", "尼日利亚", "埃及", "肯尼亚"],
};

const REGION_COORDS = {
  中国北京: [116.4, 39.9],
  中国上海: [121.5, 31.2],
  中国广州: [113.3, 23.1],
  中国深圳: [114.1, 22.5],
  中国浙江: [120.2, 30.3],
  中国江苏: [118.8, 32.1],
  中国台湾: [121, 25],
  中国香港: [114.2, 22.3],
  中国澳门: [113.5, 22.2],
  日本: [138, 37],
  韩国: [127, 37],
  新加坡: [103.8, 1.35],
  马来西亚: [101.7, 3.1],
  印度尼西亚: [114, -2],
  泰国: [100.5, 15.9],
  越南: [108, 14],
  印度: [79, 21],
  菲律宾: [122, 13],
  阿联酋: [54, 24],
  沙特阿拉伯: [45, 24],
  土耳其: [35, 39],
  英国: [-3, 55],
  法国: [2, 47],
  德国: [10, 51],
  意大利: [12, 42],
  西班牙: [-4, 40],
  荷兰: [5, 52],
  瑞士: [8, 47],
  瑞典: [18, 62],
  挪威: [10, 65],
  俄罗斯: [105, 62],
  爱尔兰: [-8, 53],
  葡萄牙: [-8, 39],
  希腊: [22, 39],
  波兰: [19, 52],
  美国: [-100, 39],
  加拿大: [-106, 56],
  巴西: [-53, -14],
  墨西哥: [-99, 24],
  阿根廷: [-64, -38],
  哥伦比亚: [-74, 4],
  智利: [-71, -30],
  秘鲁: [-76, -10],
  澳大利亚: [134, -25],
  新西兰: [175, -41],
  南非: [25, -30],
  尼日利亚: [8, 9],
  埃及: [30, 26],
  肯尼亚: [38, 0],
};

export default function MapChart({ artists, regionMap, onUpdateRegion }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const inited = useRef(false);

  useEffect(() => {
    if (!ref.current || inited.current) return;
    inited.current = true;

    const container = ref.current;
    let chart = null;
    let mounted = true;

    fetch("/static/world.json")
      .then((r) => r.json())
      .then((worldJson) => {
        if (!mounted) return;
        try {
          echarts.registerMap("world", worldJson);
          chart = echarts.init(
            container,
            theme === "dark" ? "dark" : undefined,
          );
          renderChart(chart, artists, regionMap, theme);
        } catch (e) {
          console.error("Map render error:", e);
        }
      })
      .catch(() => {
        if (!mounted) return;
        container.innerHTML = `<div style="padding:60px;text-align:center;color:#9095a8;font-size:14px">🌍 世界地图加载失败</div>`;
      });

    const resize = () => chart && chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", resize);
      if (chart) chart.dispose();
    };
  }, []); // 只初始化一次

  // artists/regionMap/theme 变化时更新
  useEffect(() => {
    if (!ref.current.chart) return;
    try {
      renderChart(ref.current.chart, artists, regionMap, theme);
    } catch (e) {
      console.error("Map update error:", e);
    }
  }, [artists, regionMap, theme]);

  return (
    <div className="map-wrap">
      <div ref={ref} style={{ width: "100%", height: "450px" }} />
      <div
        className="map-tip"
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "var(--text-muted)",
          padding: "6px 0 2px",
          opacity: 0.7,
        }}
      >
        🖱️ 滚轮缩放 · 拖拽平移 · 悬停查看详情
      </div>
      {artists?.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "center",
            padding: "12px 0 0",
            borderTop: "1px solid var(--border-color)",
            marginTop: 8,
          }}
        >
          {artists.map((a) => {
            const current = regionMap[a.id] || KNOWN_REGIONS[a.id] || "";
            return (
              <div
                key={a.id}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {a.name}
                </span>
                <select
                  style={{
                    fontSize: 12,
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    outline: "none",
                  }}
                  value={current}
                  onChange={(e) => onUpdateRegion(a.id, e.target.value)}
                >
                  <option value="">— 选择地区 —</option>
                  {Object.entries(REGION_GROUPS).map(([g, rs]) => (
                    <optgroup key={g} label={g}>
                      {rs.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function renderChart(chart, artists, regionMap, theme) {
  const mapData = (artists || [])
    .map((a) => {
      const region = regionMap[a.id] || KNOWN_REGIONS[a.id] || "";
      const coords = REGION_COORDS[region];
      if (!coords) return null;
      return {
        name: a.name,
        value: [
          ...coords,
          a.avg_pop || 50,
          a.song_count || 0,
          a.album_size || 0,
        ],
        region,
      };
    })
    .filter(Boolean);
  const isDark = theme === "dark";

  chart.setOption(
    {
      tooltip: {
        trigger: "item",
        formatter: (p) =>
          p.componentType === "series"
            ? `<b style="font-size:14px">${p.data.name}</b><br/>📍 ${p.data.region}<br/>🔥 热度: ${p.data.value[2]}<br/>🎵 歌曲: ${p.data.value[3]}首<br/>💿 专辑: ${p.data.value[4]}张`
            : p.name,
      },
      geo: {
        map: "world",
        roam: true,
        zoom: 1,
        center: [15, 20],
        label: { show: false },
        itemStyle: {
          areaColor: isDark ? "#1a2332" : "#e8edf3",
          borderColor: isDark ? "#2a3a52" : "#bcc8d8",
          borderWidth: 1,
        },
        emphasis: { itemStyle: { areaColor: isDark ? "#2a3a52" : "#d4dce8" } },
      },
      series:
        mapData.length > 0
          ? [
              {
                type: "scatter",
                coordinateSystem: "geo",
                data: mapData,
                symbolSize: (v) =>
                  Math.max(20, Math.min(50, (v[3] || 10) + 14)),
                label: {
                  show: true,
                  formatter: (p) => p.name,
                  position: "right",
                  color: isDark ? "#e8eaed" : "#1a1a2e",
                  fontSize: 12,
                  fontWeight: "bold",
                  backgroundColor: isDark
                    ? "rgba(10,14,23,0.75)"
                    : "rgba(255,255,255,0.85)",
                  padding: [3, 8],
                  borderRadius: 6,
                  shadowBlur: 4,
                  shadowColor: "rgba(0,0,0,0.15)",
                },
                emphasis: { scale: 1.4, label: { fontSize: 14 } },
                itemStyle: {
                  color: new echarts.graphic.RadialGradient(0.4, 0.3, 1, [
                    { offset: 0, color: "#ff6b6b" },
                    { offset: 1, color: "rgba(236,65,65,0.7)" },
                  ]),
                  borderColor: "#fff",
                  borderWidth: 2,
                  shadowBlur: 10,
                  shadowColor: "rgba(236,65,65,0.5)",
                },
              },
            ]
          : [],
    },
    true,
  );
}
