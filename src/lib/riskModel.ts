// ─────────────────────────────────────────────────────────────────────────────
// 风险模型引擎 · China-PAR 简化校准模型 v0.9
//
// 【性质声明】本模块是"基于 China-PAR 思路的简化校准模型"，并非 China-PAR 原方程。
// 原方程（Yang X, et al. Circulation. 2016; China-PAR 项目）的完整系数表仅发表于
// 原文及其补充材料，公开渠道无法完整可靠获得，故本实现采用：
//   1) 方程形式：与 China-PAR 完全相同的 Cox 比例风险形式
//        10 年 ASCVD 风险 = 1 − S10 ^ exp(IndX'B − MeanX'B)
//   2) 基线生存率 S10：采用公开报道值 —— 男性 0.97 / 女性 0.99
//      （来源：Li Y, et al. Biomed Environ Sci. 2019;32(2):87-99 对原文的转述）
//   3) 变量结构：与 China-PAR 一致 —— 连续变量（年龄、SBP、TC、HDL-C、WC）取自然
//      对数；分类变量（吸烟、糖尿病、降压治疗、南北方、城乡、ASCVD 家族史）取 0/1；
//      含 年龄×SBP、年龄×吸烟 交互项（China-PAR 女性方程即此两项）。
//   4) 回归系数 β：公开渠道无完整可靠数值，下列系数为【校准系数】——参照同类队列
//      研究（PCE / China-PAR 二次验证文献）中各因素 HR 量级设定，并以中国成人参考
//      人群画像校准，使参考画像的 10 年风险落在公开报道的人群均值量级
//      （男 ~3.8% / 女 ~1.3%，Li 2019 东部中国 7.2 万人实测）。
//   5) MeanX'B：通过变量中心化（参考画像处 IndX'B = 0）折叠为 0，
//      即参考画像个体的 10 年风险恰为 1 − S10（男 3.0% / 女 1.0%）。
//
// 【风险分层口径】（China-PAR 公开标准，10 年 ASCVD 风险）
//   <5% 低危 / 5–10% 中危 / ≥10% 高危
//
// 【局限性】演示用简化模型，非临床诊断工具；不替代正式风险评估与医师判断。
// ─────────────────────────────────────────────────────────────────────────────

import type { CaseId } from "./data"

// ── 输入 ──
export interface CaseRiskInput {
  sex: "male" | "female"
  age: number // 岁
  sbp: number // mmHg，基线收缩压
  tc: number // 总胆固醇 mmol/L
  hdl: number // HDL-C mmol/L
  wc: number // 腰围 cm
  smoking: 0 | 1
  diabetes: 0 | 1
  treated: 0 | 1 // 正在接受降压治疗
  north: 0 | 1 // 北方 = 1（秦岭淮河以北）
  urban: 0 | 1 // 城市 = 1
  famhist: 0 | 1 // ASCVD 家族史
  // —— 以下为推演假设参数（非 China-PAR 变量）——
  yearlySbpRise: number // 未干预 SBP 年均爬升 mmHg/年（假设值）
  egfrBase: number // 基线 eGFR ml/min/1.73m²（假设值）
  egfrDeclineUntreated: number // 未干预 eGFR 年均下降（假设值，高血压肾损害 1–2/年）
  egfrDeclineTreated: number // 干预后 eGFR 年均下降（假设值）
}

// 标记每个输入的来源（病历实测 / 假设值）
export interface InputProvenance {
  key: string
  label: string
  value: string
  assumed: boolean
  source: string
}

// ── 系数表（校准系数，非原方程系数；逐条注明依据）──
interface CoefSet {
  lnAge: number // 年龄（ln）——PCE/China-PAR 中年龄均为最强预测因子
  lnSbp: number // SBP（ln）——China-PAR 中 SBP 为 ASCVD 核心预测因子
  lnTc: number // 总胆固醇（ln）——同类队列 HR 量级 1.2–1.4 / SD
  lnHdl: number // HDL-C（ln）——保护因素，负系数
  lnWc: number // 腰围（ln）——China-PAR 以 WC 表征中心性肥胖
  smoking: number // 吸烟——同类队列 HR≈1.6–2.0
  diabetes: number // 糖尿病——同类队列 HR≈1.5–2.0
  treated: number // 降压治疗中——China-PAR 中为正系数（治疗者基线风险更高）
  north: number // 北方——中国北方 CVD 发病率高于南方（China-PAR 纳入项）
  urban: number // 城市——China-PAR 纳入项
  famhist: number // ASCVD 家族史——同类队列 HR≈1.3
  ageXSbp: number // 年龄×SBP 交互（负：SBP 效应随年龄衰减，China-PAR 结构）
  ageXSmoking: number // 年龄×吸烟交互（负：吸烟效应随年龄衰减）
}

