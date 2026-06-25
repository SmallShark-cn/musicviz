import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

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
          formatter: (p) => {
            const name = p.value[3];
            const songs = p.value[0].toFixed(0);
            const avgComments = p.value[1].toFixed(0);
            const totalSongs = p.value[2].toFixed(0);
            return `<b>${name}</b><br/>` +
              `歌曲数: ${songs}首<br/>` +
              `平均评论数: ${avgComments}<br/>` +
              `采样歌曲: ${totalSongs}首<br/>` +
              `<span style="color:#888;font-size:10px">气泡大小代表采样歌曲数</span>`;
          },
        },
        grid: { left: 70, right: 30, top: 30, bottom: 50 },
        xAxis: {
          type: "log",
          name: "歌曲数(对数)",
          nameTextStyle: { fontSize: 11, padding: [10, 0, 0, 0] },
          axisLabel: { fontSize: 10 },
        },
        yAxis: {
          type: "log",
          name: "平均评论数(对数)",
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 10 },
        },
        series: [
          {
            type: "scatter",
            data: data.map((d) => [
              d.song_count || 1,
              d.avg_comments || 1,
              d.total_songs || 50,
              d.name,
            ]),
            symbolSize: (val) =>
              Math.min(Math.max(val[2] * 1.2, 10), 60),
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

  return (
    <div>
      <ChartTip
        icon="🎯"
        text="横轴=歌曲数量，纵轴=平均评论数。位于右上方的歌手代表作品多且互动高（质量+数量兼具）；气泡大小代表采样歌曲数。"
      />
      <div ref={ref} className="chart-container" />
    </div>
  );
}
