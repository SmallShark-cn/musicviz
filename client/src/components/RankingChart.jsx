import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

export default function RankingChart({ data }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.length) return;
    if (chartRef.current) chartRef.current.dispose();
    chartRef.current = echarts.init(
      ref.current,
      theme === "dark" ? "dark" : undefined,
    );

    const rankedData = [...data].sort((a, b) => b.plays - a.plays);
    // y轴使用富文本：歌曲名在上，歌手名在下（字体小、透明度低）
    const names = rankedData
      .map((d) => {
        const song = d.name?.length > 10 ? d.name.slice(0, 10) + "..." : d.name;
        const artist = d.artist_name || "";
        return [song, artist];
      })
      .reverse();
    const values = rankedData.map((d) => d.plays).reverse();
    const comments = rankedData.map((d) => d.comments || 0).reverse();

    const maxValue = Math.max(...values);

    // 格式化大数字
    const formatNumber = (num) => {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
      if (num >= 1000) return (num / 1000).toFixed(0) + "K";
      return num.toString();
    };

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (p) => {
            const idx = rankedData.length - 1 - p[0].dataIndex;
            const d = rankedData[idx];
            return `#${idx + 1} ${d.artist_name || ""} - ${d.name}<br/>` +
              `评论数: ${(d.comments || 0).toLocaleString()}`;
          },
        },
        grid: { left: 120, right: 60, top: 15, bottom: 35 },
        xAxis: {
          type: "value",
          max: maxValue * 1.1,
          axisLabel: {
            formatter: (v) => formatNumber(v),
            fontSize: 10,
          },
          splitLine: { lineStyle: { color: "rgba(0,0,0,0.05)" } },
        },
        yAxis: {
          type: "category",
          data: names,
          axisLabel: {
            fontSize: 11,
            color: (value, index) => {
              const originalIndex = rankedData.length - 1 - index;
              if (originalIndex === 0) return "#ffd700";
              if (originalIndex === 1) return "#c0c0c0";
              if (originalIndex === 2) return "#cd7f32";
              return theme === "dark" ? "#aaa" : "#666";
            },
            formatter: (value, index) => {
              const [song, artist] = names[index];
              const originalIndex = rankedData.length - 1 - index;
              const rank = ["🥇", "🥈", "🥉"][originalIndex];
              const rankPrefix = rank ? `${rank} ` : "";
              // 上下排列：歌曲名在上，歌手名在下
              return `{title|${rankPrefix}${song}}\n{sub|${artist}}`;
            },
            rich: {
              title: {
                fontSize: 11,
                fontWeight: "normal",
                lineHeight: 14,
              },
              sub: {
                fontSize: 9,
                color: theme === "dark" ? "rgba(170,170,170,0.5)" : "rgba(100,100,100,0.5)",
                lineHeight: 12,
              },
            },
          },
          axisTick: { show: false },
          axisLine: { show: false },
        },
        series: [
          {
            type: "bar",
            data: values.map((v, i) => ({
              value: v,
              itemStyle: {
                borderRadius: [0, 4, 4, 0],
                color: new echarts.graphic.LinearGradient(
                  0, 0, 1, 0,
                  [
                    { offset: 0, color: i === rankedData.length - 1 ? "#ffd700" : i === rankedData.length - 2 ? "#c0c0c0" : i === rankedData.length - 3 ? "#cd7f32" : "#ec4141" },
                    { offset: 1, color: i === rankedData.length - 1 ? "#ffb700" : i === rankedData.length - 2 ? "#a0a0a0" : i === rankedData.length - 3 ? "#ad5f12" : "#ff6b6b" },
                  ],
                ),
              },
            })),
            barWidth: 18,
            label: {
              show: true,
              position: "right",
              formatter: (p) => {
                const idx = rankedData.length - 1 - p.dataIndex;
                return `${rankedData[idx].plays}`;
              },
              fontSize: 11,
              color: theme === "dark" ? "#ccc" : "#333",
            },
          },
        ],
      },
      true,
    );

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      chartRef.current?.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, theme]);

  return <div ref={ref} className="chart-container" />;
}