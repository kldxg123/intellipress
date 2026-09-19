# IntelliPress LLM 安全代理（Cloudflare Worker）

让 GitHub Pages 静态版演示站也能走 DeepSeek 真实推理：浏览器请求先打到本 Worker，
由 Worker 注入密钥转发 `https://api.deepseek.com/chat/completions`，SSE 流式原样透传。
密钥只存在 Workers secret，绝不进入前端 bundle 或 git 仓库。

## 安全设计

- **Origin 白名单**：仅放行 `https://kldxg123.github.io` 与 localhost/127.0.0.1 开发源；
  无 Origin/Referer 或非白名单一律 403；OPTIONS 预检正确应答（204 + CORS 头）
- **单一端点**：仅接受 `POST /chat/completions`，其余方法与路径一律 404
- **请求体消毒**：强制 `model: "deepseek-chat"`、`stream: true`；`max_tokens` 封顶 800；
  `messages` 总字符数封顶 4000（超出 413）；`temperature` 钳制 [0, 2]
- **密钥零暴露**：仅读 `env.DEEPSEEK_API_KEY`（Workers secret），代码中无任何硬编码密钥

## 部署步骤（需要 Cloudflare 账户 + API token 到位后执行）

```bash
cd worker
npm install                      # 安装 wrangler（已 pin 4.38.0）

npx wrangler login               # 或设置 CLOUDFLARE_API_TOKEN 环境变量

# 写入 DeepSeek 密钥（交互式粘贴，不会落盘入库）
npx wrangler secret put DEEPSEEK_API_KEY

# 部署
npx wrangler deploy
# 输出形如：https://intellipress-llm-proxy.<账户子域>.workers.dev
```

部署成功后，把 Worker URL 填入前端生产环境变量（仓库根目录）：

```bash
# 编辑 ../.env.production：
VITE_LLM_PROXY_URL=https://intellipress-llm-proxy.<账户子域>.workers.dev
```

然后 `git push` 到 main，GitHub Actions 会自动重建并发布 Pages；
之后公网版阶段 2 即显示「● 实时解读 · DeepSeek」（URL 留空时则自动回放兜底）。

## 本地验证

```bash
cd worker
printf 'DEEPSEEK_API_KEY=test\n' > .dev.vars   # 假密钥，仅本地，已 gitignore
node verify-local.mjs                          # 起 wrangler dev + 24 项安全用例断言
```

用例覆盖：白名单转发链路（假 key 得上游 401）、非白名单/无 Origin 403、OPTIONS 预检、
错误方法与路径 404、messages 超长 413、非法 JSON 400，以及消毒/白名单纯函数单测。
