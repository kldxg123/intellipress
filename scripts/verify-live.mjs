// 公网 LIVE 验证：无头打开 GitHub Pages 站点，走到阶段 2，断言「实时解读」LIVE 徽标（非回放）
// 用法：node scripts/verify-live.mjs   （CI 中设 CHROME_PATH=/usr/bin/google-chrome）
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const URL = "https://kldxg123.github.io/intellipress/"
const SHOT_DIR = "verify-shots-v9"
mkdirSync(SHOT_DIR, { recursive: true })
const log = (...a) => console.log("[verify-live]", ...a)

const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const consoleErrors = []
let failed = false
let browser = null
try {
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()) })
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e)))
  await page.evaluateOnNewDocument(() => localStorage.clear())

  const clickButton = (txt) =>
    page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.innerText.includes(t))?.click(), txt)

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 })
  await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 30000 })
  await page.type('input[type="password"]', "Aa123456")
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 10000 })
  await clickButton("P-001")
  await new Promise((r) => setTimeout(r, 300))
  await clickButton("开始演示")
  await page.waitForFunction(() => document.body.innerText.includes("阶段 1/6"), { timeout: 10000 })
  await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 30000 })
  await clickButton("下一阶段")
  await page.waitForFunction(() => document.body.innerText.includes("阶段 2/6"), { timeout: 10000 })
  // 阶段 2 LLM 解读耗时长，放宽 180s
  await page.waitForFunction(() => document.body.innerText.includes("本阶段演示完成"), { timeout: 180000 })

  const text = await page.evaluate(() => document.body.innerText)
  if (!text.includes("实时解读")) throw new Error("未出现「实时解读」LIVE 徽标")
  if (text.includes("回放模式")) throw new Error("仍处于回放模式，Worker 未生效")
  if (!text.includes("很高危")) throw new Error("阶段2 分层结论未渲染")
  log("✓ 阶段2 LIVE 徽标确认（实时解读 · DeepSeek）")

  // 徽标特写 + 全图
  const badge = await page.evaluateHandle(() =>
    [...document.querySelectorAll("span")].find((s) => s.innerText.includes("实时解读")))
  if (badge) {
    const el = badge.asElement()
    if (el) await el.screenshot({ path: `${SHOT_DIR}/live-badge.png` }).catch(() => {})
  }
  await page.screenshot({ path: `${SHOT_DIR}/stage2-live.png` })
  log("✓ 截图已存", SHOT_DIR)

  const realErrors = consoleErrors.filter(
    (t) => !/favicon|Download the React DevTools|WebGL.*fallback|GroupMarkerNotSet|swiftshader|AbortError|Failed to load resource/i.test(t),
  )
  log("console errors:", realErrors.length ? realErrors : "无")
  if (realErrors.length) failed = true
} catch (e) {
  failed = true
  console.error("[verify-live] 失败:", e.message)
} finally {
  if (browser) await browser.close().catch(() => {})
}
log(failed ? "总体结果：存在失败项" : "总体结果：全部通过")
process.exit(failed ? 1 : 0)
