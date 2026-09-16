// 单点确认：设置页在动画结束后的真实渲染状态
import { spawn } from "node:child_process"
import puppeteer from "puppeteer-core"

const PORT = "4185"
const server = spawn("cmd", ["/c", `npx vite --port ${PORT} --strictPort`], { cwd: process.cwd(), stdio: "ignore" })

async function waitServer(t = 40000) {
  const t0 = Date.now()
  while (Date.now() - t0 < t) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error("timeout")
}

let browser = null
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
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle2" })
  await page.type('input[type="password"]', "Aa123456")
  await page.keyboard.press("Enter")
  await page.waitForFunction(() => document.body.innerText.includes("示教病例设置"), { timeout: 8000 })
  await new Promise((r) => setTimeout(r, 2500)) // 等 fade-up 动画全部结束
  const cards = await page.evaluate(() => document.querySelectorAll("section.panel").length)
  const opacities = await page.evaluate(() =>
    [...document.querySelectorAll(".fade-up")].map((e) => getComputedStyle(e).opacity),
  )
  console.log("[check] sections:", cards, "fade-up opacities:", opacities.join(","))
  await page.screenshot({ path: "verify-shots-v2/17-setup-settled.png" })
  console.log("[check] screenshot saved")
} finally {
  if (browser) await browser.close().catch(() => {})
  await new Promise((res) => {
    const k = spawn("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    k.on("exit", res)
    setTimeout(res, 5000)
  })
}
