// 《中国高血压防治指南（2024 年修订版）》确定性规则引擎
// 医学判断主体：血压分级 + 危险分层全部由本引擎作出，大模型仅负责解释
import type { CaseId } from "./data"

// ── 血压分级表（指南 3.4 表 2，按收缩/舒张较高者定级；本引擎按最高测值定级）──
export interface GradeRow {
  level: 0 | 1 | 2 | 3 | -1 // -1 正常，0 正常高值
  label: string
  range: string
  sbpLo: number
  sbpHi: number
  dbpLo: number
  dbpHi: number
}

export const BP_GRADE_TABLE: GradeRow[] = [
  { level: -1, label: "正常", range: "<120 / <80", sbpLo: 0, sbpHi: 119, dbpLo: 0, dbpHi: 79 },
  { level: 0, label: "正常高值", range: "120–139 / 80–89", sbpLo: 120, sbpHi: 139, dbpLo: 80, dbpHi: 89 },
  { level: 1, label: "1 级（轻度）", range: "140–159 / 90–99", sbpLo: 140, sbpHi: 159, dbpLo: 90, dbpHi: 99 },
  { level: 2, label: "2 级（中度）", range: "160–179 / 100–109", sbpLo: 160, sbpHi: 179, dbpLo: 100, dbpHi: 109 },
  { level: 3, label: "3 级（重度）", range: "≥180 / ≥110", sbpLo: 180, sbpHi: 999, dbpLo: 110, dbpHi: 999 },
]

export interface GradeResult {
  row: GradeRow
  level: number
  label: string
  basis: string // 定级依据说明
  hitIndex: number // 命中行下标
}

export function gradeBP(sbp: number, dbp: number): GradeResult {
  if (!Number.isFinite(sbp) || !Number.isFinite(dbp) || sbp <= 0 || dbp <= 0) {
    throw new RangeError("血压必须为有限正数")
  }
  // 使用连续下限，覆盖多次测量均值产生的小数，不在 139 与 140 等边界留空隙。
  const sbpRow = [...BP_GRADE_TABLE].reverse().find((r) => sbp >= r.sbpLo)!
  const dbpRow = [...BP_GRADE_TABLE].reverse().find((r) => dbp >= r.dbpLo)!
  const sbpLevel = sbpRow.level
  const dbpLevel = dbpRow.level
  const level = Math.max(sbpLevel, dbpLevel)
  const hitIndex = BP_GRADE_TABLE.findIndex((r) => r.level === level)
  const row = BP_GRADE_TABLE[hitIndex]
  return {
    row,
    level,
    label: row.label,
    basis: `SBP ${sbp} → ${sbpRow.label}；DBP ${dbp} → ${dbpRow.label}；取较高者`,
    hitIndex,
  }
}

// ── 危险分层矩阵（指南 4.2 表 5）──
export const MATRIX_ROWS = ["无危险因素", "1–2 个危险因素", "≥3 个危险因素 / 靶器官损害 / 糖尿病", "临床并发症"] as const
export const MATRIX_COLS = ["1 级", "2 级", "3 级"] as const
export const RISK_MATRIX: string[][] = [
  ["低危", "中危", "高危"],
  ["中危", "中危", "很高危"],
  ["高危", "高危", "很高危"],
  ["很高危", "很高危", "很高危"],
]

// ── 危险因素 / 靶器官损害 / 临床并发症核对项 ──
export type FactorCategory = "RF" | "TOD" | "CC"
export const CATEGORY_LABEL: Record<FactorCategory, string> = {
  RF: "危险因素",
  TOD: "靶器官损害",
  CC: "临床并发症",
}

export interface RiskFactorItem {
  key: string
  label: string
  category: FactorCategory
  present: boolean
  note?: string
}

// ── 病例结构化临床数据（供引擎核对；峰值用于按最高测值定级）──
export interface CaseClinical {
  baseSbp: number
  baseDbp: number
  peakSbp: number
  peakDbp: number
  peakNote: string // 峰值来源说明
  factors: RiskFactorItem[]
}

export const CASE_CLINICAL: Record<CaseId, CaseClinical> = {
  "P-001": {
    baseSbp: 178,
    baseDbp: 102,
    peakSbp: 186,
    peakDbp: 112,
    peakNote: "晨峰时段最高测值 186/112",
    factors: [
      { key: "age", label: "年龄（男>55）", category: "RF", present: true, note: "男 58 岁" },
      { key: "smoking", label: "吸烟", category: "RF", present: true, note: "20 年烟龄" },
      { key: "diabetes", label: "糖尿病", category: "RF", present: true, note: "2 型糖尿病 5 年" },
      { key: "obesity", label: "肥胖（BMI≥28）", category: "RF", present: true, note: "BMI 28.6" },
      { key: "sedentary", label: "缺乏运动", category: "RF", present: true },
      { key: "dyslipidemia", label: "血脂异常", category: "RF", present: false },
      { key: "family", label: "早发心血管病家族史", category: "RF", present: false },
      { key: "microalb", label: "微量白蛋白尿", category: "TOD", present: true, note: "86 mg/L ↑" },
      { key: "lvh", label: "左心室肥厚", category: "TOD", present: false },
      { key: "stroke", label: "脑卒中病史", category: "CC", present: false },
      { key: "chd", label: "冠心病/心衰/肾病", category: "CC", present: false },
    ],
  },
  "D-01": {
    baseSbp: 156,
    baseDbp: 94,
    peakSbp: 168,
    peakDbp: 102,
    peakNote: "动态血压最高测值 168/102（隐匿性）",
    factors: [
      { key: "age", label: "年龄（女≥65）", category: "RF", present: true, note: "女 65 岁" },
      { key: "smoking", label: "吸烟", category: "RF", present: false },
      { key: "diabetes", label: "糖尿病", category: "RF", present: false },
      { key: "obesity", label: "肥胖（BMI≥28）", category: "RF", present: false },
      { key: "nonDipper", label: "血压节律异常（夜间非杓型）", category: "TOD", present: true, note: "夜间下降 <10%" },
      { key: "microalb", label: "微量白蛋白尿", category: "TOD", present: false },
      { key: "stroke", label: "脑卒中病史", category: "CC", present: false },
    ],
  },
  "D-02": {
    baseSbp: 148,
    baseDbp: 92,
    peakSbp: 151,
    peakDbp: 95,
    peakNote: "诊室复测最高值 151/95（家庭自测 132/84）",
    factors: [
      { key: "age", label: "年龄（男>55）", category: "RF", present: false, note: "男 42 岁" },
      { key: "obesity", label: "肥胖（BMI≥28）", category: "RF", present: true, note: "BMI 29.4" },
      { key: "sedentary", label: "缺乏运动 / 作息不规律", category: "RF", present: true },
      { key: "smoking", label: "吸烟", category: "RF", present: false },
      { key: "diabetes", label: "糖尿病", category: "RF", present: false },
      { key: "microalb", label: "微量白蛋白尿", category: "TOD", present: false },
      { key: "stroke", label: "脑卒中病史", category: "CC", present: false },
    ],
  },
}

