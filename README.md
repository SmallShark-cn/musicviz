# MusicViz - 网易云音乐歌手数据可视化大屏

[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![ECharts](https://img.shields.io/badge/ECharts-5.5-green)](https://echarts.apache.org)
[![Node.js](https://img.shields.io/badge/Node.js-Express-brightgreen)](https://expressjs.com)
[![Python](https://img.shields.io/badge/Python-sklearn-yellow)](https://scikit-learn.org)

基于网易云音乐 API 的歌手数据可视化分析平台，支持多歌手对比、评论情感分析、主题聚类，并结合机器学习预测歌曲互动度评分。

## 项目预览

| 功能模块 | 说明 |
|---------|------|
| 歌手对比 | 最多 4 位歌手多维指标雷达图对比 |
| 歌曲分析 | Top 歌曲排名、热度衰减、年代分布 |
| 评论挖掘 | 情感分析 + 9 类主题聚类 |
| 机器学习 | RandomForest 预测歌曲互动度评分（1-5 分） |
| 歌词词云 | 多歌手歌词高频词可视化 |
| 地图展示 | 歌手归属地分布热力图 |

## 技术架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  React 前端  │────▶│  Node 后端    │────▶│   MySQL     │
│  Vite+ECharts│◀────│  Express API  │────│  数据库      │
─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  Python ML   │
                    │  sklearn     │
                    └──────────────┘
```

### 前端
- **框架**: React 18 + Vite 5
- **可视化**: ECharts 5.5 + echarts-wordcloud
- **样式**: CSS Variables 主题系统（深色/浅色模式）

### 后端
- **运行时**: Node.js + Express
- **数据库**: MySQL (mysql2)
- **爬虫**: Puppeteer + 网易云音乐 API
- **中文分词**: nodejieba

### 机器学习
- **框架**: scikit-learn
- **模型**: RandomForest / GradientBoosting 分类器
- **任务**: 歌曲互动度评分预测（5 分类）

## 快速开始

### 环境要求
- Node.js >= 18
- Python >= 3.9
- MySQL >= 8.0

### 1. 克隆项目
```bash
git clone <your-repo-url>
cd music-dashboard
```

### 2. 数据库配置
创建 MySQL 数据库 `music_dashboard`，然后修改 `server/db.js` 中的数据库连接信息：
```javascript
const DB_CONFIG = {
  host: "localhost",
  user: "root",
  password: "your_password",
  database: "music_dashboard",
};
```

### 3. 安装依赖 & 启动
```bash
# 后端
cd server
npm install
npm run dev        # 启动后端服务 (端口 3001)

# 前端（新终端）
cd client
npm install
npm run dev        # 启动前端开发服务器 (端口 5173)
```

### 4. 运行 ML 模型（可选）
```bash
cd server
python3 ml_pipeline.py
```

## 项目结构

```
.
├── client/                 # 前端 React 应用
│   ├── src/
│   │   ├── components/     # 图表组件（15+ 种可视化）
│   │   ├── hooks/          # 自定义 Hook（拖拽布局）
│   │   ├── styles/         # 全局样式
│   │   ├── App.jsx         # 主应用
│   │   ├── api.js          # API 请求封装
│   │   └── utils.js        # 工具函数
│   └── package.json
├── server/                 # 后端服务
│   ├── routes/
│   │   ── api.js          # API 路由
│   ├── artist_crawler.js   # 歌手数据爬虫
│   ├── comment_analyzer.py # 评论分析（情感+主题）
│   ├── ml_pipeline.py      # ML 训练管道
│   ├── db.js               # 数据库配置
│   ── index.js            # 服务入口
── FEATURES.md             # 功能清单
├── ML_TRAINING_LOG.md      # ML 训练日志
└── README.md
```

## 可视化图表清单

| # | 图表 | 组件 | 说明 |
|---|------|------|------|
| 1 | 雷达图 | RadarChart | 多歌手指标对比 |
| 2 | 排名图 | RankingChart | Top10 歌曲评论数 |
| 3 | 分组柱状图 | GroupedBarChart | 听众活跃度对比 |
| 4 | 多折线图 | MultiLineChart | 年度产出趋势 |
| 5 | 歌词词云 | LyricWordCloud | 歌词高频词 |
| 6 | 饼图 | PieChart | 歌曲年代分布 |
| 7 | 多折线图 | MultiLineChart | Top10 热度衰减 |
| 8 | 气泡图 | BubbleChart | 作品量×热度×互动 |
| 9 | 地图 | MapChart | 歌手归属地分布 |
| 10 | 饼图 | PieChart | 风格标签分布 |
| 11 | 情感分析 | SentimentAnalysisCard | 评论情感分布 |
| 12 | 主题聚类 | TopicClusterCard | 评论主题分类 |
| 13 | 环形图 | MLScoreCard | ML 评分分布 |
| 14 | 条形图 | MLScoreCard | 特征重要性 |

## 机器学习说明

### 任务定义
预测歌曲的互动度评分（1-5 分），基于评论数分档：

| 评分 | 评论数范围 | 含义 |
|------|-----------|------|
| 1 | 0 | 无互动 |
| 2 | 1-499 | 低互动 |
| 3 | 500-4,999 | 中等互动 |
| 4 | 5,000-29,999 | 高互动 |
| 5 | ≥30,000 | 极高互动 |

### 特征工程
- 原始特征：播放量、歌曲时长、发布年份、歌手总歌曲数、总专辑数
- 构造特征：`log_plays`、`sqrt_plays`、`era`、`productivity`、`is_long_song` 等共 12 个
- 特征选择：ANOVA F 检验 (SelectKBest)
- 类别不均衡处理：`class_weight="balanced"`

### 模型对比
- **RandomForest Classifier** — bagging 机制，抗过拟合
- **GradientBoosting Classifier** —  boosting 机制，精度高
- 通过 GridSearchCV 5 折交叉验证选优

详见 [ML_TRAINING_LOG.md](./ML_TRAINING_LOG.md)

## 数据来源

- 歌手信息、歌曲数据、评论数据均来自 **网易云音乐公开 API**
- 地图数据使用 ECharts 内置 GeoJSON
- 仅供学习研究使用，请勿用于商业用途

## License

MIT
