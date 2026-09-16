// 回放兜底验证：在 dev server 启动时无 DEEPSEEK_API_KEY（父进程已移走 .env.local）
// 走到第 3 步，断言出现「回放模式」徽标且演示不卡死
import { spawn } from "node:child_process"
import puppeteer from "puppeteer-core"

const PORT = "4175"
const BASE = `http://localhost:${PORT}/`
const log = (...a) => console.log("[replay-test]", ...a)

const server = spawn("cmd", ["/c", `npx vite --port ${PORT} --strictPort`], { cwd: process.cwd(), stdio: "ignore" })

async function waitServer(timeoutMs = 40000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("server timeout")
}

let browser = null
let ok = false
try {
  await waitServer()
  browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: "networkidle2" })
  await page.type('input[type="password"]', "Aa123456")
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => document.body.innerText.includes("任务配置台"), { timeout: 8000 })
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("开始演示"))?.click())
  await page.waitForFunction(() => document.body.innerText.includes("本步演示完成"), { timeout: 15000 })
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("下一步"))?.click())
  await page.waitForFunction(() => document.body.innerText.includes("本步演示完成"), { timeout: 20000 })
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("下一步"))?.click())
  // 第 3 步：等 API 401 → 回放兜底 → 打字机 → 完成
  await page.waitForFunction(() => document.body.innerText.includes("回放模式"), { timeout: 30000 })
  log("✓ 出现「回放模式」徽标")
  await page.waitForFunction(() => document.body.innerText.includes("本步演示完成"), { timeout: 40000 })
  log("✓ 第 3 步在回放模式下正常完成，演示未卡死")
  await page.screenshot({ path: "verify-shots/17-step3-replay.png" })
  ok = true
} catch (e) {
  console.error("[replay-test] 失败:", e.message)
} finally {
  if (browser) await browser.close().catch(() => {})
  await new Promise((resolve) => {
    const k = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    k.on("exit", resolve)
    setTimeout(resolve, 5000)
  })
}
process.exit(ok ? 0 : 1)
