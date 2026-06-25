import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

export default function PieChart({ data }) {
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

    const colors = [
      "#ec4141",
      "#3b82f6",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#06b6d4",
      "#ec4899",
      "#f97316",
      "#84cc16",
      "#14b8a6",
    ];

    // 智能判断图表含义：根据第一个数据项的字段名
    const isStyle = data[0]?.style !== undefined;

    // 数据归一化：过滤无效值（count<=0），并按总和计算真实占比
    const total = data.reduce((s, d) => s + (Number(d.count) || 0), 0);

    chartRef.current.setOption(
      {
        tooltip: {
          trigger: "item",
          formatter: (p) => {
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
            return `<b>${p.name}</b><br/>数量: ${p.value}<br/>占比: ${pct}%`;
          },
        },
        legend: {
          bottom: 0,
          left: "center",
          textStyle: { fontSize: 11 },
          itemWidth: 12,
          itemHeight: 12,
          type: "scroll",
        },
        series: [
          {
            type: "pie",
            radius: ["38%", "68%"],
            center: ["50%", "45%"],
            roseType: "area",
            itemStyle: {
              borderRadius: 6,
              borderColor: theme === "dark" ? "#161c2c" : "#fff",
              borderWidth: 3,
            },
            label: {
              show: true,
              fontSize: 11,
              formatter: (p) => {
                const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : 0;
                return `${p.name}\n${pct}%`;
              },
              lineHeight: 14,
            },
            labelLine: {
              length: 8,
              length2: 10,
            },
            emphasis: {
              label: { fontSize: 14, fontWeight: "bold" },
              scaleSize: 10,
            },
            data: data.map((d, i) => ({
              value: d.count,
              name: d.name,
              itemStyle: { color: colors[i % colors.length] },
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

  return (
    <div>
      <div ref={ref} className="chart-container" />
    </div>
  );
}
