// 双路径走查：① dev server 阶段2 LIVE 真实推理不受影响 ② dist 静态服务（无代理）阶段2 回放兜底
// 用法：node scripts/verify-proxy.mjs
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { readFileSync, existsSync } from "node:fs"
import { extname, join, normalize } from "node:path"
import puppeteer from "puppeteer-core"

const log = (...a) => console.log("[verify-proxy]", ...a)
const consoleErrors = []
let failed = false

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" }

// ── dist 静态服务器（模拟 GitHub Pages：无 vite 代理、无 Worker URL）──
const staticServer = createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0])
  if (p === "/" || p === "") p = "/index.html"
  const file = normalize(join("dist", p))
  if (!file.startsWith("dist") || !existsSync(file)) { res.writeHead(404); res.end("nf"); return }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" })
  res.end(readFileSync(file))
})

const vite = spawn("cmd", ["/c", "npx vite --port 4196 --strictPort"], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] })

async function waitServer(url, timeoutMs = 40000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("server 启动超时: " + url)
}

let browser = null
async function runStage2(base, expectMode) {
  const page = await browser.newPage()
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`[${base}] ` + m.text()) })
  page.on("pageerror", (e) => consoleErrors.push(`[${base}] pageerror: ` + String(e)))
  await page.evaluateOnNewDocument(() => localStorage.clear())
  await page.goto(base, { waitUntil: "networkidle2", timeout: 30000 })
  await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 10000 })
  await page.type('input[type="password"]', "Aa123456")
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("P-001"))?.click())
  await new Promise((r) => setTimeout(r, 300))
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("开始演示"))?.click())
  await page.waitForFunction(() => document.body.innerText.includes("阶段 1/6"), { timeout: 8000 })
  await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 20000 })
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("下一阶段"))?.click())
  await page.waitForFunction(() => document.body.innerText.includes("阶段 2/6"), { timeout: 8000 })
  // LLM 解读耗时长，放宽 150s
  try {
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 150000 })
  } catch (e) {
    const dump = await page.evaluate(() => document.body.innerText.slice(0, 1500))
    log("✗ 阶段2 超时，页面状态快照：\n" + dump)
    throw e
  }
  const text = await page.evaluate(() => document.body.innerText)
  if (expectMode === "live" && !text.includes("实时解读")) throw new Error("dev 路径未进入实时解读模式")
  if (expectMode === "replay" && !text.includes("回放模式")) throw new Error("生产路径未进入回放兜底模式")
  if (!text.includes("很高危")) throw new Error("阶段2 分层结论未渲染")
  await page.close()
  log(`✓ ${base} 阶段2 完成（${expectMode === "live" ? "实时解读 LIVE" : "回放兜底 REPLAY"}）`)
}

try {
  await waitServer("http://127.0.0.1:4196/")
  await new Promise((resolve) => staticServer.listen(4197, "127.0.0.1", resolve))
  await waitServer("http://127.0.0.1:4197/")
  log("dev(4196) 与静态(4197) server ready")

  browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  })

  await runStage2("http://127.0.0.1:4196/", "live")   // dev：vite 代理注入 .env.local 密钥
  await runStage2("http://127.0.0.1:4197/", "replay") // 静态：VITE_LLM_PROXY_URL 为空 → 回放

  const realErrors = consoleErrors.filter(
    (t) => !/favicon|Download the React DevTools|WebGL.*fallback|GroupMarkerNotSet|swiftshader|AbortError|Failed to load resource|llm 4|未配置 LLM/i.test(t),
  )
  log("console errors:", realErrors.length ? realErrors : "无")
  if (realErrors.length) failed = true
} catch (e) {
  failed = true
  console.error("[verify-proxy] 流程失败:", e.message)
} finally {
  if (browser) await browser.close().catch(() => {})
  staticServer.close()
  await new Promise((resolve) => {
    const k = spawn("taskkill", ["/PID", String(vite.pid), "/T", "/F"], { stdio: "ignore" })
    k.on("exit", resolve)
    setTimeout(resolve, 5000)
  })
  log("servers stopped")
}
log(failed ? "总体结果：存在失败项" : "总体结果：全部通过")
process.exit(failed ? 1 : 0)
