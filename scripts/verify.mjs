// E2E 验证脚本：启动 dev server → 无头 Chrome 走完整流程 → 截图 → 杀进程
// 用法: node scripts/verify.mjs [port]
import { spawn } from "node:child_process"
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const PORT = process.argv[2] || "4173"
const BASE = `http://localhost:${PORT}/`
const SHOT_DIR = "verify-shots"
mkdirSync(SHOT_DIR, { recursive: true })

const consoleErrors = []
const pageErrors = []
const log = (...a) => console.log("[verify]", ...a)

// ── 启动 dev server ──
const server = spawn("cmd", ["/c", `npx vite --port ${PORT} --strictPort`], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env },
})
let serverOut = ""
server.stdout.on("data", (d) => (serverOut += d.toString()))
server.stderr.on("data", (d) => (serverOut += d.toString()))

async function waitServer(timeoutMs = 40000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return true
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("dev server 启动超时\n" + serverOut)
}

let browser = null
let failed = false
try {
  await waitServer()
  log("dev server ready on", PORT)

  browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text())
  })
  page.on("pageerror", (e) => pageErrors.push(String(e)))

  const shot = (name) => page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
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

  // 清除免密记录，从密码门开始
  await page.evaluateOnNewDocument(() => localStorage.clear())

  await step("打开首页-密码门", async () => {
    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 30000 })
    await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 10000 })
    await shot("01-gate")
  })

  await step("错误密码拒绝", async () => {
    await page.type('input[type="password"]', "wrongpass")
    await page.keyboard.press("Enter")
    await new Promise((r) => setTimeout(r, 600))
    const hasErr = await page.evaluate(() => document.body.innerText.includes("密码错误"))
    if (!hasErr) throw new Error("未显示密码错误提示")
    await shot("02-gate-wrong")
  })

  await step("正确密码进入配置台", async () => {
    await page.evaluate(() => (document.querySelector('input[type="password"]').value = ""))
    await page.click('input[type="password"]', { clickCount: 3 })
    await page.type('input[type="password"]', "Aa123456")
    await page.keyboard.press("Enter")
    await page.waitForFunction(() => document.body.innerText.includes("任务配置台"), { timeout: 8000 })
    await shot("03-setup")
  })

  await step("选择病例/节奏/异常并开始", async () => {
    // 选 SIM_A 病例
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")]
      btns.find((b) => b.innerText.includes("SIM_A"))?.click()
    })
    // 选 20× 常速
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")]
      btns.find((b) => b.innerText.includes("20× 常速"))?.click()
    })
    // 选晨峰血压飙升异常
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")]
      btns.find((b) => b.innerText.includes("晨峰血压飙升"))?.click()
    })
    await shot("04-setup-configured")
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")]
      btns.find((b) => b.innerText.includes("开始演示"))?.click()
    })
    await page.waitForFunction(() => document.body.innerText.includes("STEP 1/7"), { timeout: 8000 })
  })

  // 等第 1 步完成并点击下一步的通用函数
  const waitStepDoneAndNext = async (stepNo, timeoutMs) => {
    await page.waitForFunction(() => document.body.innerText.includes("本步演示完成"), { timeout: timeoutMs })
    await shot(`05-step${stepNo}-done`)
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")]
      btns.find((b) => b.innerText.includes("下一步"))?.click()
    })
    await page.waitForFunction((n) => document.body.innerText.includes(`STEP ${n}/7`), { timeout: 8000 }, stepNo + 1)
  }

  await step("第1步 数据感知", async () => {
    await page.waitForFunction(() => document.body.innerText.includes("数据感知"), { timeout: 8000 })
    await shot("05-step1-running")
    await waitStepDoneAndNext(1, 15000)
  })

  await step("第2步 孪生建模", async () => {
    await new Promise((r) => setTimeout(r, 4000))
    await shot("06-step2-calibrating")
    await waitStepDoneAndNext(2, 20000)
  })

  await step("第3步 可信推理(DeepSeek)", async () => {
    // 等待推理输出或回放兜底（15s API 超时 + 打字机）
    await page.waitForFunction(
      () => document.body.innerText.includes("实时推理") || document.body.innerText.includes("回放模式"),
      { timeout: 25000 },
    )
    const mode = await page.evaluate(() =>
      document.body.innerText.includes("实时推理") ? "LIVE" : "REPLAY",
    )
    log("  推理模式:", mode)
    await shot("07-step3-reasoning")
    await waitStepDoneAndNext(3, 30000)
  })

  await step("第4步 干预处方", async () => {
    await new Promise((r) => setTimeout(r, 2500))
    await shot("08-step4")
    await waitStepDoneAndNext(4, 15000)
  })

  await step("第5步 任务编排", async () => {
    await new Promise((r) => setTimeout(r, 2000))
    await shot("09-step5")
    await waitStepDoneAndNext(5, 20000)
  })

  await step("第6步 执行监护+异常告警", async () => {
    // 等待自动触发（8s）后出现告警卡（Ⅲ级），再等升级Ⅱ级
    await page.waitForFunction(() => document.body.innerText.includes("加强监测"), { timeout: 20000 })
    await shot("10-step6-alert3")
    await page.waitForFunction(() => document.body.innerText.includes("通知家属/医生"), { timeout: 15000 })
    await shot("11-step6-alert2")
    const hasLatency = await page.evaluate(() => /处置指令时延/.test(document.body.innerText))
    if (!hasLatency) throw new Error("告警卡缺少处置指令时延")
    await page.waitForFunction(() => document.body.innerText.includes("本步演示完成"), { timeout: 30000 })
    await shot("12-step6-done")
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")]
      btns.find((b) => b.innerText.includes("下一步"))?.click()
    })
    await page.waitForFunction(() => document.body.innerText.includes("STEP 7/7"), { timeout: 8000 })
  })

  await step("第7步 集体进化", async () => {
    await new Promise((r) => setTimeout(r, 3000))
    const ok = await page.evaluate(
      () => document.body.innerText.includes("上限 10%") && document.body.innerText.includes("数据不出域"),
    )
    if (!ok) throw new Error("缺少边界封顶或联邦学习说明")
    await shot("13-step7")
  })

  await step("S 溯源层开关", async () => {
    await page.keyboard.press("s")
    await new Promise((r) => setTimeout(r, 800))
    const on = await page.evaluate(() => document.body.innerText.includes("实测") && document.body.innerText.includes("孪生"))
    if (!on) throw new Error("溯源角标未出现")
    await shot("14-provenance-on")
    await page.keyboard.press("s")
  })

  await step("D 详情抽屉", async () => {
    await page.keyboard.press("d")
    await new Promise((r) => setTimeout(r, 800))
    const on = await page.evaluate(() => document.body.innerText.includes("DETAIL · STEP"))
    if (!on) throw new Error("详情抽屉未打开")
    await shot("15-drawer")
    await page.keyboard.press("d")
  })

  await step("3D 场景与无错误检查", async () => {
    const canvas = await page.evaluate(() => {
      const c = document.querySelector("canvas")
      return c ? { w: c.width, h: c.height } : null
    })
    if (!canvas || canvas.w === 0) throw new Error("three.js canvas 不存在或尺寸为 0")
    log("  canvas:", JSON.stringify(canvas))
    // WebGL 上下文未丢失
    const glOk = await page.evaluate(() => {
      const c = document.querySelector("canvas")
      const gl = c.getContext("webgl2") || c.getContext("webgl")
      return !!gl && !gl.isContextLost()
    })
    if (!glOk) throw new Error("WebGL 上下文异常")
  })

  await step("重新开始回配置台", async () => {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")]
      btns.find((b) => b.innerText.includes("重新开始"))?.click()
    })
    await page.waitForFunction(() => document.body.innerText.includes("任务配置台"), { timeout: 8000 })
    await shot("16-back-to-setup")
  })

  // 过滤良性 console error
  const realErrors = consoleErrors.filter(
    (t) => !/favicon|Download the React DevTools|WebGL.*fallback|GroupMarkerNotSet|swiftshader/i.test(t),
  )
  log("console errors:", realErrors.length ? realErrors : "无")
  log("page errors:", pageErrors.length ? pageErrors : "无")
  if (realErrors.length || pageErrors.length) failed = true
} catch (e) {
  failed = true
  console.error("[verify] 流程失败:", e.message)
} finally {
  if (browser) await browser.close().catch(() => {})
  // 杀掉 dev server（Windows: taskkill /T 杀整棵进程树）
  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    killer.on("exit", resolve)
    setTimeout(resolve, 5000)
  })
  log("dev server stopped")
}
process.exit(failed ? 1 : 0)
