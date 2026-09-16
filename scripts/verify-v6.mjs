// E2E 走查 v6（风险模型引擎）：三病例阶段3数字 = riskModel 运行时计算值；口径面板内容断言
// 用法：node scripts/verify-v6.mjs [port]
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import puppeteer from "puppeteer-core"

const require = createRequire(import.meta.url)
const esbuild = require("esbuild")
mkdirSync("node_modules/.tmp", { recursive: true })
esbuild.buildSync({
  entryPoints: ["src/lib/riskModel.ts"],
  bundle: true,
  format: "esm",
  outfile: "node_modules/.tmp/riskModel.mjs",
  logLevel: "warning",
})
const rm = await import(pathToFileURL("node_modules/.tmp/riskModel.mjs").href)

const PORT = process.argv[2] || "4190"
const BASE = `http://127.0.0.1:${PORT}/`
const SHOT_DIR = "verify-shots-v6"
mkdirSync(SHOT_DIR, { recursive: true })
const log = (...a) => console.log("[verify-v6]", ...a)

const consoleErrors = []
const pageErrors = []
const badResponses = []
let failed = false

const server = spawn("cmd", ["/c", `npx vite --port ${PORT} --strictPort`], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] })
server.stdout.on("data", (d) => process.stdout.write("[vite] " + d))
server.stderr.on("data", (d) => process.stdout.write("[vite-err] " + d))
server.on("exit", (c) => log("vite exited", c))

async function waitServer(timeoutMs = 40000) {
  const t0 = Date.now()
  let lastErr = ""
  while (Date.now() - t0 < timeoutMs) {
    try { const r = await fetch(BASE); if (r.ok) return; lastErr = `HTTP ${r.status}` } catch (e) { lastErr = `${e?.message} cause=${JSON.stringify(e?.cause)}` }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`dev server 启动超时（最后错误: ${lastErr}）`)
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

  const summary = {} // 每病例 4.6 年未干预标注值，供互异断言

  for (const caseId of ["P-001", "D-01", "D-02"]) {
    const ra = rm.assessCaseRisk(caseId)
    const tag = caseId.toLowerCase().replace("-", "")

    await step(`${caseId} 密码门+设置页`, async () => {
      await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 })
      await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 10000 })
      await page.type('input[type="password"]', "Aa123456")
      await page.keyboard.press("Enter")
      await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
      await clickButton(caseId)
      await new Promise((r) => setTimeout(r, 300))
      if (caseId === "P-001") await clickButton("晨峰血压飙升")
      await clickButton("开始演示")
      await page.waitForFunction(() => document.body.innerText.includes("阶段 1/6"), { timeout: 8000 })
    })

    await step(`${caseId} 阶段1`, async () => {
      await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 20000 })
      await clickButton("下一阶段")
      await page.waitForFunction(() => document.body.innerText.includes("阶段 2/6"), { timeout: 8000 })
    })

    await step(`${caseId} 阶段2`, async () => {
      await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 60000 })
      await clickButton("下一阶段")
      await page.waitForFunction(() => document.body.innerText.includes("阶段 3/6"), { timeout: 8000 })
    })

    await step(`${caseId} 阶段3 数字对拍`, async () => {
      await page.waitForFunction(() => document.body.innerText.includes("数字孪生推演结论"), { timeout: 20000 })
      // 每个事件标注的数字必须与 riskModel 计算值一致
      for (const e of ra.events) {
        if (!(await bodyHas(e.prob))) throw new Error(`事件标注缺失: ${e.label} ${e.prob}`)
        if (!(await bodyHas(e.label))) throw new Error(`事件标签缺失: ${e.label}`)
      }
      // 结论横幅：计算的风险对 + 相对下降
      const u5 = `${(ra.yearly[5].riskUntreated * 100).toFixed(1)}%`
      const t5 = `${(ra.yearly[5].riskTreated * 100).toFixed(1)}%`
      if (!(await bodyHas(`${u5} → ${t5}`))) throw new Error(`结论横幅风险对缺失: ${u5} → ${t5}`)
      if (!(await bodyHas(`约 ${ra.eventDropPct}%`))) throw new Error(`相对下降缺失: 约 ${ra.eventDropPct}%`)
      if (!(await bodyHas("产品目标/模型假设"))) throw new Error("达标率提升未标注假设")
      summary[caseId] = ra.events.find((e) => e.year > 4 && !e.treated)?.prob
      await shot(`${tag}-stage3`)
    })

    await step(`${caseId} 口径面板`, async () => {
      await clickButton("计算口径与依据")
      await new Promise((r) => setTimeout(r, 600))
      for (const s of ["简化校准模型", "假设值", "非临床诊断工具", "蒙特卡洛", "输入参数与来源", "干预获益依据", "局限性"]) {
        if (!(await bodyHas(s))) throw new Error(`口径面板缺失: ${s}`)
      }
      // 基线结果数字
      const r10 = `${(ra.baselineRisk10 * 100).toFixed(1)}%`
      if (!(await bodyHas(r10))) throw new Error(`面板基线10年风险缺失: ${r10}`)
      // MAE/Brier 伪精度数字已移除
      if (await bodyHas("Brier")) throw new Error("Brier 伪精度数字仍在页面")
      if (await bodyHas("MAE")) throw new Error("MAE 伪精度数字仍在页面")
      await shot(`${tag}-panel`)
    })
  }

  await step("三病例数字互异", async () => {
    const vals = Object.values(summary)
    if (new Set(vals).size !== 3) throw new Error(`4.6年未干预标注未互异: ${vals.join(" / ")}`)
    log("  4.6年未干预:", Object.entries(summary).map(([k, v]) => `${k}=${v}`).join("  "))
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
  console.error("[verify-v6] 流程失败:", e.message)
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
