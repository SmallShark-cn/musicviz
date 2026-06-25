import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";

export default function MLScoreCard({ data, chart }) {
  if (!data) return null;
  if (chart === "pie") return <MLPie data={data} />;
  return <MLBar data={data} />;
}

function MLPie({ data }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    if (cRef.current) cRef.current.dispose();
    cRef.current = echarts.init(ref.current);
    const dist = data.score_distribution;
    cRef.current.setOption(
      {
        tooltip: {
          trigger: "item",
          formatter: "{b}: {c}条评论 ({d}%)",
        },
        legend: {
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "70%"],
            data: Object.entries(dist).map(([k, v]) => ({
              name: k + "分",
              value: v,
            })),
            label: { formatter: "{b}\n{d}%" },
            itemStyle: {
              color: (p) =>
                ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"][
                p.dataIndex
                ],
            },
          },
        ],
      },
      true,
    );
    return () => cRef.current?.dispose();
  }, [data]);
  return (
    <div>
      <div style={{
        background: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.2)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 12,
        fontSize: 12,
        color: "var(--text-secondary)",
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          ℹ️ ML评分分布说明
        </div>
        用 RandomForest 模型预测每首歌的「预期评论数」，再与实际评论数相除得到
        <b>互动度评分（1~5分）</b>。分数越高代表评论区越活跃、粉丝粘性越强。
      </div>
      <div ref={ref} style={{ height: 280 }} />
    </div>
  );
}

function MLBar({ data }) {
  const ref = useRef(null);
  const cRef = useRef(null);
  useEffect(() => {
    if (!ref.current || !data?.feature_importance) return;
    if (cRef.current) cRef.current.dispose();
    cRef.current = echarts.init(ref.current);
    const fi = Object.entries(data.feature_importance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    cRef.current.setOption(
      {
        tooltip: {
          trigger: "axis",
          formatter: (p) => {
            const d = fi[fi.length - 1 - p[0].dataIndex];
            return `${d[0]}<br/>重要性: ${(d[1] * 100).toFixed(1)}%`;
          },
        },
        grid: { left: 100, right: 30, top: 10, bottom: 30 },
        yAxis: {
          type: "category",
          data: fi.map((f) => f[0]).reverse(),
          axisLabel: { fontSize: 11 },
        },
        xAxis: {
          type: "value",
          axisLabel: { formatter: (v) => (v * 100).toFixed(0) + "%" },
        },
        series: [
          {
            type: "bar",
            data: fi.map((f) => f[1]).reverse(),
            itemStyle: { color: "#3b82f6", borderRadius: [0, 4, 4, 0] },
            barWidth: 14,
            label: {
              show: true,
              position: "right",
              formatter: (p) => (p.value * 100).toFixed(1) + "%",
              fontSize: 10,
            },
          },
        ],
      },
      true,
    );
    return () => cRef.current?.dispose();
  }, [data]);
  return (
    <div>
      <div style={{
        background: "rgba(59, 130, 246, 0.08)",
        border: "1px solid rgba(59, 130, 246, 0.2)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: 12,
        fontSize: 12,
        color: "var(--text-secondary)",
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
          ℹ️ 特征重要性说明
        </div>
        模型预测歌曲热度时，各特征（如播放量、评论数、时长等）所占的权重比例。
        权重越高表示该特征对预测结果的影响越大。
      </div>
      <div ref={ref} style={{ height: 280 }} />
    </div>
  );
}
