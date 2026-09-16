// 改名复核：起 dev server → 无头 Chrome 检查标题与品牌文案 → 关闭
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const PORT = 4183;
const server = spawn('npm.cmd', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], {
  cwd: process.cwd(), stdio: 'pipe', shell: true,
});
let ready = false;
server.stdout.on('data', (d) => { if (String(d).includes('Local:')) ready = true; });
server.stderr.on('data', () => {});

const t0 = Date.now();
while (!ready && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 300));
if (!ready) { console.error('SERVER_NOT_READY'); server.kill('SIGKILL'); process.exit(1); }

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  const title = await page.title();
  const gateText = await page.$eval('h1', el => el.textContent).catch(() => '(no h1)');
  console.log('TITLE:', title);
  console.log('GATE_H1:', gateText);
  console.log('PAGE_ERRORS:', errors.length ? errors.join(' | ') : 'none');
  console.log(title.includes('IntelliPress') && !title.includes('Twin') ? 'RENAME_OK' : 'RENAME_FAIL');
} finally {
  await browser.close();
  spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
}
