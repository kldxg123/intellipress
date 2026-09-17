// E2E 走查 v8（文献证据库接入知识图谱）：P-001 阶段2 证据徽章 + 证据文献列表断言
// 用法：node scripts/verify-v8.mjs [port]
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const PORT = process.argv[2] || "4195"
const BASE = `http://127.0.0.1:${PORT}/`
const SHOT_DIR = "verify-shots-v8"
mkdirSync(SHOT_DIR, { recursive: true })
const log = (...a) => console.log("[verify-v8]", ...a)

const consoleErrors = []
const pageErrors = []
const badResponses = []
let failed = false

const server = spawn("cmd", ["/c", `npx vite --port ${PORT} --strictPort`], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] })
server.stdout.on("data", (d) => process.stdout.write("[vite] " + d))
server.stderr.on("data", (d) => process.stdout.write("[vite-err] " + d))

async function waitServer(timeoutMs = 40000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(BASE); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("dev server 启动超时")
}

let browser = null
try {
  await waitServer()
  log("dev server ready on", PORT)
  browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()) })
  page.on("pageerror", (e) => pageErrors.push(String(e)))
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/api/deepseek")) badResponses.push(`${r.status()} ${r.url()}`)
  })
  await page.evaluateOnNewDocument(() => localStorage.clear())

  const shot = (n) => page.screenshot({ path: `${SHOT_DIR}/${n}.png` })
  const bodyHas = (s) => page.evaluate((t) => document.body.innerText.includes(t), s)
  const clickButton = (txt) =>
    page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.innerText.includes(t))?.click(), txt)
  const step = async (n, fn) => {
    try { await fn(); log("✓", n) } catch (e) {
      failed = true
      log("✗", n, "—", e.message)
      await shot(`FAIL-${n}`).catch(() => {})
      throw e
    }
  }

  await step("P-001 进入阶段2", async () => {
    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 })
    await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 10000 })
    await page.type('input[type="password"]', "Aa123456")
    await page.keyboard.press("Enter")
    await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
    await clickButton("P-001")
    await new Promise((r) => setTimeout(r, 300))
    await clickButton("开始演示")
    await page.waitForFunction(() => document.body.innerText.includes("阶段 1/6"), { timeout: 8000 })
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 20000 })
    await clickButton("下一阶段")
    await page.waitForFunction(() => document.body.innerText.includes("阶段 2/6"), { timeout: 8000 })
  })

  await step("阶段2 定位语含 71 篇文献证据", async () => {
    if (!(await bodyHas("71 篇文献证据"))) throw new Error("定位语缺少「71 篇文献证据」")
  })

  await step("知识图谱证据徽章出现", async () => {
    // 等待图谱阶段：入口实体逐个揭示后徽章可见（证据计数 >0 的节点带角标）
    await page.waitForFunction(() => document.body.innerText.includes("证据文献列表"), { timeout: 60000 })
    await page.waitForFunction(() => document.querySelectorAll("svg title").length > 0, { timeout: 30000 })
    const badgeTitles = await page.evaluate(() => [...document.querySelectorAll("svg title")].map((t) => t.textContent))
    if (!badgeTitles.some((t) => t && t.startsWith("证据 "))) throw new Error("SVG 内未发现「证据 N 篇文献」徽章")
    log("  徽章示例:", badgeTitles.filter((t) => t && t.startsWith("证据 ")).slice(0, 5).join(" | "))
    if (!(await bodyHas("证据文献（节点角标为关联篇数）"))) throw new Error("图例缺少证据文献说明")
    await new Promise((r) => setTimeout(r, 6000)) // 等邻点环揭示完毕
    await shot("p001-stage2-kg-badges")
  })

  await step("证据文献列表：标题/五分类/命中计数", async () => {
    if (!(await bodyHas("证据文献列表 · 命中"))) throw new Error("缺少「证据文献列表 · 命中」标题")
    if (!(await bodyHas("库共 71 篇"))) throw new Error("缺少「库共 71 篇」")
    for (const cat of ["大模型×高血压", "数字孪生", "真实数据", "数据统计", "生活方式与综合管理"]) {
      if (!(await bodyHas(cat))) throw new Error(`分类缺失: ${cat}`)
    }
    const hitBadges = await page.evaluate(() => [...document.querySelectorAll("[data-lit-row]")].length)
    if (hitBadges !== 15) throw new Error(`折叠态应显示 5 组 × 3 条 = 15 行，实际 ${hitBadges}`)
    await page.evaluate(() => document.querySelector("[data-lit-panel]")?.scrollIntoView({ block: "start" }))
    await new Promise((r) => setTimeout(r, 400))
    await shot("p001-stage2-lit-collapsed")
  })

  await step("展开全部：条目增多且出现 ChatHTN", async () => {
    const before = await page.evaluate(
      () => document.querySelectorAll('[data-lit-group="大模型×高血压"] [data-lit-row]').length,
    )
    await page.evaluate(() => document.querySelector('[data-lit-expand="大模型×高血压"]')?.click())
    await new Promise((r) => setTimeout(r, 400))
    const after = await page.evaluate(
      () => document.querySelectorAll('[data-lit-group="大模型×高血压"] [data-lit-row]').length,
    )
    if (!(after > before)) throw new Error(`展开后条目未增多: ${before} → ${after}`)
    log(`  大模型×高血压组: ${before} → ${after} 条`)
    if (!(await bodyHas("ChatHTN"))) throw new Error("展开后未出现 ChatHTN（大模型类代表文献）")
    await shot("p001-stage2-lit-expanded")
  })

  await step("阶段2 全程走完（LLM 解读完成）", async () => {
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 150000 })
  })

  const realErrors = consoleErrors.filter(
    (t) => !/favicon|Download the React DevTools|WebGL.*fallback|GroupMarkerNotSet|swiftshader|AbortError|Failed to load resource/i.test(t),
  )
  log("console errors:", realErrors.length ? realErrors : "无")
  log("bad responses(非 deepseek):", badResponses.length ? badResponses : "无")
  log("page errors:", pageErrors.length ? pageErrors : "无")
  if (realErrors.length || pageErrors.length || badResponses.length) failed = true
} catch (e) {
  failed = true
  console.error("[verify-v8] 流程失败:", e.message)
} finally {
  if (browser) await browser.close().catch(() => {})
  await new Promise((resolve) => {
    const k = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    k.on("exit", resolve)
    setTimeout(resolve, 5000)
  })
  log("dev server stopped")
}
log(failed ? "总体结果：存在失败项" : "总体结果：全部通过")
process.exit(failed ? 1 : 0)
