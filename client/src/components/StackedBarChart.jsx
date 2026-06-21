import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

/**
 * 堆叠柱状图组件 — 不同时期音乐风格演变
 * props.data: [{ era: "2000-2009", style: "流行", artist_count: 15 }, ...]
 */
export default function StackedBarChart({ data }) {
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

    // 提取唯一的 era 列表（保持顺序）
    const eraOrder = ["2000年前", "2000-2009", "2010-2014", "2015-2019", "2020及以后"];
    const erasInData = [...new Set(data.map((d) => d.era))];
    const eras = eraOrder.filter((e) => erasInData.includes(e));
    if (eras.length === 0) eras.push(...erasInData);

    // 提取所有风格并统计
    const styleMap = {};
    for (const d of data) {
      if (!styleMap[d.style]) styleMap[d.style] = {};
      styleMap[d.style][d.era] = (styleMap[d.style][d.era] || 0) + d.artist_count;
    }

    // 按总出现次数排序取 Top8 风格
    const styleTotals = Object.entries(styleMap)
      .map(([style, eraData]) => ({
        style,
        total: Object.values(eraData).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total);

    const topStyles = styleTotals.slice(0, 8).map((s) => s.style);
    const colors = ["#ec4141", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

    const series = topStyles.map((style, i) => ({
      name: style,
      type: "bar",
      stack: "total",
      emphasis: { focus: "series" },
      itemStyle: { color: colors[i % colors.length] },
      data: eras.map((era) => styleMap[style]?.[era] || 0),
    }));

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          formatter: (params) => {
            let tip = `<b>${params[0].axisValue}</b><br/>`;
            let total = 0;
            for (const p of params) {
              if (p.value > 0) {
                tip += `${p.marker} ${p.seriesName}: ${p.value} 位歌手<br/>`;
                total += p.value;
              }
            }
            tip += `<b>合计: ${total} 位</b>`;
            return tip;
          },
        },
        legend: {
          data: topStyles,
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        grid: { left: 50, right: 30, top: 20, bottom: 60 },
        xAxis: {
          type: "category",
          data: eras,
          axisLabel: { fontSize: 11 },
        },
        yAxis: {
          type: "value",
          name: "歌手数",
          minInterval: 1,
          axisLabel: { fontSize: 11 },
        },
        series,
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
