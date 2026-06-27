# MusicViz - 网易云音乐歌手数据可视化大屏

[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![ECharts](https://img.shields.io/badge/ECharts-5.5-green)](https://echarts.apache.org)
[![Node.js](https://img.shields.io/badge/Node.js-Express-brightgreen)](https://expressjs.com)
[![Python](https://img.shields.io/badge/Python-sklearn-yellow)](https://scikit-learn.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

基于网易云音乐 API 的歌手数据可视化分析平台，支持多歌手对比、评论情感分析、主题聚类，并结合机器学习预测歌曲潜力评分。

## 功能特性

| 模块 | 说明 |
|------|------|
| 歌手对比 | 最多 4 位歌手多维指标雷达图对比 |
| 歌曲分析 | Top 歌曲排名、热度衰减、年代分布 |
| 评论挖掘 | 情感分析 + 9 类主题聚类 |
| 机器学习 | GradientBoosting 预测歌曲潜力评分（1-3 分） |
| 歌词词云 | 多歌手歌词高频词可视化 |
| 地图展示 | 歌手归属地分布热力图 |

## 技术架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  React 前端  │────▶│  Node 后端    │────▶│   MySQL     │
│  Vite+ECharts│◀────│  Express API  │────│  数据库      │
└─────────────┘     └──────┬───────┘     └─────────────┘
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
- **交互**: 拖拽式面板布局

### 后端
- **运行时**: Node.js + Express
- **数据库**: MySQL (mysql2)
- **爬虫**: Puppeteer + 网易云音乐 API
- **中文分词**: nodejieba

### 机器学习
- **框架**: scikit-learn
- **模型**: GradientBoosting 分类器
- **任务**: 歌曲潜力评分预测（3 分类）

## 快速开始

### 环境要求
- Node.js >= 18
- Python >= 3.9
- MySQL >= 8.0

### 1. 克隆项目
```bash
git clone <your-repo-url>
cd MusicViz
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

### 3. 安装依赖
```bash
# 后端依赖
cd server
npm install

# 前端依赖（新终端）
cd client
npm install
```

### 4. 初始化数据库
```bash
cd server
node seed.js    # 创建表结构 + 导入初始数据
```

### 5. 启动服务（两个终端）

**终端 1 — 启动后端 API 服务**（端口 3001）
```bash
cd server
npm run dev
```
> 后端提供所有数据接口：歌手爬取、图表数据、评论分析、ML 预测等

**终端 2 — 启动前端开发服务器**（端口 5173）
```bash
cd client
npm run dev
```
> 前端自动代理 API 请求到后端 3001 端口

启动后访问 http://localhost:5173 即可使用。

### 6. 运行 ML 模型（可选）
```bash
cd server
python3 ml_pipeline.py    # 训练模型并生成 ml_result.json
```

## 项目结构

```
.
├── client/                     # 前端 React 应用
│   ├── src/
│   │   ├── components/        # 图表组件（15+ 种可视化）
│   │   │   ├── BarChart.jsx
│   │   │   ├── BubbleChart.jsx
│   │   │   ├── DonutChart.jsx
│   │   │   ├── GroupedBarChart.jsx
│   │   │   ├── HeatmapChart.jsx
│   │   │   ├── LineChart.jsx
│   │   │   ├── LyricWordCloud.jsx
│   │   │   ├── MapChart.jsx
│   │   │   ├── MLScoreCard.jsx
│   │   │   ├── MultiLineChart.jsx
│   │   │   ├── PieChart.jsx
│   │   │   ├── RadarChart.jsx
│   │   │   ├── RankingChart.jsx
│   │   │   ├── ScatterChart.jsx
│   │   │   ├── SentimentAnalysisCard.jsx
│   │   │   ├── StackedBarChart.jsx
│   │   │   ├── TopicClusterCard.jsx
│   │   │   └── TrendAnalysisChart.jsx
│   │   ├── hooks/             # 自定义 Hook（拖拽布局）
│   │   ├── styles/            # 全局样式
│   │   ├── App.jsx            # 主应用
│   │   ├── api.js             # API 请求封装
│   │   ├── ThemeContext.jsx   # 主题上下文
│   │   └── utils.js           # 工具函数
│   └── package.json
├── server/                     # 后端服务
│   ├── routes/
│   │   └── api.js            # API 路由
│   ├── artist_crawler.js      # 歌手数据爬虫
│   ├── comment_analyzer.py     # 评论分析（情感+主题）
│   ├── crawler.js             # 通用爬虫
│   ├── db.js                  # 数据库配置
│   ├── index.js               # 服务入口
│   ├── ml_pipeline.py          # ML 训练管道
│   ├── ml_predict.py          # ML 实时预测
│   ├── scraper.js             # 数据抓取
│   ├── seed.js                # 数据库初始化
│   └── package.json
├── chart_codes/               # 图表代码截图（报告用）
├── ML_TRAINING_LOG.md         # ML 训练日志
├── 图表代码汇总.md             # 图表代码汇总
└── README.md
```

## 可视化图表清单（15 张）

| # | 图表 | 组件 | 说明 |
|---|------|------|------|
| 1 | 雷达图 | RadarChart | 多歌手指标对比 |
| 2 | 排名图 | RankingChart | Top10 歌曲评论数 |
| 3 | 分组柱状图 | GroupedBarChart | 听众活跃度对比 |
| 4 | 折线图 | LineChart | 年代/排名趋势 |
| 5 | 多折线图 | MultiLineChart | 热度衰减对比 |
| 6 | 趋势分析图 | TrendAnalysisChart | Top10 热度衰减 |
| 7 | 散点图 | ScatterChart | 歌手规模x热度 |
| 8 | 气泡图 | BubbleChart | 作品量×热度×互动 |
| 9 | 饼图 | PieChart | 风格标签分布 |
| 10 | 环形图 | DonutChart | 年代分布 |
| 11 | 堆叠柱状图 | StackedBarChart | 风格演变 |
| 12 | 地图 | MapChart | 歌手地理分布 |
| 13 | 热力图 | HeatmapChart | 歌手×年代 |
| 14 | 词云 | LyricWordCloud | 歌词高频词 |
| 15 | ML 评分表 | MLScoreCard | 歌曲潜力评分 |

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `artists` | 歌手信息（ID、名称、地区、歌曲数、专辑数等） |
| `songs` | 歌曲信息（ID、名称、歌手ID、播放量、评论数、时长、年份等） |
| `comments` | 评论信息（ID、歌曲ID、内容、点赞数、用户ID等） |

## 机器学习说明

### 任务定义
预测歌曲的潜力评分（1-3 分），基于评论数/播放量比值的分位数分档：

| 评分 | 含义 | 业务价值 |
|------|------|----------|
| 1 分 | 低潜力（播放高但评论少 → 被高估） | 需要反思推广策略 |
| 2 分 | 中等潜力 | 表现正常 |
| 3 分 | 高潜力（播放低但评论多 → 潜力股） | 值得推广 |

### 特征工程
- **原始特征**: 播放量、歌曲时长、发布年份、歌手总歌曲数、总专辑数
- **构造特征**: `log_plays`、`sqrt_plays`、`era`、`productivity`、`is_long_song` 等共 12 个
- **特征选择**: ANOVA F 检验 (SelectKBest)，最终保留 10 个特征
- **标准化**: StandardScaler

### 模型评估
- **测试准确率**: 72.6%
- **交叉验证准确率**: 73.9%
- **±1 容错准确率**: 98.7%
- **最佳模型**: GradientBoosting (n_estimators=100, max_depth=5)

详见 [ML_TRAINING_LOG.md](./ML_TRAINING_LOG.md)

## 数据来源

- 歌手信息、歌曲数据、评论数据均来自 **网易云音乐公开 API**
- 地图数据使用 ECharts 内置 GeoJSON
- 仅供学习研究使用，请勿用于商业用途

## License

MIT
