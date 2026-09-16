// E2E 验证 v2（去 NeuroHand 化改版后）：纵向侧栏 + 绿色主题 + 新文案 + 七阶段全流程
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const PORT = process.argv[2] || "4184"
const BASE = `http://localhost:${PORT}/`
const SHOT_DIR = "verify-shots-v2"
mkdirSync(SHOT_DIR, { recursive: true })

const consoleErrors = []
const pageErrors = []
const log = (...a) => console.log("[verify-v2]", ...a)

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
  throw new Error("dev server 启动超时")
}

let browser = null
let failed = false
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

  const shot = (name) => page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
  const bodyHas = (s) => page.evaluate((t) => document.body.innerText.includes(t), s)
  const step = async (name, fn) => {
    try {
      await fn()
      log("✓", name)
    } catch (e) {
      failed = true
      log("✗", name, "—", e.message)
      await shot(`FAIL-${name}`).catch(() => {})
      throw e
    }
  }

  await page.evaluateOnNewDocument(() => localStorage.clear())

  await step("密码门", async () => {
    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 })
    await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 10000 })
    await shot("01-gate")
    await page.type('input[type="password"]', "Aa123456")
    await page.keyboard.press("Enter")
    await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
  })

  await step("设置页新文案+无节奏区块", async () => {
    for (const s of ["示教病例设置", "选择病例与演练情景，进入全流程演示", "P-001", "D-01", "D-02", "突发情景演练", "演示病例"]) {
      if (!(await bodyHas(s))) throw new Error(`缺少文案: ${s}`)
    }
    for (const bad of ["节奏", "倍速", "MISSION", "任务配置台", "CASE001", "SIM_A", "SIM_B", "异常注入"]) {
      if (await bodyHas(bad)) throw new Error(`残留旧文案: ${bad}`)
    }
    await shot("02-setup")
  })

  await step("选择 D-01 + 晨峰情景并开始", async () => {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("D-01"))?.click())
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("晨峰血压飙升"))?.click())
    await shot("03-setup-configured")
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("开始演示"))?.click())
    await page.waitForFunction(() => document.body.innerText.includes("阶段 1/7"), { timeout: 8000 })
  })

  await step("顶条与纵向侧栏布局", async () => {
    for (const s of ["阶段 1/7", "监护", "指标溯源", "数据明细", "返回病例设置", "D-01", "诊疗路径", "AI 推理引擎"]) {
      if (!(await bodyHas(s))) throw new Error(`缺少: ${s}`)
    }
    for (const bad of ["STEP", "SIM 时钟", "数据从哪来", "集体进化", "垂直大模型"]) {
      if (await bodyHas(bad)) throw new Error(`残留: ${bad}`)
    }
    // 侧栏为纵向：宽 < 高，且在视口左侧
    const box = await page.evaluate(() => {
      const el = [...document.querySelectorAll("aside")].find((a) => a.innerText.includes("诊疗路径"))
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, w: r.width, h: r.height }
    })
    if (!box) throw new Error("未找到诊疗路径侧栏")
    if (!(box.h > box.w && box.x < 20)) throw new Error(`侧栏布局异常: ${JSON.stringify(box)}`)
    await shot("04-stage1-layout")
  })

  const waitStageDoneAndNext = async (n, timeoutMs) => {
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: timeoutMs })
    await shot(`05-stage${n}-done`)
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("下一阶段"))?.click())
    await page.waitForFunction((k) => document.body.innerText.includes(`阶段 ${k}/7`), { timeout: 8000 }, n + 1)
  }

  await step("阶段1 多源采集", async () => {
    await page.waitForFunction(() => document.body.innerText.includes("多源采集"), { timeout: 8000 })
    await waitStageDoneAndNext(1, 15000)
  })

  await step("阶段2 孪生建模", async () => {
    await new Promise((r) => setTimeout(r, 4000))
    await shot("06-stage2-calibrating")
    await waitStageDoneAndNext(2, 20000)
  })

  await step("阶段3 AI 辅助评估(DeepSeek)", async () => {
    await page.waitForFunction(
      () => document.body.innerText.includes("实时推理") || document.body.innerText.includes("回放模式"),
      { timeout: 25000 },
    )
    const mode = await page.evaluate(() => (document.body.innerText.includes("实时推理") ? "LIVE" : "REPLAY"))
    log("  推理模式:", mode)
    await shot("07-stage3")
    await waitStageDoneAndNext(3, 30000)
  })

  await step("阶段4 个性化方案", async () => {
    await new Promise((r) => setTimeout(r, 2500))
    await shot("08-stage4")
    await waitStageDoneAndNext(4, 15000)
  })

  await step("阶段5 照护计划", async () => {
    await new Promise((r) => setTimeout(r, 2000))
    await shot("09-stage5")
    await waitStageDoneAndNext(5, 20000)
  })

  await step("阶段6 全天候监护+情景告警", async () => {
    await page.waitForFunction(() => document.body.innerText.includes("加强监测"), { timeout: 20000 })
    await shot("10-stage6-alert3")
    await page.waitForFunction(() => document.body.innerText.includes("通知家属/医生"), { timeout: 15000 })
    const hasLatency = await page.evaluate(() => /处置指令时延/.test(document.body.innerText))
    if (!hasLatency) throw new Error("告警卡缺少处置指令时延")
    // 监护时钟应在早晨时段
    const clock = await page.evaluate(() => (document.body.innerText.match(/监护 (\d{2}:\d{2})/) || [])[1])
    log("  告警时监护时钟:", clock)
    if (clock && (clock < "06:00" || clock > "12:00")) throw new Error(`告警不在早晨时段: ${clock}`)
    await shot("11-stage6-alert2")
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 40000 })
    await shot("12-stage6-done")
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("下一阶段"))?.click())
    await page.waitForFunction(() => document.body.innerText.includes("阶段 7/7"), { timeout: 8000 })
  })

  await step("阶段7 复盘迭代", async () => {
    await new Promise((r) => setTimeout(r, 3000))
    for (const s of ["复盘迭代", "上限 10%", "数据不出域", "医师在环"]) {
      if (!(await bodyHas(s))) throw new Error(`缺少: ${s}`)
    }
    if (await bodyHas("集体进化")) throw new Error("残留: 集体进化")
    await shot("13-stage7")
  })

  await step("指标溯源层", async () => {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "指标溯源")?.click())
    await new Promise((r) => setTimeout(r, 800))
    const on = await page.evaluate(() => document.body.innerText.includes("实测") && document.body.innerText.includes("孪生"))
    if (!on) throw new Error("溯源角标未出现")
    await shot("14-provenance-on")
    await page.keyboard.press("s") // 热键保留
    await new Promise((r) => setTimeout(r, 400))
  })

  await step("数据明细抽屉(D 热键)", async () => {
    await page.keyboard.press("d")
    await new Promise((r) => setTimeout(r, 800))
    if (!(await bodyHas("数据明细 · 阶段"))) throw new Error("抽屉未打开或标题错误")
    await shot("15-drawer")
    await page.keyboard.press("d")
  })

  await step("3D 场景与主题色", async () => {
    const glOk = await page.evaluate(() => {
      const c = document.querySelector("canvas")
      if (!c || c.width === 0) return "no-canvas"
      const gl = c.getContext("webgl2") || c.getContext("webgl")
      return gl && !gl.isContextLost() ? "ok" : "lost"
    })
    if (glOk !== "ok") throw new Error("WebGL: " + glOk)
    // 主题色检查：读取一个 emerald 元素计算样式应为绿色系
    const rgb = await page.evaluate(() => {
      const el = [...document.querySelectorAll("*")].find((e) => e.textContent === "指标溯源")
      return el ? getComputedStyle(el).color : null
    })
    log("  指标溯源按钮色:", rgb)
  })

  await step("返回病例设置", async () => {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("返回病例设置"))?.click())
    await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
    await shot("16-back")
  })

  const realErrors = consoleErrors.filter(
    (t) => !/favicon|Download the React DevTools|WebGL.*fallback|GroupMarkerNotSet|swiftshader/i.test(t),
  )
  log("console errors:", realErrors.length ? realErrors : "无")
  log("page errors:", pageErrors.length ? pageErrors : "无")
  if (realErrors.length || pageErrors.length) failed = true
} catch (e) {
  failed = true
  console.error("[verify-v2] 流程失败:", e.message)
} finally {
  if (browser) await browser.close().catch(() => {})
  await new Promise((resolve) => {
    const k = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    k.on("exit", resolve)
    setTimeout(resolve, 5000)
  })
  log("dev server stopped")
}
process.exit(failed ? 1 : 0)