// 参考画像中心点（连续变量取 ln 后以此为中心；参考画像 IndX'B = 0）
const REF = {
  age: 55, // 中国成人慢病监测人群平均年龄量级
  sbp: 125, // 中国成人平均 SBP 量级
  tc: 5.0, // mmol/L 中国成人平均 TC
  hdl: 1.3, // mmol/L 中国成人平均 HDL-C
  wcMale: 85, // cm 中国男性平均腰围量级
  wcFemale: 80, // cm 中国女性平均腰围量级
}

const S10_MALE = 0.97 // China-PAR 公开报道值（Li 2019 转述原文）
const S10_FEMALE = 0.99

const COEF_MALE: CoefSet = {
  lnAge: 0.9,
  lnSbp: 1.2,
  lnTc: 0.25,
  lnHdl: -0.35,
  lnWc: 0.35,
  smoking: 0.5,
  diabetes: 0.6,
  treated: 0.3,
  north: 0.15,
  urban: 0.05,
  famhist: 0.25,
  ageXSbp: -0.2,
  ageXSmoking: -0.1,
}

const COEF_FEMALE: CoefSet = {
  // 女性方程：SBP 与年龄权重相对更高（China-PAR 女性系数结构特征），
  // 交互项仅保留 年龄×SBP、年龄×吸烟（与 China-PAR 女性方程一致）
  lnAge: 1.8,
  lnSbp: 1.8,
  lnTc: 0.3,
  lnHdl: -0.5,
  lnWc: 0.4,
  smoking: 0.7,
  diabetes: 0.8,
  treated: 0.55,
  north: 0.2,
  urban: 0.05,
  famhist: 0.3,
  ageXSbp: -0.25,
  ageXSmoking: -0.1,
}

// ── 核心方程 ──
// 线性预测子 IndX'B（MeanX'B 已经由中心化折叠为 0）
function linearPredictor(inp: CaseRiskInput, ageOverride?: number, sbpOverride?: number): number {
  const c = inp.sex === "male" ? COEF_MALE : COEF_FEMALE
  const age = ageOverride ?? inp.age
  const sbp = sbpOverride ?? inp.sbp
  const lnAge = Math.log(age / REF.age)
  const lnSbp = Math.log(sbp / REF.sbp)
  const lnTc = Math.log(inp.tc / REF.tc)
  const lnHdl = Math.log(inp.hdl / REF.hdl)
  const lnWc = Math.log(inp.wc / (inp.sex === "male" ? REF.wcMale : REF.wcFemale))
  return (
    c.lnAge * lnAge +
    c.lnSbp * lnSbp +
    c.lnTc * lnTc +
    c.lnHdl * lnHdl +
    c.lnWc * lnWc +
    c.smoking * inp.smoking +
    c.diabetes * inp.diabetes +
    c.treated * inp.treated +
    c.north * inp.north +
    c.urban * inp.urban +
    c.famhist * inp.famhist +
    c.ageXSbp * lnAge * lnSbp +
    c.ageXSmoking * lnAge * inp.smoking
  )
}

/** China-PAR 简化校准模型：10 年 ASCVD 风险（0–1） */
export function chinaParSimplified10Y(inp: CaseRiskInput, ageOverride?: number, sbpOverride?: number): number {
  const s10 = inp.sex === "male" ? S10_MALE : S10_FEMALE
  const x = Math.exp(linearPredictor(inp, ageOverride, sbpOverride))
  return 1 - Math.pow(s10, x)
}

/** 10 年 → 5 年换算：恒定风险率假设 risk5 = 1 − (1 − risk10)^(5/10) */
export function toFiveYear(risk10: number): number {
  return 1 - Math.pow(1 - risk10, 0.5)
}

/** 任意 t 年累计风险（恒定风险率假设外推） */
export function toTYear(risk10: number, t: number): number {
  return 1 - Math.pow(1 - risk10, t / 10)
}

