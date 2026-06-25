import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

export default function GroupedBarChart({ data }) {
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

    const names = data.map((d) => d.name);

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params) => {
            let tip = `<b>${params[0].axisValue}</b><br/>`;
            for (const p of params) {
              tip += `${p.marker} ${p.seriesName}: ${p.value.toLocaleString()}<br/>`;
            }
            return tip;
          },
        },
        legend: {
          data: ["平均热度", "最高热度"],
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        grid: { left: 55, right: 20, top: 15, bottom: 45, containLabel: true },
        xAxis: {
          type: "category",
          data: names,
          axisLabel: { rotate: 30, fontSize: 11 },
        },
        yAxis: {
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
            name: "平均热度",
            type: "bar",
            data: data.map((d) => d.avg_pop),
            itemStyle: { color: "#3b82f6" },
          },
          {
            name: "最高热度",
            type: "bar",
            data: data.map((d) => d.max_pop),
            itemStyle: { color: "#ec4141" },
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ChartTip
        icon="📊"
        text="分组柱状图：蓝色=平均热度，红色=最高热度。差值越大代表该歌手作品质量参差不齐，差值越小代表水平稳定。"
      />
      <div ref={ref} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
