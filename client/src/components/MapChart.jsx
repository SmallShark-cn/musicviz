import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "../ThemeContext";

const COUNTRY_MAP = {
  "中国": "China",
  "中国台湾": "China",
  "中国香港": "China",
  "中国澳门": "China",
  "台湾": "China",
  "香港": "China",
  "澳门": "China",
  "北京": "China",
  "美国": "United States",
  "日本": "Japan",
  "韩国": "South Korea",
  "新加坡": "Singapore",
  "马来西亚": "Malaysia",
  "英国": "United Kingdom",
  "法国": "France",
  "德国": "Germany",
  "荷兰": "Netherlands",
  "加拿大": "Canada",
  "澳大利亚": "Australia",
  "瑞典": "Sweden",
  "挪威": "Norway",
  "意大利": "Italy",
  "西班牙": "Spain",
  "巴西": "Brazil",
  "印度": "India",
  "泰国": "Thailand",
  "菲律宾": "Philippines",
  "印度尼西亚": "Indonesia",
};

export default function MapChart({ artists, regionMap }) {
  const { theme } = useTheme();
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const container = ref.current;
    let chart = null;
    let mounted = true;

    fetch("/static/world.json")
      .then((r) => r.json())
      .then((worldJson) => {
        if (!mounted) return;
        try {
          echarts.registerMap("world", worldJson);
          chart = echarts.init(container, theme === "dark" ? "dark" : undefined);
          updateChart();
        } catch (e) {
          console.error("Map render error:", e);
        }
      })
      .catch(() => {
        if (!mounted) return;
        container.innerHTML = `<div style="padding:60px;text-align:center;color:#9095a8;font-size:14px">🌍 世界地图加载失败</div>`;
      });

    const updateChart = () => {
      if (!chart) return;

      const countryCounts = {};
      artists.forEach((a) => {
        const region = regionMap[a.id] || "";
        const country = COUNTRY_MAP[region] || "";
        if (country) {
          countryCounts[country] = (countryCounts[country] || 0) + 1;
        }
      });

      const data = Object.entries(countryCounts).map(([name, value]) => ({
        name,
        value,
      }));

      const option = {
        tooltip: {
          trigger: "item",
          formatter: (params) => {
            return `${params.name}<br/>歌手数量: ${params.value || 0}`;
          },
        },
        visualMap: {
          min: 1,
          max: Math.max(...Object.values(countryCounts), 2),
          left: "left",
          top: "bottom",
          text: ["高", "低"],
          calculable: true,
          inRange: {
            color: ["#e0f7fa", "#80deea", "#4dd0e1", "#26c6da", "#00acc1", "#00838f"],
          },
        },
        series: [
          {
            name: "歌手分布",
            type: "map",
            mapType: "world",
            roam: true,
            zoom: 1.2,
            label: {
              show: false,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 12,
              },
              itemStyle: {
                shadowBlur: 10,
                shadowColor: "rgba(0, 0, 0, 0.5)",
              },
            },
            data: data,
          },
        ],
      };

      chart.setOption(option);
    };

    const resize = () => chart && chart.resize();
    window.addEventListener("resize", resize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", resize);
      if (chart) chart.dispose();
    };
  }, [artists, regionMap, theme]);

  return (
    <div className="map-wrap">
      <div ref={ref} style={{ width: "100%", height: "400px" }} />
    </div>
  );
}
