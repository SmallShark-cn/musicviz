import React from "react";

export default function MLScoreCard({ data, chart }) {
  if (!data) return null;
  if (chart === "list") return <MLList data={data} />;
  return null; // bar chart removed since we use predict endpoint now
}

function MLList({ data }) {
  const predictions = data?.predictions || [];

  // 按歌手分组，交叉排列保证分布平均
  const grouped = {};
  predictions.forEach((p) => {
    if (!grouped[p.artist]) grouped[p.artist] = [];
    grouped[p.artist].push(p);
  });
  const artists = Object.keys(grouped);
  let display = [];
  for (let i = 0; i < 15; i++) {
    for (const art of artists) {
      const songs = grouped[art] || [];
      if (i < songs.length) display.push(songs[i]);
    }
    if (display.length >= 40) break;
  }

  const labels = {
    1: "💤 低活跃",
    2: "📝 一般",
    3: "💬 中等",
    4: "🔥 较高",
    5: "🌟 高活跃",
  };
  const colors = {
    1: "#9ca3af",
    2: "#f59e0b",
    3: "#3b82f6",
    4: "#ec4899",
    5: "#ef4444",
  };

  return (
    <div style={{ maxHeight: 400, overflowY: "auto" }}>
      <div
        style={{
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 8,
          padding: 10,
          marginBottom: 12,
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.6,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 4,
          }}
        >
          听众活跃度评分（1-5分）
        </div>
        基于播放量和评论数预测听众活跃程度。分数越高代表相对于播放量，评论互动越超出预期。
      </div>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
            <th style={{ padding: "6px 4px", textAlign: "left" }}>歌曲</th>
            <th style={{ padding: "6px 4px", textAlign: "left" }}>歌手</th>
            <th style={{ padding: "6px 4px", textAlign: "center" }}>评分</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }}>播放量</th>
            <th style={{ padding: "6px 4px", textAlign: "right" }}>评论数</th>
          </tr>
        </thead>
        <tbody>
          {display.map((p, i) => (
            <tr
              key={i}
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <td
                style={{
                  padding: "4px 4px",
                  maxWidth: 100,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </td>
              <td
                style={{
                  padding: "4px 4px",
                  color: "var(--text-muted)",
                  maxWidth: 70,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.artist}
              </td>
              <td style={{ padding: "4px 4px", textAlign: "center" }}>
                <span
                  style={{
                    display: "inline-block",
                    background: colors[p.predicted_score] || "#6b7280",
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {p.predicted_score}分 {labels[p.predicted_score] || ""}
                </span>
              </td>
              <td
                style={{
                  padding: "4px 4px",
                  textAlign: "right",
                  fontFamily: "monospace",
                }}
              >
                {p.plays}
              </td>
              <td
                style={{
                  padding: "4px 4px",
                  textAlign: "right",
                  fontFamily: "monospace",
                }}
              >
                {p.comments.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
