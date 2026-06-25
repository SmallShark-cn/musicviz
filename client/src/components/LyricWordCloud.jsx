import React, { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import "echarts-wordcloud";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

export default function LyricWordCloud({ data }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const chartRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.words?.length) return;

    const initChart = () => {
      const { clientWidth, clientHeight } = ref.current;
      if (clientWidth === 0 || clientHeight === 0) {
        timerRef.current = setTimeout(initChart, 100);
        return;
      }

      if (chartRef.current) chartRef.current.dispose();
      chartRef.current = echarts.init(
        ref.current,
        theme === "dark" ? "dark" : undefined,
      );

      const words = data.words.slice(0, 80);
      const maxValue = Math.max(...words.map((w) => w.value));

      chartRef.current.setOption(
        {
          tooltip: {
            show: true,
            formatter: (p) => {
              return `<b>${p.name}</b><br/>出现次数: ${p.value}`;
            },
            backgroundColor: "rgba(22, 28, 44, 0.95)",
            borderColor: "#1e2d45",
            textStyle: { color: "#e8eaed" },
          },
          series: [
            {
              type: "wordCloud",
              shape: "circle",
              left: "center",
              top: "center",
              width: "95%",
              height: "95%",
              right: null,
              bottom: null,
              sizeRange: [12, 48],
              rotationRange: [-45, 45],
              rotationStep: 15,
              gridSize: 8,
              drawOutOfBound: false,
              layoutAnimation: true,
              textStyle: {
                fontFamily: "sans-serif",
                fontWeight: "bold",
              },
              emphasis: {
                focus: "self",
                textStyle: {
                  textShadowBlur: 10,
                  textShadowColor: "#333",
                },
              },
              data: words.map((w) => {
                const colors = [
                  "#ec4141",
                  "#3b82f6",
                  "#10b981",
                  "#f59e0b",
                  "#8b5cf6",
                  "#ec4899",
                  "#06b6d4",
                  "#f97316",
                  "#84cc16",
                  "#6366f1",
                ];
                return {
                  name: w.name,
                  value: w.value,
                  textStyle: {
                    color: colors[Math.floor(Math.random() * colors.length)],
                    fontSize: Math.max(12, Math.min(48, (w.value / maxValue) * 40 + 14)),
                  },
                };
              }),
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

  return (
    <div>
      <ChartTip
        icon="☁️"
        text="基于Top10歌曲歌词的关键词词云。字号越大代表出现频次越高，位置无特定含义。可发现歌手创作中的高频意象和主题。"
      />
      <div ref={ref} className="chart-container" />
    </div>
  );
}
