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

    const sortedData = [...data].sort((a, b) => b.count - a.count);
    const names = sortedData.map((d) => d.name);
    const values = sortedData.map((d) => d.count);
    const total = values.reduce((sum, v) => sum + v, 0);

    const colors = ["#ec4141", "#3b82f6", "#10b981", "#f59e0b"];

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (p) => {
            const d = sortedData[p[0].dataIndex];
            const percentage = total > 0 ? ((d.count / total) * 100).toFixed(1) : 0;
            return `${d.name}<br/>热歌榜上榜次数: ${d.count}<br/>占比: ${percentage}%`;
          },
        },
        grid: { left: 100, right: 60, top: 20, bottom: 30 },
        xAxis: {
          type: "value",
          max: Math.max(...values, 1),
          axisLabel: { fontSize: 11 },
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
            type: "bar",
            data: values.map((v, i) => ({
              value: v,
              itemStyle: {
                borderRadius: [0, 4, 4, 0],
                color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: colors[i % colors.length] },
                  { offset: 1, color: colors[i % colors.length] + "80" },
                ]),
              },
            })),
            barWidth: 20,
            label: {
              show: true,
              position: "right",
              formatter: (p) => `${p.value}首`,
              fontSize: 12,
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