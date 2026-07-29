# 知道（Zhidao）

一个面向论文阅读的本地 Web 应用：导入在线 PDF，经 MinerU 解析后，在 PDF、原始 Markdown 和译文之间阅读、标注和检索。

## 当前功能

- 导入论文 URL（PDF 直链或 arXiv 链接），后台异步调用 MinerU 解析。
- 解析产物保存到 Cloudflare R2（S3 兼容）；再次导入同一 URL 时可复用已缓存的产物。
- PDF、原始 Markdown、翻译 Markdown 三种阅读视图。
- MinerU `content_list` 的 bbox 映射：PDF 页上显示可交互区块；点击区块可查看对应 Markdown、切换原文/中文并添加备注。
- Markdown 与 PDF 区块可右键跳转到其他视图的对应位置。
- 备注按原始 Markdown 块索引保存，因此能同时显示在原文、译文和 PDF bbox 上；支持颜色与删除确认。
- 全文翻译：后端维护目标语言列表，使用 OpenAI 兼容接口调用模型；翻译任务具有持久化状态机，服务重启后可恢复。译文保存到 R2，并记录在数据库。
- 本地全文检索：SQLite FTS5 `trigram` 索引 PDF 解析文本、原始 Markdown 与各语言译文；返回按相关度排序的论文结果。
- PDF 阅读器支持 bbox 悬浮交互与拖拽平移。

## 技术栈

- 后端：Python、FastAPI、SQLAlchemy、SQLite、Alembic
- 文档解析：MinerU API
- 对象存储：Cloudflare R2 / 任意 S3 兼容服务（Boto3）
- 全文检索：SQLite FTS5（`trigram` tokenizer）
- 前端：React、TypeScript、Vite、Tailwind CSS、react-pdf、react-markdown、KaTeX

## 项目结构

```text
zhidao/
├── backend/
│   ├── app/
│   │   ├── api.py                 # FastAPI 路由
│   │   ├── application/services.py # 论文、翻译与索引业务逻辑
│   │   └── infrastructure/         # SQLite、R2、MinerU、LLM、FTS5
│   ├── alembic/                    # 数据库迁移
│   └── .env.example
├── frontend/
│   └── src/                        # React 阅读器与论文管理界面
└── docker-compose.yml
```

## 启动

### 1. 后端

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
# Linux/macOS
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env  # Linux/macOS: cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

在 `backend/.env` 中填写至少以下配置：

```env
MINERU_API_TOKEN=""

R2_BUCKET=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
# 二选一：R2_ACCOUNT_ID 或 R2_ENDPOINT_URL
R2_ACCOUNT_ID=""
R2_ENDPOINT_URL=""

DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-v4-pro"
```

后端启动后可访问 `http://localhost:8000/docs` 查看接口文档。

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`。

## Docker Compose

在仓库根目录创建并填写 `backend/.env` 后：

```bash
docker compose up --build
```

前端默认运行在 `http://localhost:5173`，后端运行在 `http://localhost:8000`。

## 主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/papers/import` | 导入论文并后台解析 |
| `GET` | `/api/papers` | 论文列表与解析/翻译状态 |
| `POST` | `/api/papers/{paper_id}/decode` | 重试解析 |
| `GET` | `/api/papers/{paper_id}/file` | 获取 PDF 预览文件 |
| `GET` | `/api/papers/{paper_id}/markdown` | 获取原始 Markdown 块 |
| `GET` | `/api/papers/{paper_id}/markdown?targetLanguage=zh-CN` | 获取指定译文块 |
| `GET` | `/api/papers/{paper_id}/layout-boxes` | 获取 PDF bbox |
| `POST` | `/api/papers/{paper_id}/translations` | 创建全文翻译任务 |
| `GET` | `/api/search?q=关键词` | 按相关度搜索论文 |
| `GET` / `POST` | `/api/papers/{paper_id}/remarks`、`/api/remarks` | 获取/创建备注 |

## 验证命令

```bash
# 前端
cd frontend
npm run lint
npm run build

# 后端
cd ../
python -m compileall -q backend/app
```
