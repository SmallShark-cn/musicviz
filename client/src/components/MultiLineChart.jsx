import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

/**
 * 多系列折线图组件
 * props.data: [{ artist: "歌手名", year: 2020, count: 5 }, ...]
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

    // 按歌手分组
    const artistMap = {};
    const allYears = new Set();
    for (const d of data) {
      if (!artistMap[d.artist]) artistMap[d.artist] = {};
      artistMap[d.artist][d.year] = (artistMap[d.artist][d.year] || 0) + d.count;
      allYears.add(d.year);
    }

    const years = [...allYears].sort((a, b) => a - b);
    const artists = Object.keys(artistMap);
    const colors = ["#ec4141", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"];

    const series = artists.map((artist, i) => ({
      name: artist,
      type: "line",
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { width: 2.5, color: colors[i % colors.length] },
      itemStyle: { color: colors[i % colors.length] },
      emphasis: { focus: "series" },
      data: years.map((y) => artistMap[artist][y] || 0),
    }));

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          formatter: (params) => {
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
          data: years.map(String),
          axisLabel: { fontSize: 11, rotate: years.length > 15 ? 45 : 0 },
          boundaryGap: false,
        },
        yAxis: {
          type: "value",
          name: "歌曲数",
          minInterval: 1,
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

  return <div ref={ref} className="chart-container" />;
}
