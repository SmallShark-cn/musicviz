import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

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
          formatter: (p) => {
            const style = data[p.value[1]].style;
            const indName = indicatorNames[p.value[0]];
            return `<b>${style}</b><br/>${indName}: ${(p.value[2] || 0).toLocaleString()}`;
          },
        },
        grid: { left: 100, right: 60, top: 20, bottom: 70 },
        xAxis: {
          type: "category",
          data: indicatorNames,
          axisLabel: { fontSize: 11, rotate: 0 },
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
            label: {
              show: true,
              fontSize: 10,
              color: theme === "dark" ? "#fff" : "#333",
              formatter: (p) => {
                const v = p.value[2];
                if (v >= 1e4) return (v / 1e4).toFixed(1) + "万";
                return v;
              },
            },
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

  return (
    <div>
      <ChartTip
        icon="🔥"
        text="热力图：行=音乐风格，列=指标维度（粉丝数/歌手数等）。颜色越深=数值越大。可快速识别高粉丝聚集的风格类型。"
      />
      <div ref={ref} className="chart-container" />
    </div>
  );
}
