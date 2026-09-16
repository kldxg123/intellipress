// ─────────────────────────────────────────────────────────────────────────────
// 个性化方案规则引擎 planEngine v1.0
//
// 输入：病例结构化参数（来自 guidelines.ts 的 assessCase 分层结论 + CASE_CLINICAL
//       临床数据 + data.ts 病例定义）
// 输出：五维度个性化方案（用药 / 膳食 / 运动 / 作息与监测 / 复诊随访）
//
// 【性质】确定性规则引擎：所有内容由 if/else 规则按病例参数推导，不调用大模型，
// 不写死病例文案——三病例差异完全由参数差异（分级、分层、糖尿病、年龄、BMI、
// 节律类型、吸烟、基线血压）经规则分支产生。
//
// 【依据】规则逻辑参照《中国高血压防治指南》常规口径（演示用条款编号与
// guidelines.ts 的 CLAUSES 风格一致）；数值型参数（靶心率公式、钠摄入上限、
// 减重速率、运动时长）为指南/共识常用口径，逐条在 clause 字段标注。
// ─────────────────────────────────────────────────────────────────────────────

import { CASES, type CaseId } from "./data"
import { CASE_CLINICAL, assessCase } from "./guidelines"

export interface PlanItem {
  text: string
  clause?: string // 指南条款引用（规则来源角标）
}

export interface PlanSection {
  key: "medication" | "diet" | "exercise" | "sleep" | "followup"
  icon: string
  title: string
  items: PlanItem[]
  metric: string // 底部依据行
}

export interface CareTask {
  time: string
  task: string
  ch: string
  prov: "rule" | "model"
}

export interface CasePlan {
  caseId: CaseId
  sections: PlanSection[] // 固定 5 个维度
  targetBP: string // 达标线，如 "<130/80"
  measureFreqDesc: string // 测量频次描述
  reviewNode: string // 复诊节点描述
  targetHrLow: number // 靶心率下限
  targetHrHigh: number // 靶心率上限
  medTaskLabel: string | null // 服药任务文案（暂缓用药病例为 null）
  careTasks: CareTask[] // 供第 5 阶段照护时间轴使用
}

// 靶心率：(220 − 年龄) × 60–70%（常用中等强度运动处方公式）
export function targetHeartRate(age: number): [number, number] {
  return [Math.round((220 - age) * 0.6), Math.round((220 - age) * 0.7)]
}

