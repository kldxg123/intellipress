import { useMemo } from "react"
import type { CaseDef } from "@/lib/data"
import { measuredBP, twinBP, type IncidentWindow } from "@/lib/bpSim"

// 血压双轨曲线图：实测（青色实线）vs 孪生推演（紫色虚线），24h 横轴
export function BPChart({
  caseDef,
  uptoMin, // 实测曲线绘制到该 SIM 分钟（孪生曲线全量预绘）
  incident,
  height = 190,
  showLegend = true,
}: {
  caseDef: CaseDef
  uptoMin: number
  incident: IncidentWindow | null
  height?: number
  showLegend?: boolean
}) {
  const W = 860
  const H = height
  const padL = 40
  const padR = 12
  const padT = 12
  const padB = 22
  const yMin = 60
  const yMax = 210

  const { measuredPts, twinPts, measuredDbpPts, twinDbpPts } = useMemo(() => {
    const xs = (min: number) => padL + (min / 1440) * (W - padL - padR)
    const ys = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB)
    const m: string[] = []
    const tw: string[] = []
    const md: string[] = []
    const td: string[] = []
    const upto = Math.floor(uptoMin)
    for (let min = 0; min < 1440; min += 5) {
      const tp = twinBP(caseDef, min, incident)
      tw.push(`${min === 0 ? "M" : "L"}${xs(min).toFixed(1)},${ys(tp.sbp).toFixed(1)}`)
      td.push(`${min === 0 ? "M" : "L"}${xs(min).toFixed(1)},${ys(tp.dbp).toFixed(1)}`)
      if (min <= upto) {
        const mp = measuredBP(caseDef, min, incident)
        m.push(`${m.length === 0 ? "M" : "L"}${xs(min).toFixed(1)},${ys(mp.sbp).toFixed(1)}`)
        md.push(`${md.length === 0 ? "M" : "L"}${xs(min).toFixed(1)},${ys(mp.dbp).toFixed(1)}`)
      }
    }
    return { measuredPts: m.join(" "), twinPts: tw.join(" "), measuredDbpPts: md.join(" "), twinDbpPts: td.join(" ") }
  }, [caseDef, uptoMin, incident, H])

  const curX = padL + (Math.min(uptoMin, 1440) / 1440) * (W - padL - padR)

  return (
    <div className="w-full">
      {showLegend && (
        <div className="mb-1 flex items-center gap-4 font-mono-data text-[10px]">
          <span className="flex items-center gap-1 text-emerald-600"><span className="inline-block h-0.5 w-4 bg-emerald-500" />实测 SBP/DBP</span>
          <span className="flex items-center gap-1 text-violet-600"><span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-violet-400" />孪生推演</span>
          <span className="ml-auto text-slate-500">mmHg · 24h</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* 网格 */}
        {[80, 120, 160, 200].map((v) => {
          const y = padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB)
          return (
            <g key={v}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth="0.6" />
              <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="ui-monospace, monospace">{v}</text>
            </g>
          )
        })}
        {[0, 4, 8, 12, 16, 20, 24].map((h) => {
          const x = padL + (h / 24) * (W - padL - padR)
          return (
            <g key={h}>
              <line x1={x} y1={padT} x2={x} y2={H - padB} stroke="#eef2f6" strokeWidth="0.6" />
              <text x={x} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="ui-monospace, monospace">{h.toString().padStart(2, "0")}:00</text>
            </g>
          )
        })}
        {/* 危险阈值线 180 */}
        <line
          x1={padL}
          y1={padT + (1 - (180 - yMin) / (yMax - yMin)) * (H - padT - padB)}
          x2={W - padR}
          y2={padT + (1 - (180 - yMin) / (yMax - yMin)) * (H - padT - padB)}
          stroke="#ef4444"
          strokeWidth="0.8"
          strokeDasharray="3 4"
          opacity="0.55"
        />
        {/* 孪生推演（全量） */}
        <path d={twinDbpPts} fill="none" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
        <path d={twinPts} fill="none" stroke="#8b5cf6" strokeWidth="1.4" strokeDasharray="4 3" opacity="0.75" />
        {/* 实测（推进式） */}
        <path d={measuredDbpPts} fill="none" stroke="#0f766e" strokeWidth="1" opacity="0.5" />
        <path d={measuredPts} fill="none" stroke="#10b981" strokeWidth="1.6" opacity="0.95" />
        {/* 当前时刻游标 */}
        <line x1={curX} y1={padT} x2={curX} y2={H - padB} stroke="#f59e0b" strokeWidth="1" opacity="0.7" />
      </svg>
    </div>
  )
}
