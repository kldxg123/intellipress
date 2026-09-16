// E2E 验证 v3（6 阶段患者旅程重构后）
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const PORT = process.argv[2] || "4186"
const BASE = `http://localhost:${PORT}/`
const SHOT_DIR = "verify-shots-v3"
mkdirSync(SHOT_DIR, { recursive: true })

const consoleErrors = []
const pageErrors = []
const log = (...a) => console.log("[verify-v3]", ...a)

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
    try { await fn(); log("✓", name) } catch (e) {
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

  await step("设置页", async () => {
    for (const s of ["示教病例设置", "P-001", "D-01", "D-02", "突发情景演练"]) {
      if (!(await bodyHas(s))) throw new Error(`缺少: ${s}`)
    }
    await shot("02-setup")
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("晨峰血压飙升"))?.click())
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("开始演示"))?.click())
    await page.waitForFunction(() => document.body.innerText.includes("阶段 1/6"), { timeout: 8000 })
  })

  await step("侧栏 6 节点", async () => {
    const n = await page.evaluate(() => {
      const el = [...document.querySelectorAll("aside")].find((a) => a.innerText.includes("诊疗路径"))
      return el ? el.querySelectorAll("li").length : 0
    })
    if (n !== 6) throw new Error(`侧栏节点数 ${n} ≠ 6`)
    for (const s of ["初诊建档", "智能早筛", "孪生推演", "个性方案", "居家执行", "复盘迭代"]) {
      if (!(await bodyHas(s))) throw new Error(`侧栏缺少: ${s}`)
    }
    for (const bad of ["多源采集", "全天候监护", "照护计划", "STEP"]) {
      if (await bodyHas(bad)) throw new Error(`残留旧阶段名: ${bad}`)
    }
  })

  const waitStageDoneAndNext = async (n, timeoutMs) => {
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: timeoutMs })
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("下一阶段"))?.click())
    await page.waitForFunction((k) => document.body.innerText.includes(`阶段 ${k}/6`), { timeout: 8000 }, n + 1)
  }

  await step("阶段1 初诊建档(病历解析)", async () => {
    await new Promise((r) => setTimeout(r, 3500))
    const parsing = await bodyHas("结构化电子健康档案")
    if (!parsing) throw new Error("缺少结构化档案卡片")
    await shot("03-stage1-parsing")
    await page.waitForFunction(() => document.body.innerText.includes("实体/关系抽取准确率"), { timeout: 12000 })
    await waitStageDoneAndNext(1, 12000)
    await shot("04-stage1-done-next")
  })

  await step("阶段2 智能早筛(DeepSeek)", async () => {
    if (!(await bodyHas("多模态软投票融合"))) throw new Error("缺少软投票融合可视化")
    await page.waitForFunction(
      () => document.body.innerText.includes("实时推理") || document.body.innerText.includes("回放模式"),
      { timeout: 25000 },
    )
    const mode = await page.evaluate(() => (document.body.innerText.includes("实时推理") ? "LIVE" : "REPLAY"))
    log("  推理模式:", mode)
    await shot("05-stage2-screening")
    await waitStageDoneAndNext(2, 30000)
  })

  await step("阶段3 孪生推演(双未来轨迹)", async () => {
    for (const s of ["孪生推演", "未干预轨迹", "规范干预轨迹"]) {
      if (!(await bodyHas(s))) throw new Error(`缺少: ${s}`)
    }
    await new Promise((r) => setTimeout(r, 3500))
    await shot("06-stage3-forecast-mid")
    await page.waitForFunction(() => document.body.innerText.includes("数字孪生推演结论"), { timeout: 12000 })
    const hasNums = await page.evaluate(
      () => /达标率提升/.test(document.body.innerText) && /相对下降/.test(document.body.innerText) && /脑卒中风险/.test(document.body.innerText),
    )
    if (!hasNums) throw new Error("结论横幅数字缺失")
    await shot("07-stage3-forecast-done")
    await waitStageDoneAndNext(3, 15000)
  })

  await step("阶段4 个性方案", async () => {
    await new Promise((r) => setTimeout(r, 2500))
    await shot("08-stage4-plan")
    await waitStageDoneAndNext(4, 15000)
  })

  await step("阶段5 居家执行(时间轴+监护+告警)", async () => {
    await page.waitForFunction(() => document.body.innerText.includes("照护时间轴"), { timeout: 8000 })
    await new Promise((r) => setTimeout(r, 1500))
    await shot("09-stage5-timeline")
    await page.waitForFunction(() => document.body.innerText.includes("加强监测"), { timeout: 25000 })
    await shot("10-stage5-alert3")
    await page.waitForFunction(() => document.body.innerText.includes("通知家属/医生"), { timeout: 15000 })
    const hasLatency = await page.evaluate(() => /处置指令时延/.test(document.body.innerText))
    if (!hasLatency) throw new Error("告警卡缺少处置指令时延")
    const clock = await page.evaluate(() => (document.body.innerText.match(/监护 (\d{2}:\d{2})/) || [])[1])
    log("  告警时监护时钟:", clock)
    if (clock && (clock < "06:00" || clock > "12:00")) throw new Error(`告警不在早晨时段: ${clock}`)
    await shot("11-stage5-alert2")
    await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 40000 })
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("下一阶段"))?.click())
    await page.waitForFunction(() => document.body.innerText.includes("阶段 6/6"), { timeout: 8000 })
  })

  await step("阶段6 复盘迭代", async () => {
    await new Promise((r) => setTimeout(r, 3000))
    for (const s of ["阶段 6/6", "复盘迭代", "上限 10%", "数据不出域", "医师在环"]) {
      if (!(await bodyHas(s))) throw new Error(`缺少: ${s}`)
    }
    await shot("12-stage6-review")
  })

  await step("指标溯源层", async () => {
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "指标溯源")?.click())
    await new Promise((r) => setTimeout(r, 800))
    const on = await page.evaluate(() => document.body.innerText.includes("实测") && document.body.innerText.includes("孪生"))
    if (!on) throw new Error("溯源角标未出现")
    await shot("13-provenance")
    await page.keyboard.press("s")
  })

  await step("3D 与返回", async () => {
    const glOk = await page.evaluate(() => {
      const c = document.querySelector("canvas")
      if (!c || c.width === 0) return false
      const gl = c.getContext("webgl2") || c.getContext("webgl")
      return !!gl && !gl.isContextLost()
    })
    if (!glOk) throw new Error("WebGL 异常")
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.innerText.includes("返回病例设置"))?.click())
    await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
    await shot("14-back")
  })

  const realErrors = consoleErrors.filter(
    (t) => !/favicon|Download the React DevTools|WebGL.*fallback|GroupMarkerNotSet|swiftshader/i.test(t),
  )
  log("console errors:", realErrors.length ? realErrors : "无")
  log("page errors:", pageErrors.length ? pageErrors : "无")
  if (realErrors.length || pageErrors.length) failed = true
} catch (e) {
  failed = true
  console.error("[verify-v3] 流程失败:", e.message)
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
