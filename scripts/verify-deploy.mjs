// 公网渲染验证：无头打开 GitHub Pages 站点，过密码门，截图
// 用法：node scripts/verify-deploy.mjs
import { mkdirSync } from "node:fs"
import puppeteer from "puppeteer-core"

const URL = "https://kldxg123.github.io/intellipress/"
const SHOT_DIR = "verify-shots-deploy"
mkdirSync(SHOT_DIR, { recursive: true })
const log = (...a) => console.log("[verify-deploy]", ...a)

const consoleErrors = []
let failed = false
let browser = null
try {
  browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: "new",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900 },
  })
  const page = await browser.newPage()
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()) })
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e)))
  await page.evaluateOnNewDocument(() => localStorage.clear())

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 45000 })
  await page.waitForFunction(() => document.body.innerText.includes("本演示仅对受邀人员开放"), { timeout: 15000 })
  await page.screenshot({ path: `${SHOT_DIR}/gate.png` })
  log("✓ 密码门渲染")

  await page.type('input[type="password"]', "Aa123456")
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 10000 })
  await new Promise((r) => setTimeout(r, 2500)) // 等 3D 背景稳定
  await page.screenshot({ path: `${SHOT_DIR}/setup.png` })
  log("✓ 病例设置页渲染")

  const realErrors = consoleErrors.filter(
    (t) => !/favicon|Download the React DevTools|WebGL.*fallback|GroupMarkerNotSet|swiftshader|Failed to load resource/i.test(t),
  )
  log("console errors:", realErrors.length ? realErrors : "无")
  if (realErrors.length) failed = true
} catch (e) {
  failed = true
  console.error("[verify-deploy] 失败:", e.message)
} finally {
  if (browser) await browser.close().catch(() => {})
}
log(failed ? "总体结果：存在失败项" : "总体结果：全部通过")
process.exit(failed ? 1 : 0)