/** 风险分层（China-PAR 公开口径，基于 10 年 ASCVD 风险） */
export function riskTier(risk10: number): "低危" | "中危" | "高危" {
  if (risk10 < 0.05) return "低危"
  if (risk10 < 0.1) return "中危"
  return "高危"
}

// ── 干预获益（临床试验证据口径）──
// 主要心血管事件相对风险：SBP 每降 10 mmHg → RR 0.80（卒中 RR 0.73）
// 依据：Ettehad D, et al. Lancet. 2016;387:957-967（降压试验荟萃分析，
//       每 10 mmHg SBP 下降，主要心血管事件 RR 0.80，卒中 RR 0.73）。
// 按 log-linear 外推：RR = 0.8^(ΔSBP/10)；为避免超出试验证据范围，
// 有效降压幅度封顶 35 mmHg（模型假设，逐条注明）。
export const RRR_PER_10MMHG_MAJOR_CV = 0.2
export const RRR_PER_10MMHG_STROKE = 0.27
export const EFFECTIVE_DELTA_CAP = 35

export function treatmentRR(deltaSbp: number): { rr: number; effectiveDelta: number } {
  const effectiveDelta = Math.min(Math.max(deltaSbp, 0), EFFECTIVE_DELTA_CAP)
  return { rr: Math.pow(1 - RRR_PER_10MMHG_MAJOR_CV, effectiveDelta / 10), effectiveDelta }
}

/** 达标目标值（规则）：糖尿病 <130/80（取 130），一般人群 <140/90（取 138，留达标余量） */
export function targetSbp(inp: CaseRiskInput): number {
  return inp.diabetes === 1 ? 130 : 138
}

// ── 三病例输入（假设值逐条标注）──
export const RISK_INPUTS: Record<CaseId, CaseRiskInput> = {
  "P-001": {
    sex: "male",
    age: 58,
    sbp: 178,
    tc: 5.2, // 假设值：病历无血脂数据，取轻度升高
    hdl: 1.2, // 假设值
    wc: 98, // 假设值：由 BMI 28.6 推算
    smoking: 1,
    diabetes: 1,
    treated: 1, // 服药中（依从性差）
    north: 1, // 假设值：默认北方
    urban: 1, // 假设值：默认城市
    famhist: 0,
    yearlySbpRise: 3.2, // 假设值：3 级高血压未控制进展速率
    egfrBase: 78, // 假设值：合并微量白蛋白尿，轻度下降
    egfrDeclineUntreated: 2.0, // 假设值：高血压+糖尿病肾损害区间上限
    egfrDeclineTreated: 0.8, // 假设值
  },
  "D-01": {
    sex: "female",
    age: 65,
    sbp: 156,
    tc: 5.6, // 假设值：绝经期女性轻度升高
    hdl: 1.4, // 假设值
    wc: 90, // 假设值：由体型描述推算
    smoking: 0,
    diabetes: 0,
    treated: 1, // 服药中（依从性中等）
    north: 1, // 假设值：默认北方
    urban: 1, // 假设值：默认城市
    famhist: 0,
    yearlySbpRise: 3.4, // 假设值：隐匿性高血压未控制进展速率
    egfrBase: 74, // 假设值：65 岁女性年龄相关下降
    egfrDeclineUntreated: 1.5, // 假设值
    egfrDeclineTreated: 0.8, // 假设值
  },
  "D-02": {
    sex: "male",
    age: 42,
    sbp: 148,
    tc: 5.4, // 假设值：肥胖人群轻度升高
    hdl: 1.1, // 假设值：肥胖人群偏低
    wc: 102, // 病历记录
    smoking: 0,
    diabetes: 0,
    treated: 0, // 白大衣高血压，尚未用药
    north: 1, // 假设值：默认北方
    urban: 1, // 假设值：默认城市
    famhist: 0,
    yearlySbpRise: 3.6, // 假设值：肥胖+作息不规律进展速率
    egfrBase: 95, // 假设值：年轻男性正常肾功能
    egfrDeclineUntreated: 1.0, // 假设值
    egfrDeclineTreated: 0.5, // 假设值
  },
}

