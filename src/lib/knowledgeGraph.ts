// 内置医学知识图谱（辅助判定层）：疾病 / 危险因素 / 药物 / 干预 / 指标 / 文献
// 关键节点挂载《中国高血压防治指南（2024 年修订版）》条款引用
// v8：接入文献证据库（literature.ts），文献节点经「证据支持」边挂接主题节点
import type { CaseId } from "./data"
import { LITERATURE, LIT_BY_NODE } from "./literature"

export type NodeType = "disease" | "riskfactor" | "drug" | "intervention" | "indicator" | "case" | "literature"

export interface KGNode {
  id: string
  label: string
  type: NodeType
  clause?: { no: string; text: string }
}

export type EdgeType = "合并" | "危险因素" | "首选治疗" | "生活方式干预" | "增加风险" | "降低风险" | "靶器官损害" | "监测指标" | "表型" | "证据支持"

export interface KGEdge {
  from: string
  to: string
  type: EdgeType
}

export const KG_NODES: KGNode[] = [
  // 疾病
  { id: "htn1", label: "高血压1级", type: "disease" },
  { id: "htn2", label: "高血压2级", type: "disease" },
  { id: "htn3", label: "高血压3级", type: "disease", clause: { no: "指南 5.2.1", text: "3 级高血压伴糖尿病列为很高危，应立即启动联合药物治疗" } },
  { id: "t2dm", label: "2型糖尿病", type: "disease", clause: { no: "指南 4.2.2", text: "糖尿病是心血管危险分层的独立决定因素" } },
  { id: "stroke", label: "脑卒中", type: "disease", clause: { no: "指南 1.2", text: "脑卒中是我国高血压人群最主要的心血管并发症" } },
  { id: "chd", label: "冠心病", type: "disease" },
  { id: "ckd", label: "慢性肾病", type: "disease" },
  { id: "hf", label: "心力衰竭", type: "disease" },
  { id: "maskedHtn", label: "隐匿性高血压", type: "disease", clause: { no: "指南 3.2.3", text: "隐匿性高血压需依赖动态血压监测识别，易漏诊" } },
  { id: "whiteCoat", label: "白大衣高血压", type: "disease", clause: { no: "指南 3.3.1", text: "白大衣高血压应结合诊室外血压综合判断" } },
  { id: "morningSurge", label: "晨峰型高血压", type: "disease", clause: { no: "指南 3.4.2", text: "晨峰血压与晨间心血管事件高发相关，需重点管控" } },
  // 危险因素
  { id: "smoking", label: "吸烟", type: "riskfactor" },
  { id: "obesity", label: "肥胖", type: "riskfactor", clause: { no: "指南 4.1.1", text: "BMI≥28 为高血压独立危险因素" } },
  { id: "highSalt", label: "高盐饮食", type: "riskfactor" },
  { id: "sedentary", label: "缺乏运动", type: "riskfactor" },
  { id: "elderly", label: "年龄≥65", type: "riskfactor" },
  { id: "dyslipidemia", label: "血脂异常", type: "riskfactor" },
  { id: "nonDipper", label: "非杓型节律", type: "riskfactor", clause: { no: "指南 3.2.4", text: "非杓型血压节律与靶器官损害风险相关" } },
  { id: "irregularSleep", label: "作息不规律", type: "riskfactor" },
  // 药物
  { id: "amlodipine", label: "氨氯地平", type: "drug", clause: { no: "指南 5.3.2", text: "CCB 类为一线降压药物，适用于多数高血压患者" } },
  { id: "acei", label: "ACEI/ARB", type: "drug", clause: { no: "指南 5.3.4", text: "合并糖尿病/蛋白尿者优先选用 ACEI 或 ARB" } },
  { id: "diuretic", label: "噻嗪类利尿剂", type: "drug" },
  { id: "bblocker", label: "β受体阻滞剂", type: "drug" },
  // 干预
  { id: "saltLimit", label: "限盐 <5g/日", type: "intervention", clause: { no: "指南 6.2.1", text: "钠盐摄入 <5g/日可使 SBP 下降 2–8 mmHg" } },
  { id: "briskWalk", label: "快走 30min/日", type: "intervention", clause: { no: "指南 6.2.3", text: "中等强度有氧运动 ≥30min/日，每周 5–7 次" } },
  { id: "quitSmoking", label: "戒烟", type: "intervention", clause: { no: "指南 6.2.4", text: "戒烟是心血管风险管理的基本措施" } },
  { id: "weightLoss", label: "减重 5%", type: "intervention", clause: { no: "指南 6.2.2", text: "每减重 10kg 可使 SBP 下降 5–20 mmHg" } },
  { id: "homeBP", label: "家庭血压自测", type: "intervention", clause: { no: "指南 3.5.1", text: "家庭自测血压有助于识别白大衣与隐匿性高血压" } },
  { id: "sleepReg", label: "规律作息", type: "intervention" },
  // 指标
  { id: "sbp", label: "收缩压 SBP", type: "indicator" },
  { id: "egfr", label: "eGFR", type: "indicator", clause: { no: "指南 4.1.3", text: "eGFR 下降提示早期肾损害，属靶器官损害" } },
  { id: "microalb", label: "尿微量白蛋白", type: "indicator", clause: { no: "指南 4.1.2", text: "微量白蛋白尿是靶器官损害标志" } },
  { id: "bmi", label: "BMI", type: "indicator" },
  { id: "fpg", label: "空腹血糖", type: "indicator" },
  { id: "nightDip", label: "夜间血压下降率", type: "indicator" },
]

