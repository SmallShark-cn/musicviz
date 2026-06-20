import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

export default function HotSongCountChart({ data }) {
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

    const sortedData = [...data].sort((a, b) => b.total - a.total);
    const names = sortedData.map((d) => d.name);

    // 各排行榜颜色
    const chartColors = {
      hot: "#ec4141",      // 红色 - 热歌榜
      rising: "#3b82f6",   // 蓝色 - 飙升榜
      new: "#10b981",      // 绿色 - 新歌榜
      original: "#f59e0b", // 橙色 - 原创榜
    };

    const chartNames = {
      hot: "热歌榜",
      rising: "飙升榜",
      new: "新歌榜",
      original: "原创榜",
    };

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params) => {
            const d = sortedData[params[0].dataIndex];
            let result = `${d.name}<br/>`;
            let total = 0;
            params.forEach((p) => {
              result += `${p.marker} ${p.seriesName}: ${p.value}首<br/>`;
              total += p.value;
            });
            result += `合计: ${total}首`;
            return result;
          },
        },
        legend: {
          data: ["热歌榜", "飙升榜", "新歌榜", "原创榜"],
          bottom: 0,
          textStyle: { fontSize: 10 },
        },
        grid: { left: 90, right: 20, top: 15, bottom: 45 },
        xAxis: {
          type: "value",
          axisLabel: { fontSize: 10 },
          splitLine: { lineStyle: { color: "rgba(0,0,0,0.05)" } },
        },
        yAxis: {
          type: "category",
          data: names,
          axisLabel: { fontSize: 11 },
          axisTick: { show: false },
          axisLine: { show: false },
        },
        series: [
          {
            name: "热歌榜",
            type: "bar",
            stack: "total",
            data: sortedData.map((d) => d.hot),
            itemStyle: { color: chartColors.hot },
            barWidth: 24,
          },
          {
            name: "飙升榜",
            type: "bar",
            stack: "total",
            data: sortedData.map((d) => d.rising),
            itemStyle: { color: chartColors.rising },
          },
          {
            name: "新歌榜",
            type: "bar",
            stack: "total",
            data: sortedData.map((d) => d.new),
            itemStyle: { color: chartColors.new },
          },
          {
            name: "原创榜",
            type: "bar",
            stack: "total",
            data: sortedData.map((d) => d.original),
            itemStyle: { color: chartColors.original },
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