export const INPUT_PROVENANCE: Record<CaseId, InputProvenance[]> = {
  "P-001": [
    { key: "sex", label: "性别/年龄", value: "男 · 58 岁", assumed: false, source: "病历" },
    { key: "sbp", label: "基线 SBP", value: "178 mmHg（峰值 186）", assumed: false, source: "病历 · 晨峰监测" },
    { key: "smoking", label: "吸烟", value: "是（20 年烟龄）", assumed: false, source: "病历" },
    { key: "diabetes", label: "糖尿病", value: "是（2 型 · 5 年）", assumed: false, source: "病历" },
    { key: "treated", label: "降压治疗", value: "是（依从性差）", assumed: false, source: "病历" },
    { key: "wc", label: "腰围", value: "≈98 cm", assumed: true, source: "假设值 · 由 BMI 28.6 推算" },
    { key: "tc", label: "总胆固醇", value: "≈5.2 mmol/L", assumed: true, source: "假设值 · 病历无血脂数据" },
    { key: "hdl", label: "HDL-C", value: "≈1.2 mmol/L", assumed: true, source: "假设值 · 病历无血脂数据" },
    { key: "region", label: "地域/城乡", value: "北方 · 城市", assumed: true, source: "假设值 · 默认" },
    { key: "egfr", label: "基线 eGFR", value: "≈78 ml/min/1.73m²", assumed: true, source: "假设值 · 微量白蛋白尿 86 mg/L" },
  ],
  "D-01": [
    { key: "sex", label: "性别/年龄", value: "女 · 65 岁", assumed: false, source: "病历" },
    { key: "sbp", label: "基线 SBP", value: "156 mmHg（峰值 168）", assumed: false, source: "病历 · 动态血压" },
    { key: "smoking", label: "吸烟", value: "否", assumed: false, source: "病历" },
    { key: "diabetes", label: "糖尿病", value: "否", assumed: false, source: "病历" },
    { key: "treated", label: "降压治疗", value: "是（依从性中等）", assumed: false, source: "病历" },
    { key: "wc", label: "腰围", value: "≈90 cm", assumed: true, source: "假设值 · 由体型描述推算" },
    { key: "tc", label: "总胆固醇", value: "≈5.6 mmol/L", assumed: true, source: "假设值 · 病历无血脂数据" },
    { key: "hdl", label: "HDL-C", value: "≈1.4 mmol/L", assumed: true, source: "假设值 · 病历无血脂数据" },
    { key: "region", label: "地域/城乡", value: "北方 · 城市", assumed: true, source: "假设值 · 默认" },
    { key: "egfr", label: "基线 eGFR", value: "≈74 ml/min/1.73m²", assumed: true, source: "假设值 · 年龄相关" },
  ],
  "D-02": [
    { key: "sex", label: "性别/年龄", value: "男 · 42 岁", assumed: false, source: "病历" },
    { key: "sbp", label: "基线 SBP", value: "148 mmHg（诊室峰值 151）", assumed: false, source: "病历 · 诊室复测" },
    { key: "smoking", label: "吸烟", value: "否", assumed: false, source: "病历" },
    { key: "diabetes", label: "糖尿病", value: "否", assumed: false, source: "病历" },
    { key: "treated", label: "降压治疗", value: "否（白大衣高血压）", assumed: false, source: "病历" },
    { key: "wc", label: "腰围", value: "102 cm", assumed: false, source: "病历" },
    { key: "tc", label: "总胆固醇", value: "≈5.4 mmol/L", assumed: true, source: "假设值 · 病历无血脂数据" },
    { key: "hdl", label: "HDL-C", value: "≈1.1 mmol/L", assumed: true, source: "假设值 · 肥胖人群偏低" },
    { key: "region", label: "地域/城乡", value: "北方 · 城市", assumed: true, source: "假设值 · 默认" },
    { key: "egfr", label: "基线 eGFR", value: "≈95 ml/min/1.73m²", assumed: true, source: "假设值 · 年轻男性" },
  ],
}

// ── 轨迹与事件 ──
export interface YearPoint {
  year: number
  sbpUntreated: number
  sbpTreated: number
  riskUntreated: number // 累计心脑血管事件风险（0–1）
  riskTreated: number
  egfrUntreated: number
  egfrTreated: number
}

export interface RiskEvent {
  year: number
  label: string
  prob: string
  treated: boolean
}

export interface MonteCarloResult {
  n: number
  untreatedMean: number
  untreatedCi: [number, number]
  treatedMean: number
  treatedCi: [number, number]
  progression2yr?: number // D-02 专用：2 年内进展为 2 级高血压（SBP≥160）概率
}

