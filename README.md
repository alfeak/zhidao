# 知道 (Zhidao) - 开放式学术论文阅读与 AI 协同分析平台

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Styling-TailwindCSS%20v4-38B2AC.svg)](https://tailwindcss.com/)

**“知道” (Zhidao)** 是一个开放式的学术论文阅读与 AI 协同分析平台。平台支持在线 PDF 导入、ArXiv 论文元数据解析、MinerU 智能文档语义解码（Markdown 块分段与索引）、交互式双栏/单栏句读点选阅读、多视角大语言模型（LLM）深度解析（全文翻译、总结、段落精读、自定义 Prompt 交互）以及多维度的批注高亮与协同讨论。

---

## 🌟 核心功能特性

1. **📄 多源论文在线导入与解析**
   - 支持直接输入论文 PDF 链接或 ArXiv 链接/ID。
   - 自动集成 ArXiv API 解析标准论文标题，回退支持 URL 文件名自动清理与格式化。

2. **🧩 MinerU 语义级文档解码**
   - 接入 MinerU 高精云端解析 API，将复杂的 PDF 格式完美转化为结构化 Markdown 块。
   - 完整保留并渲染数学公式（LaTeX/KaTeX）、代码块、表格、流程图及内嵌高清图片。

3. **📖 交互式句读点选与双栏 Reader**
   - **句读点选 (Block-level Reader)**：点击 Markdown 任一段落或句子，高亮显示并直接触发针对性 AI 分析。
   - **双栏同步模式 (Split Reader)**：左侧原汁原味 PDF 预览（基于 react-pdf），右侧结构化解码 Markdown，提升科研精读效率。

4. **🤖 多视角 LLM 深度协同解析**
   - **全文/段落翻译**：准确流畅的学术级双语翻译。
   - **全文总结与核心发现提取**：快速掌握论文的研究背景、方法与实验结论。
   - **MD 块深度解析**：针对难点段落、公式推导进行一步步解释说明。
   - **自定义对话与 Prompt 扩展**：内置 OpenAI 兼容网关，支持 GPT-4o、DeepSeek、Claude 等大模型接入。

5. **✍️ 批注高亮与研讨记录**
   - 支持为论文段落添加多色高亮批注与笔记。
   - 具备历史对话与研讨记录持久化存储。

6. **☁️ 云端/本地混合存储架构**
   - **云端对象存储**：集成 Cloudflare R2 (S3 兼容协议)，实现 PDF 资源、解码 Markdown 与抽取图片的低延迟分发。
   - **轻量本地数据库**：SQLAlchemy 2.0 + SQLite，管理论文元数据、批注与模型配置。

---

## 🏗️ 项目架构与目录结构

```text
zhidao/
├── backend/                         # FastAPI 后端服务
│   ├── app/
│   │   ├── application/             # 业务逻辑与应用服务
│   │   │   ├── paper_title_resolver.py # ArXiv 元数据解析器
│   │   │   └── services.py             # 论文管理、MinerU 异步解码服务
│   │   ├── domain/                  # 领域实体与异常定义
│   │   ├── infrastructure/          # 基础设施层
│   │   │   ├── database.py             # SQLite 数据库引擎
│   │   │   ├── mineru_client.py        # MinerU API 客户端
│   │   │   ├── object_store.py         # Cloudflare R2 / S3 存储客户端
│   │   │   ├── openai_gateway.py       # OpenAI 兼容模型网关
│   │   │   ├── orm_models.py           # SQLAlchemy 数据模型
│   │   │   └── repositories.py         # 数据持久化 Repository
│   │   ├── api.py                   # RESTful API 路由定义
│   │   └── main.py                  # 应用入口、CORS 与全局异常处理
│   ├── alembic/                     # 数据库 Migration 脚本
│   ├── tests/                       # Pytest 单元与集成测试
│   ├── requirements.txt             # 后端 Python 依赖列表
│   └── pytest.ini                   # Pytest 配置文件
├── frontend/                        # React + TypeScript 前端应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── ImportModule.tsx     # 论文导入弹窗
│   │   │   ├── LLMActionBar.tsx     # 浮动 AI 快捷操作栏
│   │   │   ├── LLMSidebar.tsx       # AI 侧边栏（Chat/结果/批注/设置）
│   │   │   ├── MarkdownRenderer.tsx # 基于 KaTeX 的 Markdown 渲染器
│   │   │   ├── PaperList.tsx        # 论文列表与管理侧边栏
│   │   │   └── ReaderCore.tsx       # PDF 与 Markdown 阅读器核心
│   │   ├── App.tsx                  # 主应用组件与状态调度
│   │   ├── index.css                # 全局样式与 Tailwind 配置
│   │   └── types.ts                 # TypeScript 类型定义
│   ├── package.json                 # 前端依赖配置
│   ├── vite.config.ts               # Vite 构建配置
│   └── tsconfig.json                # TypeScript 编译配置
├── metadata.json                    # 平台元数据说明
└── README.md                        # 项目说明文档
```

---

## 🛠️ 技术栈 (Tech Stack)

### 后端 (Backend)
- **核心框架**: Python 3.10+ / [FastAPI](https://fastapi.tiangolo.com/) / [Uvicorn](https://www.uvicorn.org/)
- **数据库 & ORM**: SQLite / [SQLAlchemy 2.0](https://www.sqlalchemy.org/) / [Alembic](https://alembic.sqlalchemy.org/)
- **文档解析**: [MinerU API](https://mineru.net/) (PDF 转化为 Markdown / HTML / 图像)
- **对象存储**: [Cloudflare R2](https://www.cloudflare.com/developer-platform/r2/) via [Boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
- **网络与并发**: [HTTPX](https://www.python-httpx.org/) (异步 API 请求处理)

### 前端 (Frontend)
- **构建框架**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **UI 样式与动画**: [Tailwind CSS v4](https://tailwindcss.com/) / [Motion](https://motion.dev/) / [Lucide React](https://lucide.dev/)
- **PDF & 渲染引擎**: [react-pdf](https://github.com/wojtekmaj/react-pdf) / [react-markdown](https://github.com/remarkjs/react-markdown)
- **数学公式支持**: [KaTeX](https://katex.org/) / `rehype-katex` / `remark-math`

---

## 🚀 快速开始 (Getting Started)

### 前置准备
- **Python**: 3.10 及以上版本
- **Node.js**: 18.0 及以上版本 (推荐 pnpm / npm)
- **MinerU API Token**: 用于 PDF 解码服务 (注册获取于 [MinerU 官网](https://mineru.net/))
- **Cloudflare R2 密钥**: Access Key ID, Secret Access Key, Bucket 名称与 Endpoint

---

### 1. 后端配置与启动

1. 进入 `backend` 目录：
   ```bash
   cd backend
   ```

2. 创建并激活虚拟环境（可选但推荐）：
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```

3. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```

4. 配置环境变量（在 `backend` 根目录新建 `.env` 文件）：
   ```env
   # MinerU API 配置
   MINERU_API_TOKEN=your_mineru_api_token
   MINERU_API_BASE_URL=https://mineru.net/api/v4

   # Cloudflare R2 对象存储配置
   R2_BUCKET=your_r2_bucket_name
   R2_ACCESS_KEY_ID=your_r2_access_key_id
   R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
   R2_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   R2_PREFIX=mineru
   ```

5. 启动 FastAPI 后端服务：
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   后端服务启动后可访问 API 文档：`http://localhost:8000/docs`

---

### 2. 前端配置与启动

1. 打开新的终端，进入 `frontend` 目录：
   ```bash
   cd frontend
   ```

2. 安装前端依赖：
   ```bash
   npm install
   ```

3. 启动 Vite 开发服务器：
   ```bash
   npm run dev
   ```

4. 访问前端页面：在浏览器打开 `http://localhost:5173`

---

## 🔌 API 核心接口一览

| HTTP 方法 | 路径 | 功能说明 |
| :--- | :--- | :--- |
| `GET` | `/api/papers` | 获取论文列表 |
| `POST` | `/api/papers/import` | 导入论文 (支持 ArXiv URL 或 PDF 直链) |
| `POST` | `/api/papers/{paper_id}/decode` | 触发 MinerU 异步解码论文 |
| `GET` | `/api/papers/{paper_id}/markdown` | 获取解码后的 Markdown 内容 |
| `GET` | `/api/papers/{paper_id}/file` | 获取标准 PDF 预览文件流 |
| `GET` | `/api/papers/{paper_id}/assets/{path}` | 获取 MinerU 提取的公式/图表图片 |
| `POST` | `/api/papers/{paper_id}/action` | 触发针对特定段落/全文的 LLM 解析动作 |
| `GET` / `POST` | `/api/config` | 获取 / 更新大模型 API 密钥与配置 |
| `POST` | `/api/config/test-model` | 测试模型连通性 |
| `GET` / `POST` | `/remarks` | 获取或创建段落高亮批注 |

---

## 📄 开源许可证

本项目遵循 Apache 2.0 许可证。详情请参阅 [LICENSE](LICENSE) 文件。
