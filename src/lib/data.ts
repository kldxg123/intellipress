// 领域数据定义：病例 / 突发情景 / 七阶段闭环

export type CaseId = "P-001" | "D-01" | "D-02"

export interface CaseDef {
  id: CaseId
  kind: "真实病例·已脱敏" | "演示病例"
  sex: string
  age: number
  grade: string
  risk: string
  subtype: string
  comorbidity: string
  baseSbp: number
  baseDbp: number
  adherence: string
  nonDipper: boolean
  bmi?: number
  summary: string
}

export const CASES: CaseDef[] = [
  {
    id: "P-001",
    kind: "真实病例·已脱敏",
    sex: "男",
    age: 58,
    grade: "高血压3级",
    risk: "很高危",
    subtype: "晨峰型",
    comorbidity: "合并2型糖尿病",
    baseSbp: 178,
    baseDbp: 102,
    adherence: "服药依从性差",
    nonDipper: false,
    summary: "男 58岁 · 高血压3级（很高危）· 晨峰型 · 合并2型糖尿病 · 基线 178/102 mmHg · 服药依从性差",
  },
  {
    id: "D-01",
    kind: "演示病例",
    sex: "女",
    age: 65,
    grade: "高血压2级",
    risk: "高危",
    subtype: "隐匿性高血压 · 夜间非杓型",
    comorbidity: "无合并症",
    baseSbp: 156,
    baseDbp: 94,
    adherence: "依从性中等",
    nonDipper: true,
    summary: "女 65岁 · 高血压2级（高危）· 隐匿性高血压 · 夜间非杓型 · 基线 156/94 mmHg",
  },
  {
    id: "D-02",
    kind: "演示病例",
    sex: "男",
    age: 42,
    grade: "高血压1级",
    risk: "中危",
    subtype: "白大衣高血压",
    comorbidity: "肥胖 BMI 29.4",
    baseSbp: 148,
    baseDbp: 92,
    adherence: "依从性良好",
    nonDipper: false,
    bmi: 29.4,
    summary: "男 42岁 · 高血压1级（中危）· 白大衣高血压 · BMI 29.4 · 基线 148/92 mmHg",
  },
]

// 内部固定演示节奏：监护时钟推进速率（仿真分钟/秒）
// 取值 10 → 第 6 阶段 24h 压缩总时长约 2.5 分钟
export const SIM_MIN_PER_SEC = 10

export type IncidentId =
  | "none" | "surge" | "ortho" | "afib" | "missed" | "salt" | "cuff" | "offline" | "glitch"

export interface IncidentDef {
  id: IncidentId
  label: string
  category: "无" | "生理" | "行为" | "设备"
  // 分级响应演示序列：Ⅳ → Ⅲ → Ⅱ → Ⅰ（该事件会升级到的级别链）
  levels: (4 | 3 | 2 | 1)[]
  metric: string
  action: string
}

export const INCIDENTS: IncidentDef[] = [
  { id: "none", label: "不注入 · 全程平稳", category: "无", levels: [], metric: "", action: "" },
  { id: "surge", label: "晨峰血压飙升（≥180/110）", category: "生理", levels: [3, 2], metric: "血压 186/112 mmHg · 晨峰斜率 +4.2 mmHg/min", action: "加密测量至 5min/次 → 推送家属小程序 + 值班医生工单" },
  { id: "ortho", label: "体位性低血压晕厥", category: "生理", levels: [2, 1], metric: "血压 88/54 mmHg · 体位变化 ΔSBP -32 mmHg", action: "通知家属/医生 → 无应答升级 Ⅰ 级 · 直连 120 · 位置已发送" },
  { id: "afib", label: "房颤检出", category: "生理", levels: [3, 2], metric: "ECG RR 间期不规则 · P 波消失 · 置信度 94.2%", action: "加密 ECG 采样 → 推送值班医生复核工单" },
  { id: "missed", label: "漏服降压药", category: "行为", levels: [4], metric: "07:30 服药打卡缺失 · 已逾期 45 min", action: "语音/屏幕提示 · 维持监测" },
  { id: "salt", label: "高盐饮食事件", category: "行为", levels: [4], metric: "午餐打卡估算钠摄入 3.8g（限值 2.0g）", action: "营养助手推送低盐替代建议 · 维持监测" },
  { id: "cuff", label: "袖带佩戴松动", category: "设备", levels: [4], metric: "袖带压力曲线信噪比 < 12 dB", action: "提示重新佩戴 · 该次测量标记低可信" },
  { id: "offline", label: "设备离线", category: "设备", levels: [3], metric: "网关心跳丢失 > 90 s", action: "切换本地缓存 + 4G 备链 · 加强监测" },
  { id: "glitch", label: "数据异常跳变", category: "设备", levels: [4], metric: "SBP 单点跳变 +58 mmHg · 超生理极限", action: "标记为伪差剔除 · 触发复测" },
]

export const LEVEL_META: Record<number, { name: string; color: string; action: string }> = {
  4: { name: "Ⅳ 级 · 提示", color: "#0d9488", action: "语音/屏幕提示，维持监测" },
  3: { name: "Ⅲ 级 · 加强监测", color: "#d97706", action: "加密测量频次，孪生体滚动重校准" },
  2: { name: "Ⅱ 级 · 通知家属/医生", color: "#ea580c", action: "推送家属小程序 + 值班医生 SaaS 工单" },
  1: { name: "Ⅰ 级 · 紧急", color: "#dc2626", action: "直连 120 · 位置已发送" },
}

export const STEPS = [
  { n: 1, name: "初诊建档", sub: "病历智能解析 · 结构化建档" },
  { n: 2, name: "智能早筛", sub: "多模态融合 · 风险三层分层" },
  { n: 3, name: "孪生推演", sub: "数字孪生预见未来轨迹" },
  { n: 4, name: "个性方案", sub: "分层精准干预方案" },
  { n: 5, name: "居家执行", sub: "照护任务 · 24 小时全天守护" },
  { n: 6, name: "复盘迭代", sub: "当日复盘 · 医师在环迭代" },
] as const

export type ProvenanceKind = "measured" | "twin" | "rule" | "model"

export const PROV_META: Record<ProvenanceKind, { label: string; color: string; bg: string }> = {
  measured: { label: "实测", color: "#0d9488", bg: "rgba(13,148,136,0.10)" },
  twin: { label: "孪生", color: "#7c3aed", bg: "rgba(124,58,237,0.09)" },
  rule: { label: "规则", color: "#b45309", bg: "rgba(180,83,9,0.10)" },
  model: { label: "模型", color: "#047857", bg: "rgba(4,120,87,0.10)" },
}
