import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

export default function LineChart({ data }) {
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

    const isEra = data[0]?.total_plays !== undefined;
    const xData = data.map((d) => (isEra ? d.publish_year : d.ranking));
    const yData = data.map((d) => (isEra ? d.total_plays : d.plays));

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          formatter: (p) => {
            const idx = p[0].dataIndex;
            if (isEra)
              return `${data[idx].publish_year}年<br/>总播放: ${(data[idx].total_plays || 0).toLocaleString()}<br/>歌曲数: ${data[idx].song_count}`;
            return `排名 #${data[idx].ranking}<br/>${data[idx].name}<br/>播放: ${data[idx].plays.toLocaleString()}`;
          },
        },
        grid: { left: 60, right: 30, top: 20, bottom: 40 },
        xAxis: { type: "category", data: xData, axisLabel: { fontSize: 11 } },
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
            type: "line",
            data: yData,
            smooth: true,
            symbol: "circle",
            symbolSize: 6,
            lineStyle: { color: "#ec4141", width: 2.5 },
            itemStyle: { color: "#ec4141" },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(236,65,65,0.3)" },
                { offset: 1, color: "rgba(236,65,65,0.02)" },
              ]),
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
        icon="📊"
        text="单系列折线图：显示年代或排名维度的指标变化趋势。峰值表示该年代/排名段的指标最高值。"
      />
      <div ref={ref} className="chart-container" />
    </div>
  );
}
