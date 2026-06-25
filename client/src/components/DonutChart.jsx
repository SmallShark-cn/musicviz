import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

export default function DonutChart({ data }) {
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

    const colors = ["#ec4141", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "item",
          formatter: (p) => `<b>${p.name}</b><br/>评论: ${p.value.toLocaleString()}<br/>占比: ${p.percent}%`,
        },
        legend: {
          orient: "vertical",
          right: 10,
          top: "center",
          textStyle: { fontSize: 11 },
        },
        series: [
          {
            type: "pie",
            radius: ["45%", "75%"],
            center: ["38%", "50%"],
            label: {
              show: true,
              position: "outside",
              formatter: "{b}\n{d}%",
              fontSize: 11,
            },
            labelLine: { length: 8, length2: 8 },
            emphasis: {
              label: { show: true, fontSize: 14, fontWeight: "bold" },
              scaleSize: 10,
            },
            itemStyle: {
              borderRadius: 4,
              borderColor: theme === "dark" ? "#161c2c" : "#fff",
              borderWidth: 3,
            },
            data: data.map((d, i) => ({
              value: d.comment_count,
              name: d.name,
              itemStyle: { color: colors[i] },
            })),
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

  return (
    <div>
      <ChartTip
        icon="💿"
        text="展示TOP5热门专辑的评论数分布占比。环图面积代表评论数总量，扇形大小代表该专辑在Top5中的占比。"
      />
      <div ref={ref} className="chart-container" />
    </div>
  );
}
