// 文献证据库单元测试：esbuild 打包 TS 后直接 import 断言
// 用法：node scripts/test-literature.mjs
import { createRequire } from "node:module"
import { mkdirSync } from "node:fs"
import { pathToFileURL } from "node:url"

const require = createRequire(import.meta.url)
const esbuild = require("esbuild")

mkdirSync("node_modules/.tmp", { recursive: true })
esbuild.buildSync({
  entryPoints: ["src/lib/knowledgeGraph.ts"],
  bundle: true,
  format: "esm",
  outfile: "node_modules/.tmp/knowledgeGraph.mjs",
  logLevel: "warning",
})

const kg = await import(pathToFileURL("node_modules/.tmp/knowledgeGraph.mjs").href)

let pass = 0, fail = 0
function ok(cond, label, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` (${extra})` : ""}`) }
  else { fail++; console.error(`  ✗ ${label} ${extra}`) }
}

esbuild.buildSync({
  entryPoints: ["src/lib/literature.ts"],
  bundle: true,
  format: "esm",
  outfile: "node_modules/.tmp/literature.mjs",
  logLevel: "warning",
})
const L = await import(pathToFileURL("node_modules/.tmp/literature.mjs").href)

console.log("■ 条目规模与去重")
ok(L.LITERATURE.length === 71, "文献总数 71 篇", `实际 ${L.LITERATURE.length}`)
ok(L.LIT_TOTAL === 71, "LIT_TOTAL === 71")
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9一-鿿]/g, "")
const titleSet = new Set(L.LITERATURE.map((it) => norm(it.title)))
ok(titleSet.size === L.LITERATURE.length, "无重复标题（规范化后）")
const idSet = new Set(L.LITERATURE.map((it) => it.id))
ok(idSet.size === L.LITERATURE.length, "id 全局唯一")

console.log("■ 元数据完整性")
ok(L.LITERATURE.every((it) => it.title.length > 5), "每条标题非空")
ok(L.LITERATURE.every((it) => it.author.length > 0), "每条第一作者非空")
ok(L.LITERATURE.every((it) => it.topics.length > 0), "每条 topics 非空")
ok(L.LITERATURE.every((it) => Array.isArray(it.kgNodes)), "每条 kgNodes 为数组")
ok(!L.LITERATURE.some((it) => it.title.includes("Nomes de Lugar")), "误下载哲学论文（Cacciari）已排除")

console.log("■ 五大分类计数 = 13 / 4 / 15 / 4 / 35")
const expect5 = { "大模型×高血压": 13, "数字孪生": 4, "真实数据": 15, "数据统计": 4, "生活方式与综合管理": 35 }
for (const [cat, n] of Object.entries(expect5)) {
  ok((L.LIT_BY_CATEGORY[cat] ?? []).length === n, `${cat} = ${n} 篇`, `实际 ${(L.LIT_BY_CATEGORY[cat] ?? []).length}`)
}
ok(Object.values(L.LIT_BY_CATEGORY).reduce((s, a) => s + a.length, 0) === 71, "五类合计 71")

console.log("■ 图谱闭合：证据支持边端点均在全量节点内")
const allNodeIds = new Set(kg.KG_ALL_NODES.map((n) => n.id))
ok(kg.LIT_NODES.length === 71, "LIT_NODES = 71", `实际 ${kg.LIT_NODES.length}`)
ok(kg.LIT_NODES.every((n) => n.type === "literature"), "文献节点类型 = literature")
ok(kg.KG_ALL_NODES.length === kg.KG_NODES.length + 71, "KG_ALL_NODES = 医学节点 + 71")
ok(kg.LIT_EDGES.length > 0, "存在证据支持边", `${kg.LIT_EDGES.length} 条`)
ok(kg.LIT_EDGES.every((e) => e.type === "证据支持"), "文献边类型均为「证据支持」")
ok(kg.LIT_EDGES.every((e) => allNodeIds.has(e.from) && allNodeIds.has(e.to)), "LIT_EDGES 端点闭合")
ok(kg.LIT_EDGES.every((e) => e.from.startsWith("lit")), "证据边 from 均为文献节点")
ok(kg.LIT_EDGES.every((e) => !e.to.startsWith("lit")), "证据边 to 均为医学节点")

console.log("■ 证据计数：关键节点挂有文献")
for (const nid of ["saltLimit", "homeBP", "amlodipine", "elderly", "briskWalk", "whiteCoat", "maskedHtn", "microalb", "t2dm", "stroke", "hf", "sleepReg"]) {
  ok(kg.evidenceCount(nid) > 0, `evidenceCount(${nid}) > 0`, `实际 ${kg.evidenceCount(nid)}`)
}
ok(kg.evidenceCount("smoking") === 0, "无文献节点计数为 0（smoking）")
ok(Object.values(L.LIT_BY_NODE).reduce((s, a) => s + a.length, 0) === kg.LIT_EDGES.length, "LIT_BY_NODE 与 LIT_EDGES 数一致")

console.log("■ 病例证据命中：三病例 hits > 0 且互异")
const hitsOf = (id) => kg.caseEvidence(id).hits
const hitIds = Object.fromEntries(["P-001", "D-01", "D-02"].map((id) => [id, hitsOf(id).map((h) => h.lit.id)]))
for (const id of ["P-001", "D-01", "D-02"]) {
  ok(hitIds[id].length > 0, `${id} 命中文献 > 0`, `${hitIds[id].length} 篇`)
  ok(hitsOf(id).every((h) => h.viaNodes.length > 0), `${id} 每条命中均含 viaNodes`)
}
ok(JSON.stringify(hitIds["P-001"]) !== JSON.stringify(hitIds["D-01"]), "P-001 与 D-01 命中集互异")
ok(JSON.stringify(hitIds["D-01"]) !== JSON.stringify(hitIds["D-02"]), "D-01 与 D-02 命中集互异")
ok(hitIds["P-001"].includes("lit001"), "P-001 命中氨氯地平文献（lit001 Hutton 2013）")
ok(hitIds["D-01"].includes("lit032"), "D-01 命中隐匿性文献（lit032 移动日志）")
ok(hitIds["D-02"].includes("lit017"), "D-02 命中白大衣文献（lit017）")
ok(kg.caseEvidence("P-001").hits.every((h) => h.viaNodes.every((n) => allNodeIds.has(n))), "viaNodes 均在图谱内")

console.log("■ 无挂接文献为「综合证据」兜底")
const noNode = L.LITERATURE.filter((it) => it.kgNodes.length === 0)
ok(noNode.length === 26, "综合证据（无节点）26 篇", `实际 ${noNode.length}`)
ok(noNode.every((it) => it.topics.includes("综合证据") || it.topics.length > 0), "无节点文献仍有主题标签")

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
