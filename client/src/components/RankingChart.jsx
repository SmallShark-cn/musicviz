import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

export default function RankingChart({ data }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const chartRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.length) return;

    const initChart = () => {
      const { clientWidth, clientHeight } = ref.current;
      if (clientWidth === 0 || clientHeight === 0) {
        // DOM尺寸无效，延迟重试
        timerRef.current = setTimeout(initChart, 100);
        return;
      }

      if (chartRef.current) chartRef.current.dispose();
      chartRef.current = echarts.init(
        ref.current,
        theme === "dark" ? "dark" : undefined,
      );

      const rankedData = [...data].sort((a, b) => b.plays - a.plays);
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
                if (originalIndex === 1) return "#00d4ff";
                if (originalIndex === 2) return "#cd7f32";
                return theme === "dark" ? "#aaa" : "#666";
              },
              formatter: (value, index) => {
                const [song, artist] = names[index];
                const originalIndex = rankedData.length - 1 - index;
                const rank = ["🥇", "🥈", "🥉"][originalIndex];
                const rankPrefix = rank ? `${rank} ` : "";
                return `{title|${rankPrefix}${song}}\n{sub|${artist}}`;
              },
              rich: {
                title: {
                  fontSize: 11,
                  fontWeight: 500,
                  color: theme === "dark" ? "#e8eaed" : "#1a1a2e",
                },
                sub: {
                  fontSize: 9,
                  color: theme === "dark" ? "#9ca3af" : "#6b7280",
                  padding: [2, 0],
                },
              },
            },
          },
          series: [
            {
              type: "bar",
              data: values.map((v, i) => ({
                value: v,
                itemStyle: {
                  borderRadius: [0, 4, 4, 0],
                  color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: "#ec4141" },
                    { offset: 1, color: "#ff6b6b" },
                  ]),
                },
              })),
              barWidth: "50%",
            },
          ],
        },
        true,
      );
    };

    initChart();

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      chartRef.current?.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, theme]);

  return <div ref={ref} className="chart-container" />;
}
