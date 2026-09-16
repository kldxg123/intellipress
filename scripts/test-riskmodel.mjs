// 风险模型引擎单元测试：esbuild 打包 TS 后直接 import 断言
// 用法：node scripts/test-riskmodel.mjs
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"

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

const m = await import(pathToFileURL("node_modules/.tmp/riskModel.mjs").href)

let pass = 0, fail = 0
function ok(cond, label, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` (${extra})` : ""}`) }
  else { fail++; console.error(`  ✗ ${label} ${extra}`) }
}
function approx(actual, expected, tol, label) {
  ok(Math.abs(actual - expected) <= tol, label, `期望≈${expected}±${tol} 实际=${actual.toFixed(4)}`)
}

const ids = ["P-001", "D-01", "D-02"]
const A = Object.fromEntries(ids.map((id) => [id, m.assessCaseRisk(id)]))

console.log("■ 三病例基线风险（打印实测值）")
for (const id of ids) {
  const a = A[id]
  console.log(
    `  ${id}: 10年=${(a.baselineRisk10 * 100).toFixed(2)}% 5年=${(a.baselineRisk5 * 100).toFixed(2)}% ` +
      `分层=${a.tier} 目标SBP=${a.targetSbp} 5年未干预=${(a.yearly[5].riskUntreated * 100).toFixed(2)}% ` +
      `5年干预=${(a.yearly[5].riskTreated * 100).toFixed(2)}% 相对下降=${a.eventDropPct}% ` +
      `MC未干预=${(a.monteCarlo.untreatedMean * 100).toFixed(2)}% [${(a.monteCarlo.untreatedCi[0] * 100).toFixed(2)},${(a.monteCarlo.untreatedCi[1] * 100).toFixed(2)}]`
  )
}

console.log("■ 量级区间（任务书 sanity 区间）")
ok(A["P-001"].yearly[5].riskUntreated >= 0.08 && A["P-001"].yearly[5].riskUntreated <= 0.15, "P-001 5年未干预风险 8–15%", (A["P-001"].yearly[5].riskUntreated * 100).toFixed(1) + "%")
ok(A["P-001"].yearly[5].riskTreated >= 0.04 && A["P-001"].yearly[5].riskTreated <= 0.08, "P-001 5年干预风险 4–8%", (A["P-001"].yearly[5].riskTreated * 100).toFixed(1) + "%")
ok(A["D-02"].yearly[5].riskUntreated >= 0.015 && A["D-02"].yearly[5].riskUntreated <= 0.05, "D-02 5年未干预风险 1.5–5%", (A["D-02"].yearly[5].riskUntreated * 100).toFixed(1) + "%")
ok(A["D-01"].yearly[5].riskUntreated < A["P-001"].yearly[5].riskUntreated, "D-01 未干预风险 < P-001")

console.log("■ 单调性：未干预逐年↑、干预 < 未干预")
for (const id of ids) {
  const y = A[id].yearly
  let mono = true
  for (let i = 1; i <= 5; i++) if (y[i].riskUntreated < y[i - 1].riskUntreated) mono = false
  ok(mono, `${id} 未干预累计风险逐年不降`)
  let trLower = true
  for (let i = 1; i <= 5; i++) if (y[i].riskTreated >= y[i].riskUntreated) trLower = false
  ok(trLower, `${id} 干预风险各年均低于未干预`)
}

console.log("■ 换算与 RRR 正确性")
approx(m.toFiveYear(0.10), 1 - Math.pow(0.9, 0.5), 1e-9, "10年10% → 5年换算公式")
const { rr } = m.treatmentRR(10)
approx(rr, 0.8, 1e-9, "Δ10mmHg → RR=0.80（主要心血管事件 −20%）")
approx(m.treatmentRR(20).rr, 0.64, 1e-9, "Δ20mmHg → RR=0.64（log-linear）")
ok(m.treatmentRR(50).effectiveDelta === 35, "Δ50mmHg → 有效幅度封顶 35")
ok(m.treatmentRR(-5).rr === 1, "负 Δ → RR=1（无获益）")

console.log("■ 边界输入不 NaN")
const base = { ...m.RISK_INPUTS["P-001"] }
for (const [age, sbp] of [[35, 90], [75, 200], [40, 130]]) {
  const r = m.chinaParSimplified10Y({ ...base, age, sbp })
  ok(Number.isFinite(r) && r >= 0 && r < 1, `年龄${age}/SBP${sbp} → 风险有限且在 [0,1)`, (r * 100).toFixed(2) + "%")
}

console.log("■ 人群 sanity：参考画像 vs Li 2019 公开均值（男~3.8%/女~1.3%，同量级即可）")
const refMale = m.chinaParSimplified10Y({ ...base, sex: "male", age: 55, sbp: 125, tc: 5.0, hdl: 1.3, wc: 85, smoking: 0, diabetes: 0, treated: 0, north: 0, urban: 0, famhist: 0 })
const refFemale = m.chinaParSimplified10Y({ ...base, sex: "female", age: 55, sbp: 125, tc: 5.0, hdl: 1.3, wc: 80, smoking: 0, diabetes: 0, treated: 0, north: 0, urban: 0, famhist: 0 })
ok(refMale > 0.01 && refMale < 0.08, "参考男性 10年风险同量级 (~3.8%)", (refMale * 100).toFixed(2) + "%")
ok(refFemale > 0.003 && refFemale < 0.03, "参考女性 10年风险同量级 (~1.3%)", (refFemale * 100).toFixed(2) + "%")
ok(refMale > refFemale, "男性参考风险 > 女性（与公开数据一致）")

console.log("■ 蒙特卡洛：均值与解析值同量级、区间包含均值、可复现")
for (const id of ids) {
  const a = A[id]
  const analytic = a.yearly[5].riskUntreated
  ok(a.monteCarlo.n === 2000, `${id} 抽样 2,000 次`)
  ok(a.monteCarlo.untreatedCi[0] <= a.monteCarlo.untreatedMean && a.monteCarlo.untreatedMean <= a.monteCarlo.untreatedCi[1], `${id} CI 包含均值`)
  ok(Math.abs(a.monteCarlo.untreatedMean - analytic) < Math.max(0.03, analytic * 0.5), `${id} MC均值≈解析值`, `MC=${(a.monteCarlo.untreatedMean * 100).toFixed(1)}% 解析=${(analytic * 100).toFixed(1)}%`)
}
const again = m.assessCaseRisk("P-001")
ok(again.monteCarlo.untreatedMean === A["P-001"].monteCarlo.untreatedMean, "同种子重复运行结果一致")

console.log("■ 三病例事件数字互不相同")
const probs = ids.map((id) => A[id].events.find((e) => e.label === "心脑血管事件风险" && !e.treated && e.year > 4)?.prob)
ok(new Set(probs).size === 3, "4.6 年未干预风险标注三病例互异", probs.join(" / "))

console.log("■ 口径标注完整性")
for (const id of ids) {
  const a = A[id]
  ok(a.modelMeta.isSimplified === true, `${id} 标注为简化模型`)
  ok(a.modelMeta.limitations.length >= 3, `${id} 局限性 ≥3 条`)
  ok(a.inputs.some((i) => i.assumed), `${id} 输入含假设值标注`)
  ok(a.ttrGain.basis.includes("假设"), `${id} 达标率提升标注为假设`)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
