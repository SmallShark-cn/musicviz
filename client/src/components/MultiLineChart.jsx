import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

/**
 * 多系列折线图组件 — 支持两种模式：
 * 1. 年份模式: data = [{ artist, year, count }, ...]
 * 2. 排名模式: data = [{ artist, rank, plays }, ...]
 */
export default function MultiLineChart({ data }) {
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

    const isRank = data[0]?.rank !== undefined;
    const artists = [...new Set(data.map((d) => d.artist))];
    const colors = [
      "#ec4141",
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
    ];

    let xData, series;

    if (isRank) {
      // 排名模式：横轴 1~10（或数据中实际出现的排名）
      const ranks = [...new Set(data.map((d) => d.rank))].sort((a, b) => a - b);
      xData = ranks;

      series = artists.map((artist, i) => {
        const artistData = data.filter((d) => d.artist === artist);
        return {
          name: artist,
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { width: 2.5, color: colors[i % colors.length] },
          itemStyle: { color: colors[i % colors.length] },
          emphasis: { focus: "series" },
          data: ranks.map((r) => {
            const pt = artistData.find((d) => d.rank === r);
            return pt ? pt.plays : null;
          }),
          connectNulls: false,
        };
      });
    } else {
      // 年份模式
      const allYears = new Set();
      const artistMap = {};
      for (const d of data) {
        if (!artistMap[d.artist]) artistMap[d.artist] = {};
        artistMap[d.artist][d.year] =
          (artistMap[d.artist][d.year] || 0) + d.count;
        allYears.add(d.year);
      }
      xData = [...allYears].sort((a, b) => a - b);

      series = artists.map((artist, i) => ({
        name: artist,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.5, color: colors[i % colors.length] },
        itemStyle: { color: colors[i % colors.length] },
        emphasis: { focus: "series" },
        data: xData.map((y) => {
          const map = artistMap[artist];
          return map ? map[y] || 0 : 0;
        }),
      }));
    }

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          formatter: isRank
            ? (params) => {
              let tip = `<b>排名 #${params[0].axisValue}</b><br/>`;
              for (const p of params) {
                if (p.value === null || p.value === undefined) continue;
                tip += `${p.marker} ${p.seriesName}: 热度 ${p.value}<br/>`;
              }
              return tip;
            }
            : (params) => {
              let tip = `<b>${params[0].axisValue} 年</b><br/>`;
              for (const p of params) {
                tip += `${p.marker} ${p.seriesName}: ${p.value} 首<br/>`;
              }
              return tip;
            },
        },
        legend: {
          data: artists,
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        grid: { left: 50, right: 30, top: 20, bottom: 50 },
        xAxis: {
          type: "category",
          data: xData.map((v) => (isRank ? "#" + v : String(v))),
          axisLabel: { fontSize: 11, rotate: 0 },
          boundaryGap: false,
        },
        yAxis: {
          type: "value",
          name: isRank ? "热度值" : "歌曲数",
          minInterval: isRank ? undefined : 1,
          axisLabel: { fontSize: 11 },
        },
        series,
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

  return (
    <div>
      <ChartTip
        icon="📈"
        text="多歌手折线对比图：每条线代表一个歌手，斜率越大代表增长/下降越快。点击图例可隐藏/显示特定歌手。"
      />
      <div ref={ref} className="chart-container" />
    </div>
  );
}