export const KG_EDGES: KGEdge[] = [
  { from: "htn3", to: "t2dm", type: "合并" },
  { from: "htn3", to: "stroke", type: "增加风险" },
  { from: "htn3", to: "ckd", type: "增加风险" },
  { from: "htn3", to: "hf", type: "增加风险" },
  { from: "htn2", to: "stroke", type: "增加风险" },
  { from: "htn2", to: "chd", type: "增加风险" },
  { from: "htn1", to: "htn2", type: "增加风险" },
  { from: "t2dm", to: "ckd", type: "增加风险" },
  { from: "t2dm", to: "stroke", type: "增加风险" },
  { from: "smoking", to: "chd", type: "增加风险" },
  { from: "smoking", to: "stroke", type: "增加风险" },
  { from: "obesity", to: "htn1", type: "危险因素" },
  { from: "obesity", to: "t2dm", type: "危险因素" },
  { from: "highSalt", to: "sbp", type: "增加风险" },
  { from: "sedentary", to: "obesity", type: "危险因素" },
  { from: "elderly", to: "htn2", type: "危险因素" },
  { from: "dyslipidemia", to: "chd", type: "增加风险" },
  { from: "nonDipper", to: "stroke", type: "增加风险" },
  { from: "nonDipper", to: "nightDip", type: "监测指标" },
  { from: "irregularSleep", to: "nonDipper", type: "危险因素" },
  { from: "morningSurge", to: "stroke", type: "增加风险" },
  { from: "morningSurge", to: "sbp", type: "监测指标" },
  { from: "maskedHtn", to: "homeBP", type: "监测指标" },
  { from: "whiteCoat", to: "homeBP", type: "监测指标" },
  { from: "amlodipine", to: "htn3", type: "首选治疗" },
  { from: "amlodipine", to: "htn2", type: "首选治疗" },
  { from: "acei", to: "t2dm", type: "首选治疗" },
  { from: "acei", to: "microalb", type: "降低风险" },
  { from: "diuretic", to: "htn2", type: "首选治疗" },
  { from: "bblocker", to: "chd", type: "首选治疗" },
  { from: "saltLimit", to: "sbp", type: "降低风险" },
  { from: "briskWalk", to: "sbp", type: "降低风险" },
  { from: "quitSmoking", to: "chd", type: "降低风险" },
  { from: "weightLoss", to: "sbp", type: "降低风险" },
  { from: "weightLoss", to: "bmi", type: "降低风险" },
  { from: "sleepReg", to: "nightDip", type: "降低风险" },
  { from: "microalb", to: "ckd", type: "靶器官损害" },
  { from: "egfr", to: "ckd", type: "靶器官损害" },
  { from: "t2dm", to: "fpg", type: "监测指标" },
  { from: "obesity", to: "bmi", type: "监测指标" },
  { from: "htn3", to: "sbp", type: "监测指标" },
  { from: "htn2", to: "sbp", type: "监测指标" },
  { from: "htn1", to: "sbp", type: "监测指标" },
  { from: "maskedHtn", to: "htn2", type: "表型" },
  { from: "whiteCoat", to: "htn1", type: "表型" },
  { from: "morningSurge", to: "htn3", type: "表型" },
]

