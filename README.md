# 知道 (Zhidao) — 智能文献阅读与深度理解平台

<p align="center">
  <img src="https://img.shields.io/badge/License-Apache--2.0-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React-18+-61DAFB.svg?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4+-06B6D4.svg?logo=tailwindcss&logoColor=white" alt="TailwindCSS" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED.svg?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/MinerU-Powered-FF6F00.svg" alt="MinerU" />
</p>

---

## 📌 项目简介

**知道（Zhidao）** 是一款专为科研人员与学术爱好者打造的智能文献阅读与交互平台。支持在线 PDF / arXiv 一键导入，利用 **MinerU** 提取极高精度的 Markdown 正文与 Bounding Box 版面坐标，并在 **PDF 原文、原始 Markdown、全文翻译** 三视图间实现毫米级同步平移、双向定位与深度标注。集成 LLM 论文对话助手，全量论文上下文随心提问。

---

## ✨ 核心特性

- 🚀 **一键论文导入与 MinerU 解析**：支持 PDF 直链与 arXiv 论文 URL，后台异步提交 MinerU 排版识别。
- 🔍 **三视图同步平移与交互**：支持 PDF 双面渲染、原始 Markdown 独立缩放、全篇翻译视图，毫米级 2D 拖拽与滚轮按需缩放。
- 📍 **Bbox 版面精确定位与跨视图跳转**：根据 MinerU 提取的 `content_list` bbox 坐标在 PDF 上叠加交互框，支持右键跳转与交互备注。
- 🎨 **多色高亮备注**：备注基于 Markdown 块索引持久化存储，在 PDF 交互框、原文及译文中全端同步展示。
- 🌐 **全文多语言异步翻译**：内置状态机持久化管理，支持多语言全文翻译，支持服务重启后自动接续。
- 💬 **上下文感知 AI 论文助手**：右侧抽屉式 AI 对话面板，全量 Markdown 文本作为 Context 随心问答，历史对话持久化存储。
- 🔒 **全隔离多 Profile 用户配置**：API Key、MinerU Token、R2 存储凭据完全绑定当前账号，支持多配置 Profile 管理与实时健康检测 (Health Test)。
- 🔎 **本地全文检索 (FTS5)**：SQLite FTS5 `trigram` 高效检索，秒级匹配论文、Markdown 正文及翻译词句。

---

## 🛠️ 技术栈

| 模块 | 技术选型 |
| --- | --- |
| **后端框架** | Python 3.11+ / FastAPI / SQLAlchemy |
| **数据库 & 检索** | SQLite 3 / FTS5 (Trigram Tokenizer) |
| **文档解析 & 存储** | MinerU API v4 / Cloudflare R2 (S3 兼容协议) |
| **大模型 Gateway** | OpenAI 兼容 Endpoint (DeepSeek / OpenAI / 任意兼容接口) |
| **前端框架** | React 18 / TypeScript / Vite / Tailwind CSS |
| **阅读器 & 渲染** | react-pdf / PDF.js / react-markdown / KaTeX (LaTeX 数学公式) |
| **容器部署** | Docker / Docker Compose / Nginx |

---

## 🚀 快速启动

### 方式 1：Docker Compose 一键部署（推荐）

1. **配置 Google OAuth**：在仓库根目录下创建 `backend/.env`：
   ```env
   GOOGLE_CLIENT_ID="your_google_client_id"
   GOOGLE_CLIENT_SECRET="your_google_client_secret"
   ```
2. **启动 Docker 服务**：
   ```bash
   docker compose up --build -d
   ```
3. **访问应用**：打开浏览器访问 `http://localhost:5173`，登录后在右上角 **⚙️ 设置** 中配置各服务凭据。

---

### 方式 2：本地开发环境启动

#### 1. 后端启动
```bash
cd backend
python -m venv .venv

# Windows
.\.venv\Scripts\activate
# Linux/macOS
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env # 填写 GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET
uvicorn app.main:app --reload --port 8000
```

#### 2. 前端启动
```bash
cd frontend
npm install
npm run dev
```

---

## ⚙️ 服务配置说明

所有业务凭据（MinerU API Token、大模型 API Key / URL / Model、Cloudflare R2 存储桶）均**无需写入环境变量**，完全通过 Web 界面管理：

登录后点击页面右上角 **⚙️ 设置** 按钮：

| 配置项 | 说明 |
| --- | --- |
| **大模型设置** | 添加多个 LLM Profile（API Key / Base URL / 模型名），设为主配置后用于对话与翻译 |
| **MinerU 解析设置** | 配置 MinerU API Token 与 Base URL，用于 PDF 排版解析 |
| **R2 存储设置** | 配置 Cloudflare R2 Bucket 凭据，用于解析结果与翻译文件的持久化存储 |

每项配置均可点击 **【测试此配置】** 进行实时连通性与鉴权健康检测，通过后点击 **【设为主配置】** 即可生效。

---

## 📄 开源协议

本项目基于 [Apache 2.0 License](LICENSE) 开源。
