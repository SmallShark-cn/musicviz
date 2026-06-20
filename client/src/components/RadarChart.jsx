import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

const DIMS = ["粉丝数", "热歌数", "风格丰富度", "评论活跃度"];

export default function RadarChart({ data }) {
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

    const maxVals = [
      Math.max(...data.map((d) => d.followers || 0)),
      Math.max(...data.map((d) => d.hot_songs || 0)),
      Math.max(...data.map((d) => d.style_count || 0)),
      Math.max(...data.map((d) => d.total_comments || 0)),
    ];

    const colors = ["#ec4141", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

    chartRef.current.setOption(
      {
        legend: {
          data: data.map((d) => d.name),
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        radar: {
          center: ["50%", "45%"],
          radius: "65%",
          indicator: DIMS.map((name, i) => ({ name, max: maxVals[i] || 1 })),
          axisName: { fontSize: 11 },
        },
        series: [
          {
            type: "radar",
            data: data.map((d, i) => ({
              name: d.name,
              value: [
                d.followers || 0,
                d.hot_songs || 0,
                d.style_count || 0,
                d.total_comments || 0,
              ],
              lineStyle: { color: colors[i % colors.length] },
              areaStyle: { color: colors[i % colors.length] + "20" },
              itemStyle: { color: colors[i % colors.length] },
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

  return <div ref={ref} className="chart-container" />;
}
