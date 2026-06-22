const express = require("express");
const path = require("path");
const cors = require("cors");
const { initDatabase } = require("./db");
const apiRoutes = require("./routes/api");

// 处理未处理的Promise拒绝
process.on("unhandledRejection", (reason, promise) => {
  console.error("未处理的Promise拒绝:", reason);
});

// 处理未捕获的异常
process.on("uncaughtException", (err) => {
  console.error("未捕获的异常:", err);
  process.exit(1);
});

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件：世界地图 GeoJSON
app.use("/static", express.static(path.join(__dirname)));

// API 路由
app.use("/api", apiRoutes);

// 健康检查
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 启动服务
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`\n🚀 服务端已启动: http://localhost:${PORT}`);
      console.log(`📊 API 基础路径: http://localhost:${PORT}/api`);
      console.log(`\n可用的 API 端点:`);
      console.log(`  GET  /api/search/artists?keyword=xxx    — 搜索歌手`);
      console.log(`  GET  /api/artists                       — 获取所有歌手`);
      console.log(`  GET  /api/artist/:id                    — 歌手详情`);
      console.log(`  GET  /api/artist/:id/songs              — 歌手歌曲列表`);
      console.log(`  GET  /api/dashboard/overview            — 仪表盘总览`);
      console.log(`  GET  /api/chart/style-pie               — 风格饼图`);
      console.log(`  GET  /api/chart/top10-plays             — Top10播放量`);
      console.log(`  GET  /api/chart/top10-comments          — Top10评论数`);
      console.log(`  GET  /api/chart/plays-trend             — 播放量趋势`);
      console.log(`  GET  /api/chart/era-trend               — 年代热度`);
      console.log(`  GET  /api/chart/comment-wordcloud       — 评论词云`);
      console.log(`  GET  /api/chart/style-heatmap           — 风格热力图`);
      console.log(`  GET  /api/chart/style-boxplot           — 风格箱线图`);
      console.log(`  GET  /api/chart/scatter                 — 散点图`);
      console.log(`  GET  /api/chart/radar                   — 雷达图`);
      console.log(`  GET  /api/chart/album-donut            — 专辑环形图`);
      console.log(`  GET  /api/chart/violin                 — 小提琴图`);
      console.log(`  GET  /api/chart/stacked-era            — 堆叠柱状图`);
      console.log(`  GET  /api/chart/sankey                 — 桑基图`);
      console.log(`  GET  /api/chart/grouped-bar            — 分组柱状图`);
      console.log(`  GET  /api/chart/bubble                 — 气泡图`);
      console.log(`  GET  /api/chart/region-map             — 地区热力图\n`);
    });
  } catch (err) {
    console.error("启动失败:", err);
    process.exit(1);
  }
}

start();