/** 按病例参数确定性生成个性化方案 */
export function generatePlan(caseId: CaseId): CasePlan {
  const caseDef = CASES.find((c) => c.id === caseId)!
  const clin = CASE_CLINICAL[caseId]
  const a = assessCase(caseId)

  const veryHigh = a.risk === "很高危"
  const high = a.risk === "高危"
  const elderly = caseDef.age >= 65
  const obese = (caseDef.bmi ?? 0) >= 28
  const morningSurge = caseDef.subtype.includes("晨峰")
  const nonDipper = caseDef.nonDipper
  const whiteCoat = caseDef.subtype.includes("白大衣")
  const smoking = clin.factors.some((f) => f.key === "smoking" && f.present)
  const [hrLow, hrHigh] = targetHeartRate(caseDef.age)

  // 达标线：糖尿病 <130/80，一般 <140/90（指南目标值口径）
  const targetBP = a.hasDiabetes ? "<130/80" : "<140/90"

  // ── ① 用药 ──
  const medItems: PlanItem[] = []
  let medTaskLabel: string | null = null
  let medTime: string | null = null
  if (veryHigh || a.grade.level >= 3) {
    // 规则：3 级 / 很高危 → 立即联合用药
    medItems.push({
      text: "联合用药：CCB 氨氯地平 5mg qd + ARB 缬沙坦 80mg qd（糖尿病肾保护优先 ARB/ACEI 类）",
      clause: "指南 5.3.1 很高危立即用药 · 5.3.4 联合用药条款",
    })
    if (morningSurge) {
      medItems.push({ text: "晨峰型血压：醒后即服（约 06:00），覆盖 06:00–10:00 晨峰危险时段", clause: "指南 5.3.2 服药时机条款" })
      medTime = "06:10"
    }
    medItems.push({ text: "4 周复查肾功能与血钾（ARB/ACEI 类启用后常规监测）", clause: "指南 5.4.1 用药监测条款" })
    medItems.push({ text: "注意体位性低血压：起身动作放缓，站立头晕即时记录并上报", clause: "指南 5.4.3 不良反应观察" })
    if (caseDef.adherence.includes("差")) {
      medItems.push({ text: "依从性差：智能药盒 + 家属协同督服，漏服记录自动同步医生端", clause: "指南 7.2 依从性管理" })
    }
    medTaskLabel = "服药提醒（氨氯地平 5mg + 缬沙坦 80mg · 晨起即服）"
  } else if (high || a.grade.level >= 2) {
    // 规则：2 级 / 高危 → 单药起始；老年低剂量；非杓型晚间给药
    const dose = elderly ? "2.5mg（老年低剂量起始）" : "5mg"
    medItems.push({ text: `单药起始：长效 CCB 氨氯地平 ${dose} qd`, clause: "指南 5.3.1 高危启动用药 · 5.3.5 老年低剂量起始" })
    if (nonDipper) {
      medItems.push({ text: "夜间非杓型节律：长效制剂晚间给药（约 20:00），校正夜间血压节律", clause: "指南 5.3.2 节律校正给药时机" })
      medTime = "20:00"
    }
    if (elderly) {
      medItems.push({ text: "跌倒风险提示：起始 2 周内家属陪同监测，起身三段式（躺→坐→站各停 30 秒）", clause: "指南 5.4.2 老年用药安全" })
    }
    medItems.push({ text: "家庭夜间血压监测：睡前与夜间各 1 次，评估节律校正效果", clause: "指南 3.2.4 诊室外血压监测" })
    medTaskLabel = `服药提醒（氨氯地平 ${elderly ? "2.5mg" : "5mg"} · 晚间给药）`
  } else {
    // 规则：1 级 / 中低危 → 暂缓用药，先行生活方式干预
    medItems.push({ text: "暂缓用药：先 3 个月生活方式干预，复评未达标再启动单药（如 CCB 类）", clause: "指南 6.1.2 中危先生活方式干预" })
    if (whiteCoat) {
      medItems.push({ text: "白大衣高血压：先行 24h 动态血压确诊，避免诊室单次测值导致过度治疗", clause: "指南 3.3.1 白大衣高血压确诊流程" })
    }
    medItems.push({ text: "干预期每 2 周上传家庭自测记录，医生端跟踪趋势", clause: "指南 7.1 随访管理" })
  }

  // ── ② 膳食（营养助手）──
  const dietItems: PlanItem[] = [
    { text: "钠 <2000mg/日（盐 <5g/日）：图像识别打卡估算，高盐预警推送替代菜谱", clause: "指南 6.1.1 限盐条款" },
    { text: "DASH 食材清单：绿叶菜 300g/日、低脂奶 300ml、全谷物替代 1/3 精制主食、每周鱼类 2 次", clause: "指南 6.1.3 DASH 饮食" },
  ]
  let menu: string
  if (a.hasDiabetes) {
    dietItems.push({ text: "糖尿病膳食：碳水化合物供能比 45–50%，低 GI 主食（燕麦/糙米），进餐顺序先菜后饭", clause: "指南 6.1.4 合并糖尿病膳食" })
    dietItems.push({ text: "含钾食物（香蕉/菠菜/土豆）适量摄入——前提：肾功能正常，ARB 启用后 4 周复查确认", clause: "指南 6.1.3 钾摄入（肾功能正常前提）" })
    menu = "早餐 燕麦粥+水煮蛋+无糖豆浆 ｜ 午餐 糙米饭 100g+清蒸鲈鱼+蒜蓉西兰花 ｜ 晚餐 杂粮馒头半个+鸡胸肉 80g+凉拌黄瓜"
  } else if (obese) {
    dietItems.push({ text: "减重目标：3 个月减重 5%，每日热量缺口约 500kcal（晚餐主食减半，戒含糖饮料）", clause: "指南 6.1.5 超重/肥胖减重条款" })
    dietItems.push({ text: "含钾食物（香蕉/橙子/菌菇）适量摄入——肾功能正常前提下", clause: "指南 6.1.3 钾摄入（肾功能正常前提）" })
    menu = "早餐 全麦面包 2 片+水煮蛋+无糖酸奶 ｜ 午餐 藜麦鸡胸沙拉（鸡胸 120g） ｜ 晚餐 玉米半根+白灼虾 8 只+白灼生菜"
  } else {
    dietItems.push({ text: "含钾食物（香蕉/菠菜/紫菜）适量摄入——肾功能正常前提下；老年注意食物软烂易消化", clause: "指南 6.1.3 钾摄入（肾功能正常前提）" })
    dietItems.push({ text: "老年膳食：蛋白质 1.0g/kg/日防肌少，晚餐七分饱，睡前 2h 不进食", clause: "指南 6.1.6 老年膳食注意" })
    menu = "早餐 小米粥+蒸南瓜+低脂奶 250ml ｜ 午餐 软米饭+番茄豆腐+蒜蓉菠菜 ｜ 晚餐 鱼片粥+焯拌秋葵"
  }
  dietItems.push({ text: `一日示例食谱：${menu}`, clause: "营养助手按病例生成" })

  // ── ③ 运动 ──
  const exItems: PlanItem[] = []
  if (veryHigh) {
    exItems.push({ text: "⚠ 很高危分层：运动处方前需医师评估（心电图/运动耐量），评估通过前仅日常活动量", clause: "指南 6.2.1 高危运动前评估" })
    exItems.push({ text: `评估通过后：快走/八段锦，靶心率 ${hrLow}–${hrHigh} bpm，每周 5 次 × 30min`, clause: "指南 6.2 节运动建议" })
    if (morningSurge) exItems.push({ text: "避开 06:00–10:00 晨峰时段剧烈运动，安排 15:00 午后时段", clause: "指南 6.2.3 运动时机" })
  } else if (elderly) {
    exItems.push({ text: `低冲击运动：太极 / 平地快走，靶心率 ${hrLow}–${hrHigh} bpm，每周 5 次 × 30min`, clause: "指南 6.2 节运动建议" })
    exItems.push({ text: "防跌倒：避免夜间单独外出运动，选择平整场地，家属可陪同", clause: "指南 6.2.2 老年运动安全" })
    exItems.push({ text: "运动前后各测 1 次血压，峰值 ≥180/110 当日停止运动并记录", clause: "指南 6.2.4 运动中血压监测" })
  } else {
    exItems.push({ text: `有氧 + 抗阻组合：快走/骑行靶心率 ${hrLow}–${hrHigh} bpm，每周 ≥150min；抗阻训练每周 2 次（弹力带/自重）`, clause: "指南 6.2 节运动建议" })
    if (obese) exItems.push({ text: "运动配合减重目标：每日步数 ≥8000，久坐每 1h 起身活动 3min", clause: "指南 6.1.5 减重条款" })
    exItems.push({ text: "循序渐进：第 1–2 周每次 20min 起步，第 3 周起加至 40min", clause: "指南 6.2.5 运动进阶原则" })
  }

  // ── ④ 作息与监测 ──
  let measureFreqDesc: string
  const sleepItems: PlanItem[] = []
  if (veryHigh) {
    measureFreqDesc = "每日早晚 2 次（06:00 晨起 + 18:00 晚间）"
    sleepItems.push({ text: `血压测量：${measureFreqDesc}，数据自动同步医生端`, clause: "指南 3.2.5 家庭自测频次（很高危）" })
  } else if (high) {
    measureFreqDesc = nonDipper ? "每日晨起 1 次 + 夜间 22:30 重点监测（非杓型）" : "每日 1 次 + 按需加测"
    sleepItems.push({ text: `血压测量：${measureFreqDesc}`, clause: "指南 3.2.5 家庭自测频次（高危）" })
  } else {
    measureFreqDesc = "每周 3 天，测量日早晚各 1 次"
    sleepItems.push({ text: `血压测量：${measureFreqDesc}`, clause: "指南 3.2.5 家庭自测频次（中危）" })
  }
  sleepItems.push({ text: "睡眠：23:00 前入睡，时长 ≥7h；晨起三段式缓慢起身", clause: "指南 6.3 节生活方式" })
  if (nonDipper) sleepItems.push({ text: "夜间非杓型重点观察：若夜间血压均值 ≥120/70 连续 3 晚，医生端自动提示复评", clause: "指南 3.2.4 夜间节律" })
  if (smoking) {
    sleepItems.push({ text: "戒烟计划：1 周内设定戒烟日 → 2 周尼古丁替代评估 → 1 个月戒烟门诊随访", clause: "指南 6.4.1 戒烟条款" })
    sleepItems.push({ text: "限酒：酒精 <25g/日（约啤酒 750ml 或白酒 50ml），最好戒断", clause: "指南 6.4.2 限酒条款" })
  } else {
    sleepItems.push({ text: "限酒：酒精 <25g/日；无吸烟史，保持", clause: "指南 6.4.2 限酒条款" })
  }

  // ── ⑤ 复诊与随访 ──
  let reviewNode: string
  const fuItems: PlanItem[] = []
  if (veryHigh) {
    reviewNode = "2 周"
    fuItems.push({ text: "复诊节点：2 周后门诊复诊，复查肾功能 + 血钾 + 血压达标情况", clause: "指南 7.1.1 很高危随访间隔" })
  } else if (high) {
    reviewNode = "4 周"
    fuItems.push({ text: "复诊节点：4 周后复诊，评估夜间节律校正效果与用药耐受", clause: "指南 7.1.2 高危随访间隔" })
  } else {
    reviewNode = "3 个月"
    fuItems.push({ text: "复诊节点：3 个月复评 + 24h 动态血压；未达标（≥140/90）则启动单药", clause: "指南 6.1.2 生活方式干预期复评" })
  }
  fuItems.push({ text: `达标判定线：${targetBP} mmHg（${a.hasDiabetes ? "糖尿病目标值" : "一般人群目标值"}）`, clause: "指南 5.2 节降压目标值" })
  fuItems.push({ text: "随访渠道：小程序打卡数据 + 电话随访 + 家庭医生签约门诊三通道", clause: "指南 7.1 随访管理" })

  const sections: PlanSection[] = [
    { key: "medication", icon: "💊", title: "用药方案", items: medItems, metric: `分层：${a.risk} · ${a.grade.label}` },
    { key: "diet", icon: "🧂", title: "膳食 · 营养助手", items: dietItems, metric: obese ? `BMI ${caseDef.bmi} ≥28 → 减重路径` : a.hasDiabetes ? "合并糖尿病 → 控碳水路径" : "DASH 标准路径" },
    { key: "exercise", icon: "🏃", title: "运动处方", items: exItems, metric: `靶心率 (220−${caseDef.age})×60–70% = ${hrLow}–${hrHigh} bpm` },
    { key: "sleep", icon: "🌙", title: "作息与监测", items: sleepItems, metric: `测量频次按${a.risk}分层` },
    { key: "followup", icon: "📋", title: "复诊与随访", items: fuItems, metric: `复诊间隔按${a.risk}分层 · 达标线 ${targetBP}` },
  ]

  // ── 照护任务时间轴（供第 5 阶段；与方案内容对齐）──
  const careTasks: CareTask[] = []
  if (veryHigh) {
    careTasks.push({ time: "06:00", task: "晨起血压测量（每日）", ch: "手表 + 袖带", prov: "rule" })
  } else if (high) {
    careTasks.push({ time: "07:00", task: "晨起血压测量（每日）", ch: "手表 + 袖带", prov: "rule" })
  } else {
    careTasks.push({ time: "07:00", task: "血压测量（每周 3 天 · 早晚各 1 次）", ch: "手表 + 袖带", prov: "rule" })
  }
  if (medTaskLabel && medTime) {
    careTasks.push({ time: medTime, task: medTaskLabel, ch: "小程序推送 + 语音", prov: "rule" })
  }
  careTasks.push({
    time: "12:00",
    task: a.hasDiabetes ? "午餐限盐打卡 · 控碳水食谱核对" : obese ? "午餐限盐打卡 · 热量记录（缺口 500kcal）" : "午餐限盐打卡 · 钠估算",
    ch: "小程序图像识别",
    prov: "model",
  })
  careTasks.push({
    time: "15:00",
    task: elderly ? `太极/快走 30min 提醒（靶心率 ${hrLow}–${hrHigh}）` : `午后运动提醒（靶心率 ${hrLow}–${hrHigh}）`,
    ch: "手表振动",
    prov: "model",
  })
  if (veryHigh) {
    careTasks.push({ time: "18:00", task: "晚间血压测量（每日）", ch: "手表 + 袖带", prov: "rule" })
  }
  if (obese && !a.hasDiabetes) {
    careTasks.push({ time: "18:30", task: "晚餐减重食谱打卡 · 主食减半", ch: "小程序图像识别", prov: "model" })
  }
  if (nonDipper) {
    careTasks.push({ time: "22:30", task: "夜间血压重点监测（非杓型）", ch: "手表 + 袖带", prov: "rule" })
  }
  careTasks.push({ time: "22:00", task: "睡眠监测 · 23:00 前入睡提醒", ch: "PPG 连续", prov: "model" })
  careTasks.sort((x, y) => x.time.localeCompare(y.time))

  return {
    caseId,
    sections,
    targetBP,
    measureFreqDesc,
    reviewNode,
    targetHrLow: hrLow,
    targetHrHigh: hrHigh,
    medTaskLabel,
    careTasks,
  }
}
