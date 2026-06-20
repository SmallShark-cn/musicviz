import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

export default function HeatmapChart({ data }) {
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

    const styles = data.map((d) => d.style);
    const indicators = [
      "avg_followers",
      "artist_count",
      "min_followers",
      "max_followers",
    ];
    const indicatorNames = ["平均粉丝", "歌手数量", "最小粉丝", "最大粉丝"];

    const heatData = [];
    styles.forEach((s, si) => {
      indicators.forEach((ind, ii) => {
        heatData.push([ii, si, data[si][ind] || 0]);
      });
    });

    chartRef.current.setOption(
      {
        tooltip: {
          position: "top",
          formatter: (p) =>
            `${data[p.value[1]].style}<br/>${indicatorNames[p.value[0]]}: ${(p.value[2] || 0).toLocaleString()}`,
        },
        grid: { left: 100, right: 60, top: 20, bottom: 50 },
        xAxis: {
          type: "category",
          data: indicatorNames,
          axisLabel: { fontSize: 11 },
          splitArea: { show: true },
        },
        yAxis: {
          type: "category",
          data: styles,
          axisLabel: { fontSize: 11 },
          splitArea: { show: true },
        },
        visualMap: {
          min: 0,
          max: Math.max(...heatData.map((d) => d[2])),
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: 0,
          inRange: {
            color:
              theme === "dark"
                ? ["#161c2c", "#3d1a1a", "#8b2525", "#ec4141", "#ff6b6b"]
                : ["#f0f2f5", "#ffd6d6", "#ff8a8a", "#ec4141", "#c92a2a"],
          },
        },
        series: [
          {
            type: "heatmap",
            data: heatData,
            label: { show: false },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" },
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
