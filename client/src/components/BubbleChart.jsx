import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

export default function BubbleChart({ data }) {
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

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "item",
          formatter: (p) =>
            `${p.value[3]}<br/>粉丝: ${(p.value[0] / 1e4).toFixed(0)}万<br/>总播放: ${(p.value[1] / 1e8).toFixed(1)}亿<br/>平均评论: ${p.value[2].toFixed(0)}`,
        },
        grid: { left: 70, right: 30, top: 20, bottom: 50 },
        xAxis: {
          type: "value",
          name: "粉丝数",
          axisLabel: { formatter: (v) => (v / 1e4).toFixed(0) + "万" },
        },
        yAxis: {
          type: "value",
          name: "总播放量",
          axisLabel: {
            formatter: (v) =>
              v >= 1e8
                ? (v / 1e8).toFixed(1) + "亿"
                : (v / 1e4).toFixed(0) + "万",
          },
        },
        series: [
          {
            type: "scatter",
            data: data.map((d) => [
              d.followers,
              d.total_plays,
              d.avg_comments,
              d.name,
            ]),
            symbolSize: (val) => Math.min(Math.max(val[2] / 2, 8), 50),
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0,0,0,0.3)",
              color: new echarts.graphic.RadialGradient(0.4, 0.3, 1, [
                { offset: 0, color: "#8b5cf6" },
                { offset: 1, color: "rgba(236,65,65,0.4)" },
              ]),
            },
            emphasis: { scale: 1.3 },
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
