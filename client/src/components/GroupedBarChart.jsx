import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

export default function GroupedBarChart({ data }) {
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

    const names = data.map((d) => d.name);

    chartRef.current.setOption(
      {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        legend: {
          data: ["歌曲数", "总播放量", "总评论数"],
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        grid: { left: 60, right: 30, top: 20, bottom: 50 },
        xAxis: {
          type: "category",
          data: names,
          axisLabel: { rotate: 30, fontSize: 11 },
        },
        yAxis: {
          type: "value",
          axisLabel: {
            formatter: (v) =>
              v >= 1e8
                ? (v / 1e8).toFixed(1) + "亿"
                : v >= 1e4
                  ? (v / 1e4).toFixed(0) + "万"
                  : v,
          },
        },
        series: [
          {
            name: "歌曲数",
            type: "bar",
            data: data.map((d) => d.song_count),
            itemStyle: { color: "#3b82f6" },
          },
          {
            name: "总播放量",
            type: "bar",
            data: data.map((d) => d.total_plays),
            itemStyle: { color: "#ec4141" },
          },
          {
            name: "总评论数",
            type: "bar",
            data: data.map((d) => d.total_comments),
            itemStyle: { color: "#10b981" },
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
