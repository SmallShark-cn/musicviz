import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

export default function ScatterChart({ data }) {
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
            `${p.value[2]}<br/>歌曲数: ${p.value[0].toLocaleString()}<br/>平均评论: ${p.value[1].toFixed(1)}`,
        },
        grid: { left: 70, right: 30, top: 20, bottom: 50 },
        xAxis: {
          type: "value",
          name: "歌曲数",
          axisLabel: { formatter: (v) => (v / 1e4).toFixed(0) + "万" },
        },
        yAxis: { type: "value", name: "平均评论数" },
        series: [
          {
            type: "scatter",
            data: data.map((d) => [d.followers, d.avg_comments, d.name]),
            symbolSize: (val) =>
              Math.min(Math.max(Math.sqrt(val[0]) / 800, 6), 40),
            itemStyle: {
              color: new echarts.graphic.RadialGradient(0.4, 0.3, 1, [
                { offset: 0, color: "#ff6b6b" },
                { offset: 1, color: "rgba(236,65,65,0.3)" },
              ]),
            },
            emphasis: {
              scale: 1.5,
              itemStyle: { shadowBlur: 20, shadowColor: "rgba(236,65,65,0.6)" },
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
