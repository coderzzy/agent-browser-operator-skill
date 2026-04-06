---
name: browser-operator
description: 远程控制 Chrome 浏览器，执行标签页管理、页面操作和自动化任务。当用户需要控制浏览器、管理标签页、获取页面内容或执行浏览器自动化操作时触发。
license: Apache-2.0
compatibility: 需要本地启动 Browser Operator Server (Node.js) 和 Chrome 扩展
metadata:
  version: "1.0.0"
  author: agent-browser-operator-skill
---

# Browser Operator Skill

## 简介

让 AI Agent 能够远程控制用户正在使用的 Chrome 浏览器，执行标签页管理、页面操作等任务。

**核心优势：**
- 接管用户已有的 Chrome 浏览器（而非启动新实例）
- 继承用户的登录态、Cookie 和浏览器权限
- 可访问需要登录的页面内容
- 用户可实时看到 AI 的操作

---

## 前置检查

在使用本 Skill 之前，**必须**执行以下检查：

### 1. 服务状态检查

```bash
curl http://localhost:3333/health
```

**预期响应：**
```json
{
  "status": "ok",
  "service": "running"
}
```

**失败处理：**
如果无法连接，提示用户启动服务：
> "请先启动 Browser Operator Server：cd server && npm run dev"

### 2. 扩展连接检查

```bash
curl http://localhost:3333/check
```

**关键字段：** `extensionConnected` 必须为 `true`

**失败处理：**
如果为 `false`，提示用户：
> "Chrome 扩展未连接，请确保：\n1. 已在 Chrome 中加载扩展\n2. 点击扩展图标连接到服务器\n3. 刷新页面重试"

---

## 能力清单

### ✅ 可用能力

| 能力 | 端点 | 说明 |
|------|------|------|
| 获取标签页列表 | `GET /api/tabs` | 获取所有打开的标签页 |
| 获取活动标签页 | `GET /api/tabs/active` | 获取当前激活的标签页 |
| 打开新标签页 | `POST /api/tabs/open` | 打开指定 URL |
| 关闭标签页 | `POST /api/tabs/close` | 关闭指定标签页 |
| 激活标签页 | `POST /api/tabs/activate` | 切换到指定标签页 |
| 刷新标签页 | `POST /api/tabs/reload` | 刷新指定标签页 |
| 执行脚本 | `POST /api/tabs/execute-script` | 执行 JavaScript |
| 获取页面内容 | `GET /api/tabs/{tabId}/content` | 获取 HTML 内容 |

### ❌ 不支持的能力

- 截图
- 模拟鼠标点击坐标
- 模拟键盘输入
- 文件上传/下载
- Cookie/LocalStorage 管理

---

## 使用示例

### 获取所有标签页

```bash
curl http://localhost:3333/api/tabs
```

### 打开新标签页

```bash
curl -X POST http://localhost:3333/api/tabs/open \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com"}'
```

### 执行脚本

```bash
curl -X POST http://localhost:3333/api/tabs/execute-script \
  -H "Content-Type: application/json" \
  -d '{
    "tabId": 123,
    "script": "document.title"
  }'
```

---

## 规则与约束

1. **必须先检查服务状态** - 调用任何 API 前确保 Server 和扩展已连接
2. **处理用户登录态** - 可以访问用户已登录的页面，但不要泄露敏感信息
3. **标签页 ID 会变化** - 每次操作后重新获取标签页列表
4. **脚本执行限制** - 受 Chrome 扩展权限限制，某些操作可能失败
5. **用户可见** - 所有操作都在用户浏览器中实时可见

---

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| 无法连接 Server | 检查服务是否启动 `npm run dev` |
| 扩展未连接 | 点击 Chrome 扩展图标，点击「连接服务器」 |
| 脚本执行失败 | 检查页面是否允许扩展访问 |
| 获取内容为空 | 页面可能尚未完全加载，等待后重试 |