// 各病例的知识图谱入口实体
export const CASE_ENTITIES: Record<CaseId, string[]> = {
  "P-001": ["htn3", "t2dm", "smoking", "obesity", "microalb", "morningSurge"],
  "D-01": ["htn2", "maskedHtn", "nonDipper", "elderly"],
  "D-02": ["htn1", "whiteCoat", "obesity", "irregularSleep"],
}

export interface KGSubgraph {
  nodes: KGNode[] // 含 role 标记
  edges: KGEdge[]
  entityIds: string[] // 病例入口实体
  clauses: { no: string; text: string; from: string }[] // 命中条款（含来源节点）
}

// 按病例实体遍历：返回一跳内命中子图 + 关联条款
export function queryCaseSubgraph(caseId: CaseId): KGSubgraph {
  const seeds = CASE_ENTITIES[caseId]
  const nodeIds = new Set<string>(seeds)
  const hitEdges: KGEdge[] = []
  for (const e of KG_EDGES) {
    if (nodeIds.has(e.from) || nodeIds.has(e.to)) {
      hitEdges.push(e)
      nodeIds.add(e.from)
      nodeIds.add(e.to)
    }
  }
  const nodes = KG_NODES.filter((n) => nodeIds.has(n.id))
  const clauses = nodes
    .filter((n) => n.clause)
    .map((n) => ({ no: n.clause!.no, text: n.clause!.text, from: n.label }))
  return { nodes, edges: hitEdges, entityIds: seeds, clauses }
}

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  case: "#d97706",
  disease: "#db2777",
  riskfactor: "#d97706",
  drug: "#059669",
  intervention: "#0d9488",
  indicator: "#7c3aed",
  literature: "#4f46e5", // 靛蓝：文献/证据
}

// ── 文献证据层：文献节点 + 证据支持边（不进径向图渲染，供徽章计数与证据列表）──
export const LIT_NODES: KGNode[] = LITERATURE.map((it) => ({
  id: it.id,
  label: it.title,
  type: "literature" as const,
}))

export const LIT_EDGES: KGEdge[] = LITERATURE.flatMap((it) =>
  it.kgNodes.map((n) => ({ from: it.id, to: n, type: "证据支持" as const })),
)

// 全量图谱（含文献层），供完整性校验
export const KG_ALL_NODES: KGNode[] = [...KG_NODES, ...LIT_NODES]
export const KG_ALL_EDGES: KGEdge[] = [...KG_EDGES, ...LIT_EDGES]

// 节点关联文献计数（证据徽章）
export function evidenceCount(nodeId: string): number {
  return LIT_BY_NODE[nodeId]?.length ?? 0
}

// 当前病例子图命中的文献（子图节点关联的文献，去重）
export function caseEvidence(caseId: CaseId) {
  const sub = queryCaseSubgraph(caseId)
  const nodeIds = new Set(sub.nodes.map((n) => n.id))
  const seen = new Set<string>()
  const hits: { lit: (typeof LITERATURE)[number]; viaNodes: string[] }[] = []
  for (const it of LITERATURE) {
    const via = it.kgNodes.filter((n) => nodeIds.has(n))
    if (via.length && !seen.has(it.id)) {
      seen.add(it.id)
      hits.push({ lit: it, viaNodes: via })
    }
  }
  return { subgraph: sub, hits }
}
