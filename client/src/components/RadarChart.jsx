import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

const DIMS = ["歌曲数", "专辑数", "风格数", "评论数"];

export default function RadarChart({ data }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const chartRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.length) return;

    const initChart = () => {
      const { clientWidth, clientHeight } = ref.current;
      if (clientWidth === 0 || clientHeight === 0) {
        // DOM尺寸无效，延迟重试
        timerRef.current = setTimeout(initChart, 100);
        return;
      }

      if (chartRef.current) chartRef.current.dispose();
      chartRef.current = echarts.init(
        ref.current,
        theme === "dark" ? "dark" : undefined,
      );

      const colors = ["#ec4141", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

      chartRef.current.setOption(
        {
          tooltip: {
            trigger: "item",
            formatter: (p) => {
              const d = data[p.dataIndex];
              const raw = d._raw || {};
              return `${d.name}<br/>` +
                `歌曲数: ${raw.song_count || d["歌曲数"]}<br/>` +
                `专辑数: ${raw.album_size || d["专辑数"]}<br/>` +
                `风格数: ${raw.style_count || d["风格数"]}<br/>` +
                `评论数: ${(raw.total_comments || d["评论数"]).toLocaleString()}`;
            },
          },
          legend: {
            data: data.map((d) => d.name),
            bottom: 0,
            textStyle: { fontSize: 11 },
          },
          radar: {
            center: ["50%", "45%"],
            radius: "65%",
            indicator: DIMS.map((name) => ({ name, max: 100 })),
            axisName: { fontSize: 11 },
            splitLine: { lineStyle: { color: "rgba(0,0,0,0.1)" } },
            splitArea: { show: true, areaStyle: { color: ["rgba(255,255,255,0.05)", "rgba(255,255,255,0.1)"] } },
          },
          series: [
            {
              type: "radar",
              data: data.map((d, i) => ({
                name: d.name,
                value: [
                  d["歌曲数"] || 0,
                  d["专辑数"] || 0,
                  d["风格数"] || 0,
                  d["评论数"] || 0,
                ],
                lineStyle: { color: colors[i % colors.length], width: 2 },
                areaStyle: { color: colors[i % colors.length] + "30" },
                itemStyle: { color: colors[i % colors.length] },
                symbolSize: 6,
              })),
            },
          ],
        },
        true,
      );
    };

    initChart();

    const handleResize = () => chartRef.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      chartRef.current?.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [data, theme]);

  return <div ref={ref} className="chart-container" />;
}
