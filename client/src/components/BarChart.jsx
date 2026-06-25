import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

export default function BarChart({ data, horizontal }) {
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

    const names = data
      .map((d) => (d.name?.length > 12 ? d.name.slice(0, 12) + "..." : d.name))
      .reverse();
    const values = data
      .map((d) => (horizontal ? d.comments_count : d.plays))
      .reverse();

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (p) => {
            const d = data[data.length - 1 - p[0].dataIndex];
            return `${d.artist_name || ""} - ${d.name}<br/>${horizontal ? "评论数" : "播放量"}: ${p[0].value.toLocaleString()}`;
          },
        },
        grid: horizontal
          ? { left: 120, right: 60, top: 10, bottom: 20 }
          : { left: 60, right: 30, top: 10, bottom: 80 },
        xAxis: horizontal
          ? {
            type: "value",
            axisLabel: {
              formatter: (v) =>
                v >= 1e8
                  ? (v / 1e8).toFixed(1) + "亿"
                  : v >= 1e4
                    ? (v / 1e4).toFixed(0) + "万"
                    : v,
            },
          }
          : {
            type: "category",
            data: names,
            axisLabel: { rotate: 45, fontSize: 11 },
            axisTick: { show: false },
          },
        yAxis: horizontal
          ? {
            type: "category",
            data: names,
            axisLabel: { fontSize: 11 },
            axisTick: { show: false },
          }
          : {
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
            type: "bar",
            data: values,
            itemStyle: {
              borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
              color: new echarts.graphic.LinearGradient(
                0,
                0,
                horizontal ? 1 : 0,
                horizontal ? 0 : 1,
                [
                  { offset: 0, color: "#ec4141" },
                  { offset: 1, color: "#ff6b6b" },
                ],
              ),
            },
            barWidth: horizontal ? 16 : "50%",
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
  }, [data, horizontal, theme]);

  return (
    <div>
      <ChartTip
        icon="📊"
        text="柱状图：柱形长度代表数值大小。横排模式更适合长名称，纵排模式适合横向对比。"
      />
      <div ref={ref} className="chart-container" />
    </div>
  );
}
