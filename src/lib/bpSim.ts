// 24h 血压曲线仿真：确定性（同一分钟同一数值），支持异常注入叠加
import type { CaseDef, IncidentId } from "./data"

// 确定性伪随机（按分钟种子）
function seededNoise(min: number, seed = 1): number {
  const x = Math.sin(min * 12.9898 + seed * 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1 // [-1, 1]
}

// 平滑插值辅助
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// 基础 24h 血压曲线（无异常），min ∈ [0, 1440)
export function baseProfile(c: CaseDef, min: number): { sbp: number; dbp: number } {
  const h = min / 60
  let sbp = c.baseSbp
  let dbp = c.baseDbp

  // 夜间低谷（杓型：0:00-5:00 下降约 12%）
  const dip = c.nonDipper ? 0.03 : 0.12
  const nightFactor = 1 - dip * (smoothstep(22, 24, h) + (1 - smoothstep(4, 6, h)) * (h < 12 ? 1 : 0))
  // 上面表达式在跨午夜间不够直观，直接用分段：
  let nf = 1
  if (h >= 22 || h < 4.5) nf = 1 - dip
  else if (h >= 4.5 && h < 6.5) nf = 1 - dip * (1 - smoothstep(4.5, 6.5, h))
  else if (h >= 20 && h < 22) nf = 1 - dip * smoothstep(20, 22, h)
  void nightFactor

  sbp *= nf
  dbp *= nf

  // 晨峰（6:30-9:30，晨峰型更陡）
  const surgeAmp = c.subtype.includes("晨峰") ? 14 : 7
  const surge = surgeAmp * Math.exp(-Math.pow(h - 8, 2) / 1.1)
  sbp += surge
  dbp += surge * 0.45

  // 午后小峰 + 傍晚峰
  sbp += 5 * Math.exp(-Math.pow(h - 16.5, 2) / 2.2)
  dbp += 2.5 * Math.exp(-Math.pow(h - 16.5, 2) / 2.2)
  sbp += 6 * Math.exp(-Math.pow(h - 19.5, 2) / 1.6)
  dbp += 3 * Math.exp(-Math.pow(h - 19.5, 2) / 1.6)

  // 白大衣：白天诊室时段偏高（9-11 点）
  if (c.subtype.includes("白大衣")) {
    sbp += 9 * Math.exp(-Math.pow(h - 10, 2) / 1.4)
    dbp += 4 * Math.exp(-Math.pow(h - 10, 2) / 1.4)
  }

  return { sbp, dbp }
}

// 异常注入对血压的叠加影响
export interface IncidentWindow {
  id: IncidentId
  startMin: number // SIM 分钟
}

export function incidentDelta(w: IncidentWindow | null, min: number): { sbp: number; dbp: number } {
  if (!w || w.id === "none") return { sbp: 0, dbp: 0 }
  const t = min - w.startMin // 距异常开始的分钟数
  if (t < 0 || t > 240) return { sbp: 0, dbp: 0 } // 异常影响最长 4 小时

  const rise = smoothstep(0, 30, t) // 30 分钟爬升
  const fall = 1 - smoothstep(150, 240, t) // 150 分钟后消退
  const env = rise * fall

  switch (w.id) {
    case "surge":
      return { sbp: 34 * env, dbp: 18 * env }
    case "ortho":
      return { sbp: -52 * env, dbp: -30 * env }
    case "afib":
      return { sbp: 8 * env + 10 * seededNoise(min, 7) * env, dbp: 4 * env }
    case "missed":
      return { sbp: 16 * env, dbp: 9 * env }
    case "salt":
      return { sbp: 12 * env, dbp: 6 * env }
    case "glitch": {
      // 单点跳变：仅个别分钟出现尖刺
      const spike = seededNoise(Math.floor(min / 3), 13) > 0.86 ? 42 : 0
      return { sbp: spike * (t < 120 ? 1 : 0), dbp: spike * 0.4 * (t < 120 ? 1 : 0) }
    }
    default:
      return { sbp: 0, dbp: 0 }
  }
}

// 实测曲线 = 基础 + 异常 + 噪声
export function measuredBP(c: CaseDef, min: number, w: IncidentWindow | null): { sbp: number; dbp: number } {
  const b = baseProfile(c, min)
  const d = incidentDelta(w, min)
  return {
    sbp: Math.round(b.sbp + d.sbp + seededNoise(min, 2) * 2.4),
    dbp: Math.round(b.dbp + d.dbp + seededNoise(min, 3) * 1.6),
  }
}

// 孪生推演曲线 = 平滑预测（不含瞬时噪声，异常响应更迟缓、幅度更小）
export function twinBP(c: CaseDef, min: number, w: IncidentWindow | null): { sbp: number; dbp: number } {
  const b = baseProfile(c, min)
  const d = incidentDelta(w, min)
  return {
    sbp: Math.round(b.sbp + d.sbp * 0.85 + seededNoise(min, 5) * 0.8),
    dbp: Math.round(b.dbp + d.dbp * 0.85 + seededNoise(min, 6) * 0.5),
  }
}

// SIM 分钟 → "hh:mm"
export function fmtSimTime(min: number): string {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440
  const hh = Math.floor(m / 60).toString().padStart(2, "0")
  const mm = (m % 60).toString().padStart(2, "0")
  return `${hh}:${mm}`
}
