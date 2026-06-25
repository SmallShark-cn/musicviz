import React from "react";
import { useTheme } from "../ThemeContext";

/**
 * 图表说明组件 - 帮助用户理解图表用途
 * @param {string} text - 说明文字
 * @param {string} icon - 图标
 * @param {string} tip - 鼠标悬停提示
 */
export default function ChartTip({ text, icon = "💡" }) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        background:
          theme === "dark"
            ? "rgba(59, 130, 246, 0.08)"
            : "rgba(59, 130, 246, 0.06)",
        border: `1px solid ${
          theme === "dark"
            ? "rgba(59, 130, 246, 0.2)"
            : "rgba(59, 130, 246, 0.15)"
        }`,
        borderRadius: 6,
        padding: "6px 10px",
        marginBottom: 8,
        fontSize: 11,
        color: theme === "dark" ? "#9ca3af" : "#6b7280",
        lineHeight: 1.5,
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
      }}
    >
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{text}</span>
    </div>
  );
}
