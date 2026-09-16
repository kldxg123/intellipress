// E2E 验证 v4（指南规则引擎 + 知识图谱三段式早筛；第 5 阶段遮挡/24:00 修复）
// 跑两条路径：A) P-001 + 晨峰注入（告警流）；B) D-01 + 不注入（全程平稳）
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const SHOT_DIR = "verify-shots-v4"
mkdirSync(SHOT_DIR, { recursive: true })
const log = (...a) => console.log("[verify-v4]", ...a)

let failed = false

async function runOnce({ port, name, caseLabel, incidentLabel, expectRisk, expectAlerts }) {
  const BASE = `http://localhost:${port}/`
  const consoleErrors = []
  const pageErrors = []
  const server = spawn("cmd", ["/c", `npx vite --port ${port} --strictPort`], { cwd: process.cwd(), stdio: "ignore" })
  let browser = null

  const waitServer = async (timeoutMs = 40000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      try { const r = await fetch(BASE); if (r.ok) return } catch {}
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error("dev server 启动超时")
  }

  try {
    await waitServer()
    log(`[${name}] dev server ready on ${port}`)
    browser = await puppeteer.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: "new",
      args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1440,900"],
      defaultViewport: { width: 1440, height: 900 },
    })
    const page = await browser.newPage()
    const badResponses = []
    page.on("response", (r) => {
      // deepseek 代理失败属预期兜底路径（回放模式），其余 4xx/5xx 记为失败
      if (r.status() >= 400 && !r.url().includes("/api/deepseek")) badResponses.push(`${r.status()} ${r.url()}`)
    })
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()) })
    page.on("pageerror", (e) => pageErrors.push(String(e)))
    await page.evaluateOnNewDocument(() => localStorage.clear())

    const shot = (n) => page.screenshot({ path: `${SHOT_DIR}/${n}.png` })
    const bodyHas = (s) => page.evaluate((t) => document.body.innerText.includes(t), s)
    const step = async (n, fn) => {
      try { await fn(); log(`[${name}] ✓`, n) } catch (e) {
        failed = true
        log(`[${name}] ✗`, n, "—", e.message)
        await shot(`FAIL-${name}-${n}`).catch(() => {})
        throw e
      }
    }
    const clickButton = (txt) =>
      page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.innerText.includes(t))?.click(), txt)
    const waitStageDoneAndNext = async (n, timeoutMs) => {
      await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: timeoutMs })
      await clickButton("下一阶段")
      await page.waitForFunction((k) => document.body.innerText.includes(`阶段 ${k}/6`), { timeout: 8000 }, n + 1)
    }

    await step("密码门+设置", async () => {
      await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 })
      await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 10000 })
      await page.type('input[type="password"]', "Aa123456")
      await page.keyboard.press("Enter")
      await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
      if (caseLabel) await clickButton(caseLabel)
      if (incidentLabel) await clickButton(incidentLabel)
      await shot(`${name}-01-setup`)
      await clickButton("开始演示")
      await page.waitForFunction(() => document.body.innerText.includes("阶段 1/6"), { timeout: 8000 })
    })

    await step("阶段1", async () => {
      await page.waitForFunction(() => document.body.innerText.includes("实体/关系抽取准确率"), { timeout: 15000 })
      await waitStageDoneAndNext(1, 15000)
    })

    await step("阶段2 三段式早筛", async () => {
      // 顶部定位语
      for (const s of ["指南规则引擎", "医学知识图谱", "大模型仅负责解释", "AI 解读（仅解释，不参与判定）", "模型特征贡献度参考"]) {
        if (!(await bodyHas(s))) throw new Error(`缺少: ${s}`)
      }
      // 引擎段：分级表扫描 + 因子核对
      await new Promise((r) => setTimeout(r, 4000))
      if (!(await bodyHas("血压分级表扫描"))) throw new Error("缺少分级表扫描")
      await shot(`${name}-02-stage2-engine`)
      // 等引擎结论徽章
      await page.waitForFunction((risk) => document.body.innerText.includes(risk), { timeout: 15000 }, expectRisk)
      if (!(await bodyHas("指南规则引擎判定"))) throw new Error("缺少引擎结论徽章")
      // 图谱段
      await page.waitForFunction(() => document.body.innerText.includes("命中指南条款"), { timeout: 15000 })
      await new Promise((r) => setTimeout(r, 2500))
      await shot(`${name}-03-stage2-kg`)
      // LLM 解读段
      await page.waitForFunction(
        () => document.body.innerText.includes("实时解读") || document.body.innerText.includes("回放模式"),
        { timeout: 30000 },
      )
      const mode = await page.evaluate(() => (document.body.innerText.includes("实时解读") ? "LIVE" : "REPLAY"))
      log(`[${name}]   解读模式:`, mode)
      await page.waitForFunction(() => document.body.innerText.includes("SHAP"), { timeout: 20000 })
      await shot(`${name}-04-stage2-llm`)
      await waitStageDoneAndNext(2, 40000)
    })

    await step("阶段3", async () => {
      await page.waitForFunction(() => document.body.innerText.includes("数字孪生推演结论"), { timeout: 15000 })
      await waitStageDoneAndNext(3, 15000)
    })

    await step("阶段4", async () => {
      await waitStageDoneAndNext(4, 20000)
    })

    await step("阶段5 居家监护", async () => {
      await page.waitForFunction(() => document.body.innerText.includes("照护时间轴"), { timeout: 8000 })
      await page.waitForFunction(() => document.body.innerText.includes("分级告警流"), { timeout: 10000 })
      if (expectAlerts) {
        // 告警出现在侧栏而非固定浮层
        await page.waitForFunction(() => document.body.innerText.includes("起进行中"), { timeout: 30000 })
        const fixed = await page.evaluate(() => !!document.querySelector(".fixed.bottom-6.right-6"))
        if (fixed) throw new Error("仍存在固定告警浮层")
        if (!(await bodyHas("暂无告警 · 值守中"))) {
          // 告警已来时空态应消失——不强制；仅记录
          log(`[${name}]   告警侧栏已有内容`)
        }
        await shot(`${name}-05-stage5-alerts`)
      } else {
        await new Promise((r) => setTimeout(r, 1200))
        if (!(await bodyHas("暂无告警 · 值守中"))) throw new Error("不注入路径缺少告警空态")
        await shot(`${name}-05-stage5-watch`)
      }
      // 两条路径统一在 24:00 收尾
      await page.waitForFunction(() => document.body.innerText.includes("日间监护结束"), { timeout: 90000 })
      if (!(await bodyHas("24:00"))) throw new Error("缺少 24:00 停止标记")
      if (!expectAlerts && !(await bodyHas("全程平稳"))) throw new Error("不注入路径缺少全程平稳")
      await shot(`${name}-06-stage5-dayend`)
      // 「下一阶段」按钮不被遮挡、可点击
      await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 10000 })
      const clickCheck = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => x.innerText.includes("下一阶段"))
        if (!b) return { found: false }
        b.scrollIntoView({ block: "center" })
        const r = b.getBoundingClientRect()
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
        return { found: true, clickable: el === b || b.contains(el) }
      })
      if (!clickCheck.found) throw new Error("未找到下一阶段按钮")
      if (!clickCheck.clickable) throw new Error("下一阶段按钮被遮挡")
      await clickButton("下一阶段")
      await page.waitForFunction(() => document.body.innerText.includes("阶段 6/6"), { timeout: 8000 })
    })

    await step("阶段6", async () => {
      await new Promise((r) => setTimeout(r, 2500))
      for (const s of ["复盘迭代", "医师在环"]) {
        if (!(await bodyHas(s))) throw new Error(`缺少: ${s}`)
      }
      await shot(`${name}-07-stage6`)
    })

    const realErrors = consoleErrors.filter(
      (t) => !/favicon|Download the React DevTools|WebGL.*fallback|GroupMarkerNotSet|swiftshader|AbortError|Failed to load resource/i.test(t),
    )
    log(`[${name}] console errors:`, realErrors.length ? realErrors : "无")
    log(`[${name}] bad responses(非 deepseek):`, badResponses.length ? badResponses : "无")
    log(`[${name}] page errors:`, pageErrors.length ? pageErrors : "无")
    if (realErrors.length || pageErrors.length || badResponses.length) failed = true
  } catch (e) {
    failed = true
    console.error(`[verify-v4][${name}] 流程失败:`, e.message)
  } finally {
    if (browser) await browser.close().catch(() => {})
    await new Promise((resolve) => {
      const k = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
      k.on("exit", resolve)
      setTimeout(resolve, 5000)
    })
    log(`[${name}] dev server stopped`)
  }
}

await runOnce({
  port: 4187, name: "A",
  caseLabel: "P-001", incidentLabel: "晨峰血压飙升",
  expectRisk: "很高危", expectAlerts: true,
})
await runOnce({
  port: 4188, name: "B",
  caseLabel: "D-01", incidentLabel: "不注入",
  expectRisk: "高危", expectAlerts: false,
})

log(failed ? "总体结果：存在失败项" : "总体结果：全部通过")
process.exit(failed ? 1 : 0)