// ── 判定输出（完整判定轨迹，供 UI 可视化）──
export interface ClauseRef {
  no: string
  text: string
}

export interface Assessment {
  caseId: CaseId
  grade: GradeResult
  rfCount: number
  hasTOD: boolean
  hasCC: boolean
  hasDiabetes: boolean
  matrixRow: number
  matrixCol: number
  matrixRowLabel: string
  risk: "低危" | "中危" | "高危" | "很高危"
  factors: RiskFactorItem[]
  clauses: ClauseRef[]
}

const CLAUSES: Record<CaseId, ClauseRef[]> = {
  "P-001": [
    { no: "指南 3.4 表 2", text: "按最高测值定级：SBP≥180 和/或 DBP≥110 为 3 级（重度）" },
    { no: "指南 4.2 表 5", text: "3 级高血压伴糖尿病或 ≥3 个危险因素，列为很高危" },
    { no: "指南 5.3.1", text: "很高危患者应立即启动药物治疗，并联合干预多重危险因素" },
  ],
  "D-01": [
    { no: "指南 3.2.3", text: "隐匿性高血压按诊室外（动态/家庭）血压最高值定级" },
    { no: "指南 3.2.4", text: "夜间非杓型节律提示血压调节异常，与靶器官损害风险相关" },
    { no: "指南 4.2 表 5", text: "2 级高血压伴靶器官损害等危征，列为高危" },
  ],
  "D-02": [
    { no: "指南 3.3.1", text: "白大衣高血压应结合诊室外血压综合判断，避免过度治疗" },
    { no: "指南 4.2 表 5", text: "1 级高血压伴 1–2 个危险因素，列为中危" },
    { no: "指南 6.1.2", text: "中危患者先行生活方式干预，1–3 个月后复评是否用药" },
  ],
}

export function assessCase(caseId: CaseId): Assessment {
  const c = CASE_CLINICAL[caseId]
  const grade = gradeBP(c.peakSbp, c.peakDbp)
  const rfCount = c.factors.filter((f) => f.category === "RF" && f.present).length
  const hasTOD = c.factors.some((f) => f.category === "TOD" && f.present)
  const hasCC = c.factors.some((f) => f.category === "CC" && f.present)
  const hasDiabetes = c.factors.some((f) => f.key === "diabetes" && f.present)

  let matrixRow: number
  if (hasCC) matrixRow = 3
  else if (rfCount >= 3 || hasTOD || hasDiabetes) matrixRow = 2
  else if (rfCount >= 1) matrixRow = 1
  else matrixRow = 0

  // 矩阵列：1/2/3 级 → 0/1/2；正常/正常高值按 1 级列处理（本演示不涉及）
  const matrixCol = Math.max(0, Math.min(2, grade.level - 1))
  const risk = RISK_MATRIX[matrixRow][matrixCol] as Assessment["risk"]

  return {
    caseId,
    grade,
    rfCount,
    hasTOD,
    hasCC,
    hasDiabetes,
    matrixRow,
    matrixCol,
    matrixRowLabel: MATRIX_ROWS[matrixRow],
    risk,
    factors: c.factors,
    clauses: CLAUSES[caseId],
  }
}

// 供大模型解释环节使用的引擎结论摘要（结论不可更改）
export function engineSummary(a: Assessment): string {
  const c = CASE_CLINICAL[a.caseId]
  const presentRF = a.factors.filter((f) => f.category === "RF" && f.present).map((f) => f.label)
  return `血压分级：${a.grade.label}（${c.peakNote}，基线 ${c.baseSbp}/${c.baseDbp} mmHg，按最高测值定级）；
危险分层：${a.risk}（${a.matrixRowLabel} × ${MATRIX_COLS[a.matrixCol]}，命中分层矩阵）；
危险因素：${presentRF.join("、") || "无"}${a.hasTOD ? "；靶器官损害等危征：" + a.factors.filter((f) => f.category === "TOD" && f.present).map((f) => f.label).join("、") : ""}；
命中条款：${a.clauses.map((cl) => `${cl.no}（${cl.text}）`).join("；")}。`
}
