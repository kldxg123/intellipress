// 方案规则引擎单元测试：esbuild 打包 TS 后直接 import 断言
// 用法：node scripts/test-plan.mjs
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
const esbuild = require("esbuild")

mkdirSync("node_modules/.tmp", { recursive: true })
esbuild.buildSync({
  entryPoints: ["src/lib/planEngine.ts"],
  bundle: true,
  format: "esm",
  outfile: "node_modules/.tmp/planEngine.mjs",
  logLevel: "warning",
})

const pe = await import(pathToFileURL("node_modules/.tmp/planEngine.mjs").href)

let pass = 0, fail = 0
function ok(cond, label, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` (${extra})` : ""}`) }
  else { fail++; console.error(`  ✗ ${label} ${extra}`) }
}

const ids = ["P-001", "D-01", "D-02"]
const plans = Object.fromEntries(ids.map((id) => [id, pe.generatePlan(id)]))
const allText = (p) => p.sections.map((s) => s.items.map((i) => i.text).join("\n")).join("\n")
const texts = Object.fromEntries(ids.map((id) => [id, allText(plans[id])]))

console.log("■ 结构：五维度齐全")
for (const id of ids) {
  const keys = plans[id].sections.map((s) => s.key)
  ok(JSON.stringify(keys) === JSON.stringify(["medication", "diet", "exercise", "sleep", "followup"]), `${id} 五维度齐全`)
  ok(plans[id].sections.every((s) => s.items.length >= 3), `${id} 每维度 ≥3 条`)
}

console.log("■ 用药策略互异")
ok(texts["P-001"].includes("氨氯地平 5mg") && texts["P-001"].includes("ARB"), "P-001 联合用药 CCB+ARB")
ok(texts["P-001"].includes("晨起即服") || texts["P-001"].includes("醒后即服"), "P-001 晨峰→晨起即服")
ok(texts["P-001"].includes("血钾"), "P-001 4 周复查肾功能/血钾")
ok(texts["D-01"].includes("晚间给药"), "D-01 晚间给药校正节律")
ok(texts["D-01"].includes("2.5mg"), "D-01 老年低剂量起始")
ok(texts["D-01"].includes("跌倒"), "D-01 跌倒风险提示")
ok(texts["D-02"].includes("暂缓用药"), "D-02 暂缓用药")
ok(texts["D-02"].includes("3 个月生活方式干预"), "D-02 生活方式干预期")
ok(texts["D-02"].includes("24h 动态血压"), "D-02 动态血压确诊白大衣")
ok(plans["P-001"].medTaskLabel !== null && plans["D-01"].medTaskLabel !== null && plans["D-02"].medTaskLabel === null, "服药任务：P-001/D-01 有，D-02 无")

console.log("■ 靶心率 (220−年龄)×60–70%")
const hr = { "P-001": [97, 113], "D-01": [93, 109], "D-02": [107, 125] }
for (const id of ids) {
  const [lo, hi] = pe.targetHeartRate(id === "P-001" ? 58 : id === "D-01" ? 65 : 42)
  ok(lo === hr[id][0] && hi === hr[id][1], `${id} 靶心率 ${hr[id][0]}–${hr[id][1]}`, `实际 ${lo}–${hi}`)
  ok(texts[id].includes(`${hr[id][0]}–${hr[id][1]}`), `${id} 方案文本含靶心率区间`)
}
ok(texts["P-001"].includes("医师评估"), "P-001 很高危运动前医师评估")
ok(texts["D-01"].includes("太极"), "D-01 低冲击运动")
ok(texts["D-02"].includes("150min"), "D-02 每周 ≥150min")

console.log("■ 测量频次与分层匹配")
ok(plans["P-001"].measureFreqDesc.includes("每日早晚 2 次"), "P-001 很高危 → 每日 2 次")
ok(plans["D-01"].measureFreqDesc.includes("夜间"), "D-01 高危+非杓型 → 含夜间")
ok(plans["D-02"].measureFreqDesc.includes("每周 3 天"), "D-02 中危 → 每周 3 天")

console.log("■ 达标线按合并症区分")
ok(plans["P-001"].targetBP === "<130/80", "P-001 糖尿病 → <130/80")
ok(plans["D-01"].targetBP === "<140/90", "D-01 → <140/90")
ok(plans["D-02"].targetBP === "<140/90", "D-02 → <140/90")

console.log("■ 复诊节点互异")
ok(plans["P-001"].reviewNode === "2 周", "P-001 → 2 周")
ok(plans["D-01"].reviewNode === "4 周", "D-01 → 4 周")
ok(plans["D-02"].reviewNode === "3 个月", "D-02 → 3 个月")

console.log("■ 膳食差异")
ok(texts["P-001"].includes("碳水化合物供能比"), "P-001 控碳水")
ok(texts["D-02"].includes("500kcal") && texts["D-02"].includes("减重 5%"), "D-02 减重目标+热量缺口")
for (const id of ids) ok(texts[id].includes("<2000mg") || texts[id].includes("<5g"), `${id} 限盐口径`)
const menus = ids.map((id) => texts[id].match(/一日示例食谱：(.+)/)?.[1])
ok(new Set(menus).size === 3, "一日食谱三病例互异")

console.log("■ 戒烟计划仅 P-001（吸烟 20 年）")
ok(texts["P-001"].includes("戒烟"), "P-001 戒烟计划节点")
ok(!texts["D-01"].includes("戒烟计划") && !texts["D-02"].includes("戒烟计划"), "D-01/D-02 无戒烟计划")

console.log("■ 照护任务时间轴（供阶段5）")
for (const id of ids) {
  const ts = plans[id].careTasks
  ok(ts.length >= 5, `${id} 任务 ≥5 条`, `${ts.length} 条`)
  const sorted = [...ts].sort((a, b) => a.time.localeCompare(b.time))
  ok(JSON.stringify(ts) === JSON.stringify(sorted), `${id} 任务按时间排序`)
}
ok(plans["P-001"].careTasks.some((t) => t.task.includes("晨起即服")), "P-001 时间轴含晨起服药")
ok(plans["D-01"].careTasks.some((t) => t.time === "20:00" && t.task.includes("晚间给药")), "D-01 时间轴含 20:00 晚间服药")
ok(plans["D-01"].careTasks.some((t) => t.time === "22:30"), "D-01 时间轴含 22:30 夜间监测")
ok(plans["D-02"].careTasks.some((t) => t.task.includes("每周 3 天")), "D-02 时间轴测量频次对齐")
ok(!plans["D-02"].careTasks.some((t) => t.task.includes("服药")), "D-02 时间轴无服药任务")

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
