// 规则引擎 / 知识图谱单元测试：esbuild 打包 TS 后直接 import 断言
// 用法：node scripts/test-guidelines.mjs
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
const esbuild = require("esbuild")

mkdirSync("node_modules/.tmp", { recursive: true })
for (const mod of ["guidelines", "knowledgeGraph"]) {
  esbuild.buildSync({
    entryPoints: [`src/lib/${mod}.ts`],
    bundle: true,
    format: "esm",
    outfile: `node_modules/.tmp/${mod}.mjs`,
    logLevel: "warning",
  })
}

const g = await import(pathToFileURL("node_modules/.tmp/guidelines.mjs").href)
const k = await import(pathToFileURL("node_modules/.tmp/knowledgeGraph.mjs").href)

let pass = 0, fail = 0
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.error(`  ✗ ${label}\n    期望 ${JSON.stringify(expected)} 实际 ${JSON.stringify(actual)}`) }
}

console.log("■ 血压分级 gradeBP")
eq(g.gradeBP(115, 75).level, -1, "115/75 → 正常")
eq(g.gradeBP(130, 85).level, 0, "130/85 → 正常高值")
eq(g.gradeBP(151, 95).level, 1, "151/95 → 1 级")
eq(g.gradeBP(168, 102).level, 2, "168/102 → 2 级")
eq(g.gradeBP(186, 112).level, 3, "186/112 → 3 级")
eq(g.gradeBP(145, 105).level, 2, "145/105 → 取较高者 2 级")

console.log("■ 三病例危险分层 assessCase")
const a1 = g.assessCase("P-001")
eq(a1.grade.level, 3, "P-001 分级 3 级")
eq(a1.risk, "很高危", "P-001 分层 很高危")
eq(a1.matrixRow, 2, "P-001 矩阵行 = ≥3RF/糖尿病 (row 2)")
eq(a1.matrixCol, 2, "P-001 矩阵列 = 3 级 (col 2)")
eq(a1.rfCount, 5, "P-001 危险因素 5 个")

const a2 = g.assessCase("D-01")
eq(a2.grade.level, 2, "D-01 分级 2 级")
eq(a2.risk, "高危", "D-01 分层 高危")
eq(a2.matrixRow, 2, "D-01 矩阵行 = TOD 非杓型 (row 2)")
eq(a2.matrixCol, 1, "D-01 矩阵列 = 2 级 (col 1)")
eq(a2.hasTOD, true, "D-01 存在靶器官损害等危征")

const a3 = g.assessCase("D-02")
eq(a3.grade.level, 1, "D-02 分级 1 级")
eq(a3.risk, "中危", "D-02 分层 中危")
eq(a3.matrixRow, 1, "D-02 矩阵行 = 1-2 个 RF (row 1)")
eq(a3.matrixCol, 0, "D-02 矩阵列 = 1 级 (col 0)")
eq(a3.rfCount, 2, "D-02 危险因素 2 个")

eq(g.RISK_MATRIX[2][2], "很高危", "矩阵 [2][2] = 很高危")
eq(a1.clauses.length >= 3 && a2.clauses.length >= 3 && a3.clauses.length >= 3, true, "每病例 ≥3 条指南条款引用")
eq(typeof g.engineSummary(a1), "string", "engineSummary 输出字符串")
eq(g.engineSummary(a1).includes("很高危"), true, "engineSummary 含分层结论")

console.log("■ 知识图谱 queryCaseSubgraph")
for (const [cid, seeds] of Object.entries(k.CASE_ENTITIES)) {
  const sg = k.queryCaseSubgraph(cid)
  eq(sg.entityIds, seeds, `${cid} 入口实体一致`)
  eq(sg.nodes.length > seeds.length, true, `${cid} 子图含一跳邻点 (${sg.nodes.length} 节点)`)
  eq(sg.clauses.length >= 3, true, `${cid} 命中条款 ≥3 (${sg.clauses.length} 条)`)
  eq(sg.edges.every((e) => sg.nodes.some((n) => n.id === e.from) && sg.nodes.some((n) => n.id === e.to)), true, `${cid} 边端点均在子图内`)
}
eq(k.KG_NODES.length, 35, `图谱节点数 = ${k.KG_NODES.length}`)
eq(k.KG_EDGES.length, 46, `图谱边数 = ${k.KG_EDGES.length}`)
eq(new Set(k.KG_EDGES.map((e) => e.type)).size, 8, "实际使用边类型 8 种")

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
