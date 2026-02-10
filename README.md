# Didauto — AI 驱动的滴答清单批量任务助手

> 把 Markdown 待办清单粘贴进来，AI 自动整理成结构化任务，一键批量推送到 [滴答清单 (Dida365)](https://dida365.com)。

```
Markdown 草稿  →  AI 智能整理  →  可视化编辑  →  一键推送到滴答清单
```

## 目录

- [功能概览](#功能概览)
- [快速开始](#快速开始)
- [使用流程](#使用流程)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [脚本说明](#脚本说明)
- [常见问题](#常见问题)
- [故障排查](#故障排查)
- [安全须知](#安全须知)

## 功能概览

- **AI 智能整理**：粘贴 Markdown 待办列表，AI 自动补充标题、描述、子任务、优先级、建议时间等
- **可视化编辑**：在提交前手动调整任务的标题、描述、优先级、计划时间、子任务、提醒等
- **批量推送**：一次性将多个任务推送到滴答清单的指定项目
- **OAuth 一键授权**：弹窗完成滴答登录，自动获取并缓存 Token，过期自动刷新
- **项目管理**：查看滴答清单项目列表，浏览项目下的任务，支持标记完成
- **提交记录**：所有提交历史持久化到本地 SQLite 数据库，支持按时间区间筛选
- **自定义 AI 配置**：支持自定义 OpenAI Base URL / API Key / 提示词模板，兼容各种 OpenAI API 兼容的模型服务

## 快速开始

### 前置条件

- **Node.js** >= 18（[下载地址](https://nodejs.org/)）
- 一个 **OpenAI API Key**（或兼容的第三方 API Key）
- 一个 **滴答清单开放平台应用**（用于 OAuth 授权，下面会教你创建）

### 第 1 步：克隆并安装依赖

```bash
git clone <your-repo-url>
cd didauto
npm install
```

> Windows 用户：如果 `better-sqlite3` 安装失败，请确保已安装 [Python 3](https://www.python.org/) 和 C++ 构建工具（`npm install --global windows-build-tools`）。

### 第 2 步：创建滴答清单 OAuth 应用

1. 访问 [滴答清单开放平台](https://developer.dida365.com)，注册并登录
2. 创建一个新应用，权限范围（Scope）需包含 `tasks:read` 和 `tasks:write`
3. 在应用设置中，将 **Redirect URI** 设置为 `http://localhost:4000/oauth/callback`（注意：滴答限制 URI 长度不超过 64 个字符）
4. 记下 **Client ID** 和 **Client Secret**，下一步要用

### 第 3 步：配置环境变量

```bash
cp .env.example .env
```

> Windows PowerShell 用户使用：`Copy-Item .env.example .env`

用编辑器打开 `.env`，填写以下配置：

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `OPENAI_API_KEY` | **是** | — | OpenAI API Key（或兼容服务的 Key） |
| `DIDA_CLIENT_ID` | **是** | — | 滴答开放平台的 Client ID |
| `DIDA_CLIENT_SECRET` | **是** | — | 滴答开放平台的 Client Secret |
| `PORT` | 否 | `4000` | 服务端口 |
| `OPENAI_BASE_URL` | 否 | `https://api.openai.com/v1` | OpenAI API 地址，填到 `/v1` 即可，**不要**带 `/chat/completions` 或 `/responses` |
| `OPENAI_MODEL` | 否 | `gpt-5.2` | AI 模型名称 |
| `DIDA_REDIRECT_URI` | 否 | `http://localhost:4000/oauth/callback` | OAuth 回调地址，需与滴答控制台一致 |
| `TIME_SOURCE` | 否 | `Asia/Shanghai` | 时区设置，设为 `Local` 使用系统本地时区 |

### 第 4 步：启动服务

```bash
npm run dev
```

启动后浏览器访问 **http://localhost:4000** ，看到页面即表示成功。

> **预期结果**：页面顶部显示「授权」按钮，左侧有 Markdown 输入区。如果看到页面但 AI 功能报错，请检查 `OPENAI_API_KEY` 是否正确。

**生产模式部署**：

```bash
npm run build   # 先构建前端
npm start       # 启动服务
```

## 使用流程

### 1. 授权滴答清单

点击页面上的「授权」按钮，会弹出滴答清单的登录授权页面。登录并授权后，Token 会自动获取并缓存，后续无需重复操作。Token 过期时会自动刷新。

### 2. 粘贴 Markdown 任务

在输入区粘贴你的 Markdown 待办列表，例如：

```markdown
- [ ] 明天上午 10 点开项目周会
- [ ] 周五前完成设计稿评审
- [x] 已完成：整理会议纪要
```

### 3. AI 整理

点击「AI 整理」，AI 会自动将 Markdown 转换为结构化任务：

**输入**：
```markdown
- [ ] 明天下午3点和产品经理开会讨论需求
```

**AI 整理后**：
- 标题：`和产品经理开会讨论需求`
- 描述：补充了会议准备事项的建议
- 计划时间：自动解析为明天 15:00
- 项目：自动匹配到最合适的滴答项目
- 优先级：中

### 4. 编辑和调整

在任务卡片中可以手动修改任何字段：标题、描述、优先级、计划时间、子任务、提醒等。

### 5. 推送到滴答清单

选择目标项目，点击「提交到滴答清单」，任务会逐条创建，每条结果通过浮窗提示成功或失败。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Ant Design 5 + Vite |
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| AI | OpenAI SDK（兼容任何 OpenAI API 兼容服务） |

## 项目结构

```
didauto/
├── src/
│   ├── server.js          # Express 后端主入口（API 路由 + 静态文件托管）
│   ├── db.js              # SQLite 数据库操作
│   └── sync.js            # 定时同步逻辑
├── web/
│   └── src/
│       ├── App.tsx         # 前端主页面
│       ├── api.ts          # 前端 API 封装
│       └── components/     # UI 组件
│           ├── PageHeader.tsx         # 页面顶栏
│           ├── RawInputSection.tsx    # Markdown 输入区
│           ├── TasksSection.tsx       # 任务列表区
│           ├── TaskCard.tsx           # 单个任务卡片
│           ├── SubmitBar.tsx          # 提交操作栏
│           ├── OauthModal.tsx         # OAuth 授权弹窗
│           ├── AiSettingsModal.tsx    # AI 配置弹窗
│           ├── PromptSettingsModal.tsx # 提示词设置弹窗
│           ├── ProjectsView.tsx       # 项目列表视图
│           ├── SubmissionsView.tsx     # 提交记录视图
│           └── ConfirmModal.tsx       # 确认弹窗
├── data/                  # 运行时数据（自动生成，含 SQLite 数据库和 Token 缓存）
├── .env                   # 环境变量配置（需手动创建，不要提交到 Git）
└── .env.example           # 环境变量模板
```

## 脚本说明

| 脚本 | 说明 |
|------|------|
| `npm run dev` | 使用 nodemon 启动后端（开发模式，文件修改后自动重启） |
| `npm start` | 直接运行 `node src/server.js`（生产模式） |
| `npm run build` | 构建前端静态资源到 `dist/` |
| `npm run client:dev` | 单独启动 Vite 前端开发服务器 |

## 常见问题

**Q: 能否使用 ChatGPT 以外的模型？**
A: 可以。只要兼容 OpenAI API 格式（Chat Completions 或 Responses API），填入对应的 Base URL 和 API Key 即可。也可以在页面上临时切换，无需修改 `.env`。

**Q: 如何自定义 AI 的提示词？**
A: 点击页面上的提示词设置按钮，可以直接修改 System Hint 和 User Template。修改会持久化到 `.env` 文件。

**Q: 如何获取滴答项目 ID？**
A: 授权后，页面上的「项目」视图会自动拉取你的项目列表。也可以调用滴答 OpenAPI 的 `GET /open/v1/project` 获取。

**Q: 数据存在哪里？**
A: 提交记录和项目任务数据持久化在本地 SQLite 数据库（`data/` 目录）。OAuth Token 缓存在 `data/oauthSessions.json`。页面上临时填写的 API Key 等敏感信息仅存于浏览器内存，刷新后消失。

## 故障排查

| 现象 | 可能原因 | 解决方法 |
|------|----------|----------|
| OAuth 授权后报错 "redirect_uri mismatch" | 滴答控制台中的 Redirect URI 与 `.env` 中的 `DIDA_REDIRECT_URI` 不一致 | 确保两处完全相同，包括端口号和路径 |
| AI 整理报 500 错误 | `OPENAI_API_KEY` 无效或 `OPENAI_BASE_URL` 配置错误 | 检查 Key 是否有效，Base URL 是否填到 `/v1`（不要带 `/responses`） |
| 启动时端口被占用 | 其他程序占用了配置的端口 | 修改 `.env` 中的 `PORT` 为其他值（如 `3000`），同时更新 `DIDA_REDIRECT_URI` 中的端口并同步到滴答控制台 |
| `npm install` 失败（better-sqlite3） | 缺少 C++ 编译工具链 | macOS: `xcode-select --install`；Windows: 安装 windows-build-tools |
| 提交任务返回 401 | OAuth Token 已过期且自动刷新失败 | 重新点击「授权」按钮完成授权 |
| 代理连接报 "connection refused" | 系统配置了代理但代理软件未运行 | 启动代理软件，或取消系统代理设置 |

## 安全须知

- `.env` 文件包含 API Key 和 OAuth 密钥等敏感信息，**不要提交到 Git**（已在 `.gitignore` 中排除）
- `data/` 目录包含 OAuth Token 和本地数据库，建议不要公开分享
- 页面上临时输入的 API Key 仅存于浏览器内存，刷新即消失，不会发送到除 AI 服务以外的任何地方

## 下一步

完成基本使用后，你还可以探索这些功能：

- **自定义提示词**：点击页面上的提示词设置按钮，调整 AI 整理任务的行为和输出格式
- **项目管理**：在「项目」视图中浏览所有滴答项目及其任务，直接标记完成
- **提交记录**：在「提交记录」视图中按时间区间筛选历史提交，追踪任务创建情况
- **临时切换 AI 服务**：在页面上临时修改 Base URL 和 API Key，无需重启服务

## License

ISC
