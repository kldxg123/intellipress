// E2E 视觉走查 v5（明亮医疗风换皮）：全流程截图 + console 零报错
// 路径：P-001 + 晨峰血压飙升注入；重点产出 verify-shots-v5/ 供目检
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const PORT = process.argv[2] || "4189"
const BASE = `http://localhost:${PORT}/`
const SHOT_DIR = "verify-shots-v5"
mkdirSync(SHOT_DIR, { recursive: true })
const log = (...a) => console.log("[verify-v5]", ...a)

const consoleErrors = []
const pageErrors = []
const badResponses = []
let failed = false

const server = spawn("cmd", ["/c", `npx vite --port ${PORT} --strictPort`], { cwd: process.cwd(), stdio: "ignore" })

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
  const waitStageDoneAndNext = async (n, timeoutMs) => {
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: timeoutMs })
    await clickButton("下一阶段")
    await page.waitForFunction((k) => document.body.innerText.includes(`阶段 ${k}/6`), { timeout: 8000 }, n + 1)
  }

  await step("密码门", async () => {
    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 })
    await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 10000 })
    await new Promise((r) => setTimeout(r, 800))
    await shot("01-gate")
    await page.type('input[type="password"]', "Aa123456")
    await page.keyboard.press("Enter")
    await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
  })

  await step("设置页", async () => {
    await new Promise((r) => setTimeout(r, 600))
    await shot("02-setup")
    await clickButton("晨峰血压飙升")
    await clickButton("开始演示")
    await page.waitForFunction(() => document.body.innerText.includes("阶段 1/6"), { timeout: 8000 })
  })

  await step("阶段1 初诊建档", async () => {
    await new Promise((r) => setTimeout(r, 4500))
    await shot("03-stage1-parsing")
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 15000 })
    await shot("04-stage1-done")
    await clickButton("下一阶段")
    await page.waitForFunction(() => document.body.innerText.includes("阶段 2/6"), { timeout: 8000 })
  })

  await step("阶段2 三段式早筛", async () => {
    await new Promise((r) => setTimeout(r, 4500))
    await shot("05-stage2-engine")
    await page.waitForFunction(() => document.body.innerText.includes("很高危"), { timeout: 15000 })
    await new Promise((r) => setTimeout(r, 4500))
    await shot("06-stage2-kg")
    await page.waitForFunction(
      () => document.body.innerText.includes("实时解读") || document.body.innerText.includes("回放模式"),
      { timeout: 30000 },
    )
    log("  解读模式:", await page.evaluate(() => (document.body.innerText.includes("实时解读") ? "LIVE" : "REPLAY")))
    await page.waitForFunction(() => document.body.innerText.includes("SHAP"), { timeout: 25000 })
    await shot("07-stage2-llm")
    await waitStageDoneAndNext(2, 40000)
  })

  await step("阶段3 孪生推演", async () => {
    await new Promise((r) => setTimeout(r, 4000))
    await shot("08-stage3-mid")
    await page.waitForFunction(() => document.body.innerText.includes("数字孪生推演结论"), { timeout: 15000 })
    await shot("09-stage3-done")
    await waitStageDoneAndNext(3, 15000)
  })

  await step("阶段4 个性方案", async () => {
    await new Promise((r) => setTimeout(r, 3000))
    await shot("10-stage4")
    await waitStageDoneAndNext(4, 15000)
  })

  await step("阶段5 居家监护+告警", async () => {
    await page.waitForFunction(() => document.body.innerText.includes("照护时间轴"), { timeout: 8000 })
    await page.waitForFunction(() => document.body.innerText.includes("起进行中"), { timeout: 30000 })
    await shot("11-stage5-alerts")
    await page.waitForFunction(() => document.body.innerText.includes("日间监护结束"), { timeout: 90000 })
    await shot("12-stage5-dayend")
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 10000 })
    await clickButton("下一阶段")
    await page.waitForFunction(() => document.body.innerText.includes("阶段 6/6"), { timeout: 8000 })
  })

  await step("阶段6 复盘迭代", async () => {
    await new Promise((r) => setTimeout(r, 3000))
    await shot("13-stage6")
  })

  await step("指标溯源层", async () => {
    await clickButton("指标溯源")
    await new Promise((r) => setTimeout(r, 900))
    const on = await page.evaluate(() => document.body.innerText.includes("实测") && document.body.innerText.includes("孪生"))
    if (!on) throw new Error("溯源角标未出现")
    await shot("14-provenance")
    await clickButton("指标溯源")
  })

  await step("数据明细抽屉", async () => {
    await clickButton("数据明细")
    await new Promise((r) => setTimeout(r, 900))
    if (!(await bodyHas("数据明细 · 阶段 6/6"))) throw new Error("抽屉未打开")
    await shot("15-drawer")
    await clickButton("✕")
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
  console.error("[verify-v5] 流程失败:", e.message)
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
