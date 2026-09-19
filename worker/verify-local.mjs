// Worker 本地验证：wrangler dev 起服务 + 安全用例断言 + 纯函数单测
// 用法：cd worker && node verify-local.mjs
import { spawn } from "node:child_process"
import { copyFileSync, mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"

const BASE = "http://127.0.0.1:8787"
const log = (...a) => console.log("[verify-worker]", ...a)
let pass = 0, fail = 0
const ok = (cond, label, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` (${extra})` : ""}`) }
  else { fail++; console.error(`  ✗ ${label} ${extra}`) }
}

const GOOD = "https://kldxg123.github.io"
const VALID_BODY = JSON.stringify({ model: "gpt-999", messages: [{ role: "user", content: "你好" }], max_tokens: 99999, stream: false })

const server = spawn("cmd", ["/c", "npx wrangler dev --port 8787"], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] })
server.stderr.on("data", (d) => process.stdout.write("[wrangler-err] " + d))

async function waitServer(timeoutMs = 60000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try { await fetch(BASE + "/chat/completions", { method: "OPTIONS", headers: { Origin: GOOD } }); return } catch {}
    await new Promise((r) => setTimeout(r, 800))
  }
  throw new Error("wrangler dev 启动超时")
}

try {
  await waitServer()
  log("wrangler dev ready on 8787")

  console.log("■ 路由与 Origin 白名单")
  {
    // 1) 白名单 Origin 正常转发（假 key → 上游 DeepSeek 401，证明转发链路通）
    const r = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Origin: GOOD }, body: VALID_BODY })
    ok(r.status === 401, "白名单 Origin 转发至上游（假 key → 401）", `status ${r.status}`)
    ok(r.headers.get("access-control-allow-origin") === GOOD, "响应携带 CORS 头")
  }
  {
    // 2) 非白名单 Origin → 403
    const r = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://evil.example.com" }, body: VALID_BODY })
    ok(r.status === 403, "非白名单 Origin → 403", `status ${r.status}`)
  }
  {
    // 3) 无 Origin/Referer → 403
    const r = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json" }, body: VALID_BODY })
    ok(r.status === 403, "无 Origin/Referer → 403", `status ${r.status}`)
  }
  {
    // 4) localhost 开发源放行（转发出去了即可，不为 403）
    const r = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" }, body: VALID_BODY })
    ok(r.status !== 403, "localhost 开发源放行", `status ${r.status}`)
  }
  {
    // 5) OPTIONS 预检
    const r = await fetch(BASE + "/chat/completions", { method: "OPTIONS", headers: { Origin: GOOD, "Access-Control-Request-Method": "POST" } })
    ok(r.status === 204, "OPTIONS 预检 → 204", `status ${r.status}`)
    ok(r.headers.get("access-control-allow-origin") === GOOD && r.headers.get("access-control-allow-methods")?.includes("POST"), "预检 CORS 头正确")
  }
  {
    // 6) GET /chat/completions → 404
    const r = await fetch(BASE + "/chat/completions", { headers: { Origin: GOOD } })
    ok(r.status === 404, "GET /chat/completions → 404", `status ${r.status}`)
  }
  {
    // 7) 错误路径 → 404
    const r = await fetch(BASE + "/other", { method: "POST", headers: { "Content-Type": "application/json", Origin: GOOD }, body: VALID_BODY })
    ok(r.status === 404, "POST /other → 404", `status ${r.status}`)
  }
  {
    // 8) messages 超 4000 字符 → 413
    const big = JSON.stringify({ messages: [{ role: "user", content: "x".repeat(4100) }] })
    const r = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Origin: GOOD }, body: big })
    ok(r.status === 413, "messages 超上限 → 413", `status ${r.status}`)
  }
  {
    // 9) 非法 JSON → 400
    const r = await fetch(BASE + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Origin: GOOD }, body: "{oops" })
    ok(r.status === 400, "非法 JSON → 400", `status ${r.status}`)
  }

  console.log("■ 纯函数单测（消毒与白名单逻辑）")
  mkdirSync("../node_modules/.tmp", { recursive: true })
  copyFileSync("src/index.js", "../node_modules/.tmp/worker-index.mjs")
  const w = await import(pathToFileURL("../node_modules/.tmp/worker-index.mjs").href)

  ok(w.isAllowedOrigin("https://kldxg123.github.io"), "白名单：GitHub Pages 源")
  ok(w.isAllowedOrigin("http://localhost:5173"), "白名单：localhost 任意端口")
  ok(w.isAllowedOrigin("http://127.0.0.1:3000"), "白名单：127.0.0.1")
  ok(!w.isAllowedOrigin("https://kldxg123.github.io.evil.com"), "拒绝：伪装子域后缀")
  ok(!w.isAllowedOrigin(""), "拒绝：空 Origin")

  {
    const { body } = w.sanitizeChatBody({ model: "gpt-999", messages: [{ role: "user", content: "hi" }], max_tokens: 99999, stream: false })
    ok(body.model === "deepseek-chat", "消毒：强制 model=deepseek-chat")
    ok(body.max_tokens === 800, "消毒：max_tokens 99999 → 封顶 800", `实际 ${body.max_tokens}`)
    ok(body.stream === true, "消毒：强制 stream=true")
  }
  {
    const { body } = w.sanitizeChatBody({ messages: [{ role: "user", content: "hi" }] })
    ok(body.max_tokens === 800, "消毒：缺省 max_tokens → 800")
  }
  {
    const { body } = w.sanitizeChatBody({ messages: [{ role: "user", content: "hi" }], max_tokens: 200, temperature: 99 })
    ok(body.max_tokens === 200, "消毒：max_tokens 200 保留")
    ok(body.temperature === 2, "消毒：temperature 钳制到 2")
  }
  {
    const r = w.sanitizeChatBody({ messages: [{ role: "user", content: "y".repeat(4001) }] })
    ok(r.status === 413, "消毒：4001 字符 → 413")
  }
  {
    const r = w.sanitizeChatBody({ messages: "nope" })
    ok(r.status === 400, "消毒：messages 非数组 → 400")
  }
} catch (e) {
  fail++
  console.error("[verify-worker] 失败:", e.message)
} finally {
  await new Promise((resolve) => {
    const k = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    k.on("exit", resolve)
    setTimeout(resolve, 6000)
  })
  log("wrangler dev stopped")
}
console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
