# Dida365 GPT 任务助手

一个前后端一体的工具，帮助你把 Markdown 任务草稿交给 GPT 美化、补充说明，然后一键推送到滴答清单 (Dida365) 的指定项目里。支持临时覆盖 OpenAI 的 Base URL / API Key，提交结果与错误提示均以右上角浮窗提醒。

## 功能点速览

- OAuth 代码换取 Access Token（支持自定义 clientId / secret / redirect 以覆盖 `.env` 默认值）
- 一键 OAuth 授权：弹窗打开滴答登录，回调后自动交换 code 并缓存 token，401 时自动刷新 token 再重试
- Markdown 粘贴 + GPT 美化输出任务，同时给出简述、详细说明、子任务、优先级、建议时间等
- 可视化任务编辑：支持手动补充提醒、标签、子任务等，可一键清空当前任务列表
- 批量创建直接提交，结果按任务逐条浮窗提示（成功/失败）
- AI 调用可指定自定义 OpenAI base URL / API key，兼容私有化或代理部署

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并按需填写：

```
cp .env.example .env
```

关键字段说明：

- `OPENAI_API_KEY`：默认 GPT key，可在页面里临时覆盖
- `OPENAI_BASE_URL`：可选，针对代理或自建模型服务（默认 `https://api.openai.com/v1`）
- `OPENAI_MODEL`：默认 `gpt-5.2`
- `DIDA_CLIENT_ID` / `DIDA_CLIENT_SECRET`：滴答开放平台控制台里的 OAuth 配置
- `DIDA_REDIRECT_URI`：需在滴答控制台中同步配置，可使用 `https://<你的域名>/oauth/callback` 或 `https://<你的域名>/api/oauth/callback`（两个路径均受控且长度 < 64 字）。如在远程 IDE 平台，页面会自动展示这两个可拷贝的地址。

### 3. 启动服务

开发模式（自动重载）：

```bash
npm run dev
```

或生产模式：

```bash
npm start
```

启动后访问 `http://localhost:4000/` 即可看到 UI。

## 使用流程

1. **OAuth 授权**：点击「自动打开滴答授权」按钮，页面会弹出滴答官方的授权窗口。登录并授权后会自动交换 code、写入 Access Token 并缓存 `oauthState`，后续创建时无需再手动粘贴 Token。如需手动流程，可使用下方表单通过 `code` 交换（`Redirect URI` 输入框提供 `/oauth/callback` 与 `/api/oauth/callback` 两种短链，满足滴答 64 字限制）。
2. **粘贴任务**：把 Markdown 列表粘贴到「2. 粘贴原始任务」，点击「AI 整理」。需要重置时可用「清空所有任务」按钮。
3. **AI 接入配置（可选）**：如需临时切换 OpenAI base URL 或 API key，可在 2.1 区域填写，这些值只保存在浏览器内存。
4. **编辑任务**：在「3. 校对 / 编辑」里调整标题、简述、说明、优先级、计划时间、子任务等。
5. **填写项目信息**：在「4. 推送到 Dida 项目」内填写 Access Token（可来自第一步）、项目 ID、默认提醒、时区等。
6. **批量创建**：
   - 点击「提交到滴答清单」直接逐条调用 `POST https://api.dida365.com/open/v1/task`，每条结果都会通过右上角浮窗提示（成功或失败原因）。
   - 若滴答 API 返回 401，程序会自动使用 refresh token 重新获取 Access Token 并继续重试。必要时会提示你重新授权。

## 常见问题

- **能否使用其他模型提供商？** 可以，填入自定义 Base URL + API key 即可，只要兼容 OpenAI Responses API。
- **数据是否持久化？** 页面里的敏感信息（OpenAI key、Access Token 等）仅存于当前会话，刷新后会消失；如需长期保存请自行扩展。
- **如何获取项目 ID？** 可以调用 Dida OpenAPI 的 `GET /open/v1/project`，或在滴答网页版/客户端的项目设置里查看。

## 脚本说明

| 脚本       | 说明                       |
| ---------- | -------------------------- |
| `npm run dev`   | 使用 nodemon 启动后端，便于开发 |
| `npm start`     | 直接运行 `node src/server.js` |

欢迎根据需要扩展更多功能，例如项目列表自动拉取、任务同步状态展示等。*** End Patch
