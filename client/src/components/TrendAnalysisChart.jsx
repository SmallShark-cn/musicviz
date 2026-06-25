import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";
import ChartTip from "./ChartTip";

/**
 * 计算线性回归
 * @param {Array} data - [{x, y}]
 * @returns {Object} - {slope, intercept, r2}
 */
function calculateRegression(data) {
  const n = data.length;
  if (n < 2) return null;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (const { x, y } of data) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  let ssTot = 0, ssRes = 0;
  const meanY = sumY / n;
  for (const { x, y } of data) {
    ssTot += Math.pow(y - meanY, 2);
    ssRes += Math.pow(y - (slope * x + intercept), 2);
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

/**
 * 计算热度衰减率
 */
function calculateDecayRate(data) {
  if (data.length < 2) return 0;
  const sorted = [...data].sort((a, b) => a.rank - b.rank);
  const first = sorted[0].value;
  const last = sorted[sorted.length - 1].value;
  return ((first - last) / first * 100).toFixed(1);
}

export default function TrendAnalysisChart({ data }) {
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

    const sortedData = [...data].sort((a, b) => a.rank - b.rank);
    const regressionData = sortedData.map((d, i) => ({ x: i + 1, y: d.value }));
    const regression = calculateRegression(regressionData);
    const decayRate = calculateDecayRate(sortedData);

    const xData = sortedData.map((d) => d.rank);
    const yData = sortedData.map((d) => d.value);
    const trendLine = regression
      ? sortedData.map((d, i) => regression.slope * (i + 1) + regression.intercept)
      : [];

    chartRef.current.setOption(
      {
        title: {
          text: `热度衰减率: ${decayRate}%`,
          subtext: regression ? `拟合度 R²: ${regression.r2.toFixed(3)}` : "",
          left: "center",
          top: 5,
          textStyle: { fontSize: 12, color: theme === "dark" ? "#aaa" : "#666" },
          subtextStyle: { fontSize: 10, color: theme === "dark" ? "#888" : "#888" },
        },
        tooltip: {
          trigger: "axis",
          formatter: (p) => {
            const idx = p[0].dataIndex;
            const d = sortedData[idx];
            return `<b>排名 #${d.rank}</b><br/>${d.name}<br/>热度值: ${d.value}`;
          },
        },
        legend: {
          data: ["热度值", "趋势线", "移动平均"],
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        grid: { left: 60, right: 30, top: 50, bottom: 50 },
        xAxis: {
          type: "category",
          data: xData,
          name: "排名",
          nameTextStyle: { fontSize: 11, padding: [10, 0, 0, 0] },
          axisLabel: { fontSize: 11 },
        },
        yAxis: {
          type: "value",
          name: "热度值",
          nameTextStyle: { fontSize: 11 },
          axisLabel: { fontSize: 11 },
          // y 轴不固定 max，让数据自适应（避免一直显示 0-100）
          min: 0,
          scale: true,
        },
        series: [
          {
            type: "scatter",
            name: "热度值",
            data: yData.map((v, i) => ({
              value: [xData[i], v],
              itemStyle: {
                color: "#ec4141",
                size: 8,
              },
            })),
          },
          {
            type: "line",
            name: "趋势线",
            data: trendLine,
            smooth: false,
            symbol: "none",
            lineStyle: {
              color: "#3b82f6",
              width: 2,
              type: "dashed",
            },
            tooltip: {
              formatter: (p) => `趋势预测: ${p.value.toFixed(1)}`,
            },
          },
          {
            type: "line",
            name: "移动平均",
            data: yData.map((_, i) => {
              let sum = 0, count = 0;
              for (let j = Math.max(0, i - 1); j <= Math.min(yData.length - 1, i + 1); j++) {
                sum += yData[j];
                count++;
              }
              return sum / count;
            }),
            smooth: true,
            symbol: "none",
            lineStyle: {
              color: "#10b981",
              width: 2,
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: "rgba(16, 185, 129, 0.2)" },
                { offset: 1, color: "rgba(16, 185, 129, 0.02)" },
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
        icon="📉"
        text="展示TOP10歌曲热度随排名衰减的曲线。蓝色虚线=线性回归趋势，绿色实线=3点移动平均。R²越接近1说明衰减越有规律。"
      />
      <div ref={ref} className="chart-container" />
    </div>
  );
}