export interface CaseRiskAssessment {
  caseId: CaseId
  modelMeta: {
    name: string
    version: string
    equation: string
    isSimplified: boolean
    refs: string[]
    limitations: string[]
  }
  inputs: InputProvenance[]
  baselineRisk10: number
  baselineRisk5: number
  tier: "低危" | "中危" | "高危"
  targetSbp: number
  yearlySbpRise: number // 未干预 SBP 年均爬升（假设值，图表轨迹与风险计算共用）
  yearly: YearPoint[] // year 0..5
  rrr: { per10mmHg: number; deltaSbp: number; effectiveDelta: number; rr: number; source: string }
  ttrGain: { value: string; basis: string }
  events: RiskEvent[]
  eventDropPct: number // 相对下降 %
  monteCarlo: MonteCarloResult
}

// 确定性伪随机（蒙特卡洛可复现）
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randn(rng: () => number): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-9)
  const u2 = rng()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

// Wilson 95% 置信区间
function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0]
  const z = 1.96
  const p = k / n
  const denom = 1 + (z * z) / n
  const center = (p + (z * z) / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return [Math.max(0, center - half), Math.min(1, center + half)]
}

function fmtPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`
}

/** 完整病例风险评估（运行时透明计算） */
export function assessCaseRisk(caseId: CaseId): CaseRiskAssessment {
  const inp = RISK_INPUTS[caseId]
  const target = targetSbp(inp)

  const risk10Base = chinaParSimplified10Y(inp)
  const risk5Base = toFiveYear(risk10Base)

  // 5 年逐年轨迹
  const yearly: YearPoint[] = []
  for (let y = 0; y <= 5; y++) {
    const sbpU = inp.sbp + inp.yearlySbpRise * y
    // 规范干预：首年回落至目标（(1-(1-k)²) 快速下降），随后轻微回稳
    const k = Math.min(1, y / 1)
    const sbpT = inp.sbp + (target - inp.sbp) * (1 - Math.pow(1 - k, 2)) - y * 0.4 * k
    // 未干预：按当年年龄与 SBP 重新计算模型风险 → 累计 t 年风险
    const r10U = chinaParSimplified10Y(inp, inp.age + y, sbpU)
    const cumU = toTYear(r10U, y)
    // 干预：未干预风险 × 临床试验 RR（按当年已实现降压幅度）
    const { rr } = treatmentRR(sbpU - sbpT)
    const cumT = cumU * rr
    yearly.push({
      year: y,
      sbpUntreated: sbpU,
      sbpTreated: sbpT,
      riskUntreated: cumU,
      riskTreated: cumT,
      egfrUntreated: inp.egfrBase - inp.egfrDeclineUntreated * y,
      egfrTreated: inp.egfrBase - inp.egfrDeclineTreated * y,
    })
  }

  const { rr: rrFull, effectiveDelta } = treatmentRR(inp.sbp - target)

  // 蒙特卡洛 2,000 次（真实抽样，确定性种子）
  const N_MC = 2000
  const rng = mulberry32(caseId === "P-001" ? 20240001 : caseId === "D-01" ? 20240002 : 20240003)
  let evU = 0
  let evT = 0
  let prog2 = 0
  for (let i = 0; i < N_MC; i++) {
    // 逐年 SBP 轨迹抽样：未干预爬升速率 N(yearlyRise, 1.2)，干预达标值 N(target, 3)
    const rise = inp.yearlySbpRise + randn(rng) * 1.2
    const achieved = target + randn(rng) * 3
    const sbpU5 = inp.sbp + Math.max(rise, 0) * 5
    const r10 = chinaParSimplified10Y(inp, inp.age + 5, sbpU5)
    const pU = toTYear(r10, 5)
    const { rr } = treatmentRR(sbpU5 - achieved)
    const pT = pU * rr
    if (rng() < pU) evU++
    if (rng() < pT) evT++
    // D-02：2 年内 SBP 触及 160（2 级高血压）的概率
    if (caseId === "D-02") {
      const sbp2 = inp.sbp + Math.max(rise, 0) * 2 + randn(rng) * 4
      if (sbp2 >= 160) prog2++
    }
  }
  const mc: MonteCarloResult = {
    n: N_MC,
    untreatedMean: evU / N_MC,
    untreatedCi: wilson(evU, N_MC),
    treatedMean: evT / N_MC,
    treatedCi: wilson(evT, N_MC),
    ...(caseId === "D-02" ? { progression2yr: prog2 / N_MC } : {}),
  }

  // 事件标注（位置沿用演示节奏，数值全部来自计算）
  const at = (y: number) => yearly[Math.round(y)] ?? yearly[5]
  const egfrAt = (y: number) => (inp.egfrDeclineUntreated * y).toFixed(1)
  const events: RiskEvent[] =
    caseId === "P-001"
      ? [
          { year: 2, label: "心脑血管事件风险", prob: fmtPct(at(2).riskUntreated), treated: false },
          { year: 3.2, label: "eGFR 累计下降", prob: `-${egfrAt(3.2)} ml/min/1.73m²`, treated: false },
          { year: 4.6, label: "心脑血管事件风险", prob: fmtPct(at(5).riskUntreated), treated: false },
          { year: 4.6, label: "干预后风险", prob: fmtPct(at(5).riskTreated), treated: true },
        ]
      : caseId === "D-01"
        ? [
            { year: 2, label: "心脑血管事件风险", prob: fmtPct(at(2).riskUntreated), treated: false },
            { year: 3.2, label: "eGFR 累计下降", prob: `-${egfrAt(3.2)} ml/min/1.73m²`, treated: false },
            { year: 4.6, label: "心脑血管事件风险", prob: fmtPct(at(5).riskUntreated), treated: false },
            { year: 4.6, label: "干预后风险", prob: fmtPct(at(5).riskTreated), treated: true },
          ]
        : [
            { year: 2, label: "进展为 2 级高血压", prob: fmtPct(mc.progression2yr ?? 0), treated: false },
            { year: 3.2, label: "eGFR 累计下降", prob: `-${egfrAt(3.2)} ml/min/1.73m²`, treated: false },
            { year: 4.6, label: "心脑血管事件风险", prob: fmtPct(at(5).riskUntreated), treated: false },
            { year: 4.6, label: "干预后风险", prob: fmtPct(at(5).riskTreated), treated: true },
          ]

  const risk5U = yearly[5].riskUntreated
  const risk5T = yearly[5].riskTreated

  return {
    caseId,
    modelMeta: {
      name: "China-PAR 简化校准模型",
      version: "v0.9",
      equation: "10年风险 = 1 − S10^exp(IndX'B)，S10 男 0.97 / 女 0.99；5年 = 1 − (1−risk10)^0.5",
      isSimplified: true,
      refs: [
        "方程形式与变量结构：Yang X, et al. Circulation. 2016（China-PAR 原方程）",
        "S10 基线生存率：Li Y, et al. Biomed Environ Sci. 2019;32(2):87-99（转述原文）",
        "人群均值参照：男性 10 年 ASCVD ≈3.8% / 女性 ≈1.3%（Li 2019，东部中国 7.2 万人）",
        "干预获益：Ettehad D, et al. Lancet. 2016;387:957-967（每降 10 mmHg，主要心血管事件 RR 0.80）",
        "回归系数：校准系数（参照同类队列 HR 量级设定，非原方程系数）",
      ],
      limitations: [
        "演示用简化模型，非 China-PAR 原方程，非临床诊断工具",
        "回归系数为校准系数，个体绝对风险可能与原方程存在偏差",
        "血脂、腰围、地域等部分输入为假设值（已在输入参数表逐条标注）",
        "10 年→5 年换算采用恒定风险率假设；降压获益按 log-linear 外推并封顶 35 mmHg",
      ],
    },
    inputs: INPUT_PROVENANCE[caseId],
    baselineRisk10: risk10Base,
    baselineRisk5: risk5Base,
    tier: riskTier(risk10Base),
    targetSbp: target,
    yearlySbpRise: inp.yearlySbpRise,
    yearly,
    rrr: {
      per10mmHg: RRR_PER_10MMHG_MAJOR_CV,
      deltaSbp: inp.sbp - target,
      effectiveDelta,
      rr: rrFull,
      source: "Ettehad 2016 Lancet 荟萃：每降 10 mmHg SBP，主要心血管事件相对风险 −20%",
    },
    ttrGain: { value: "≥30%", basis: "产品目标 / 模型假设（非临床实测）" },
    events,
    eventDropPct: Math.round((1 - risk5T / risk5U) * 100),
    monteCarlo: mc,
  }
}
