import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

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
        tooltip: { trigger: "item", formatter: "{b}<br/>评论: {c} ({d}%)" },
        legend: {
          orient: "vertical",
          right: 10,
          top: "center",
          textStyle: { fontSize: 11 },
        },
        series: [
          {
            type: "pie",
            radius: ["50%", "80%"],
            center: ["40%", "50%"],
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 14, fontWeight: "bold" },
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

  return <div ref={ref} className="chart-container" />;
}
