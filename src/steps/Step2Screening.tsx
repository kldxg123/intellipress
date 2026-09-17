import { useEffect, useMemo, useRef, useState } from "react"
import { useApp } from "@/state/store"
import { CASES } from "@/lib/data"
import { assessCase, BP_GRADE_TABLE, MATRIX_ROWS, MATRIX_COLS, RISK_MATRIX, CATEGORY_LABEL, type Assessment } from "@/lib/guidelines"
import { queryCaseSubgraph, NODE_TYPE_COLORS, evidenceCount, caseEvidence, KG_NODES, type KGNode, type KGEdge } from "@/lib/knowledgeGraph"
import { LIT_TOTAL, LIT_BY_CATEGORY, type LitCategory, type LiteratureItem } from "@/lib/literature"
import type { CaseId } from "@/lib/data"
import { callDeepSeek, REPLAY_TEXTS, type LlmMode } from "@/lib/deepseek"
import { Prov } from "@/components/Prov"
import { StatusTag } from "@/components/StepCommon"

// SHAP 风格特征归因（模型参考信息，不参与判定；按病例预置数值）
const SHAP: Record<string, { name: string; v: number }[]> = {
  "P-001": [
    { name: "基线 SBP 178", v: 0.31 },
    { name: "合并 2 型糖尿病", v: 0.24 },
    { name: "晨峰型波动", v: 0.18 },
    { name: "依从性差", v: 0.15 },
    { name: "年龄 58", v: 0.12 },
  ],
  "D-01": [
    { name: "夜间非杓型", v: 0.28 },
    { name: "基线 SBP 156", v: 0.24 },
    { name: "隐匿性表型", v: 0.21 },
    { name: "年龄 65", v: 0.17 },
    { name: "白昼负荷", v: 0.10 },
  ],
  "D-02": [
    { name: "BMI 29.4", v: 0.27 },
    { name: "基线 SBP 148", v: 0.23 },
    { name: "白大衣效应", v: 0.19 },
    { name: "年龄 42（保护）", v: -0.16 },
    { name: "依从性良好（保护）", v: -0.11 },
  ],
}

const RISK_STYLE: Record<string, string> = {
  低危: "border-emerald-300 bg-emerald-50 text-emerald-600",
  中危: "border-amber-300 bg-amber-50 text-amber-600",
  高危: "border-orange-200 bg-orange-50 text-orange-300",
  很高危: "border-red-300 bg-red-50 text-red-600",
}

type Phase = "engine" | "kg" | "llm"

// 第 2 阶段 · 智能早筛：指南规则引擎（判定主体）→ 医学知识图谱（辅助判定）→ DeepSeek 仅解释
export function Step2Screening({ onDone }: { onDone: () => void }) {
  const { state } = useApp()
  const caseDef = CASES.find((c) => c.id === state.caseId)!
  const assessment = useMemo<Assessment>(() => assessCase(caseDef.id), [caseDef.id])
  const subgraph = useMemo(() => queryCaseSubgraph(caseDef.id), [caseDef.id])

  const [phase, setPhase] = useState<Phase>("engine")
  // 引擎动画状态
  const [gradeScanIdx, setGradeScanIdx] = useState(-1) // 已扫描到的分级表行
  const [factorIdx, setFactorIdx] = useState(0) // 已核对因子数
  const [matrixFlash, setMatrixFlash] = useState(false)
  const [matrixSettled, setMatrixSettled] = useState(false)
  const [engineDone, setEngineDone] = useState(false)
  // 图谱动画状态
  const [kgEntities, setKgEntities] = useState(0) // 已揭示入口实体数
  const [kgNeighbors, setKgNeighbors] = useState(false)
  const [kgClauses, setKgClauses] = useState(0)
  // LLM 解读状态
  const [text, setText] = useState("")
  const [mode, setMode] = useState<LlmMode | null>(null)
  const [typing, setTyping] = useState(true)
  const [showShap, setShowShap] = useState(false)
  const [latency, setLatency] = useState<number | null>(null)
  const doneRef = useRef(false)

  // ── 时序编排：引擎 (~7s) → 图谱 (~4s) → AI 解读 ──
  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => { if (!cancelled) fn() }, ms))
    }
    // 1) 分级表逐行扫描
    BP_GRADE_TABLE.forEach((_, i) => later(() => setGradeScanIdx(i), i * 400))
    let t = BP_GRADE_TABLE.length * 400 + 200
    // 2) 危险因素逐项核对
    assessment.factors.forEach((_, i) => later(() => setFactorIdx(i + 1), t + i * 420))
    t += assessment.factors.length * 420 + 200
    // 3) 分层矩阵命中格闪烁 → 定格
    later(() => setMatrixFlash(true), t)
    later(() => { setMatrixFlash(false); setMatrixSettled(true) }, t + 1200)
    later(() => setEngineDone(true), t + 1350)
    later(() => setPhase("kg"), t + 1750)
    t += 1750
    // 4) 图谱：入口实体逐个揭示 → 一跳邻点 → 条款卡
    subgraph.entityIds.forEach((_, i) => later(() => setKgEntities(i + 1), t + i * 350))
    t += subgraph.entityIds.length * 350
    later(() => setKgNeighbors(true), t + 300)
    subgraph.clauses.forEach((_, i) => later(() => setKgClauses(i + 1), t + 500 + i * 260))
    t += 500 + subgraph.clauses.length * 260 + 700
    later(() => setPhase("llm"), t)
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [assessment, subgraph])

  // ── AI 解读阶段：DeepSeek 流式解释（失败回退预置文案）──
  useEffect(() => {
    if (phase !== "llm") return
    let cancelled = false
    let typeTimer: ReturnType<typeof setInterval> | null = null
    const ctrl = new AbortController()
    const t0 = performance.now()

    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      setTimeout(onDone, 1200)
    }

    callDeepSeek(caseDef, assessment, (acc) => { if (!cancelled) setText(acc) }, ctrl.signal)
      .then((full) => {
        if (cancelled) return
        setMode("live")
        setLatency(Math.round(performance.now() - t0))
        setText(full)
        setTyping(false)
        setShowShap(true)
        finish()
      })
      .catch(() => {
        if (cancelled) return
        setMode("replay")
        const full = REPLAY_TEXTS[caseDef.id] ?? REPLAY_TEXTS["P-001"]
        let i = 0
        typeTimer = setInterval(() => {
          if (cancelled) { if (typeTimer) clearInterval(typeTimer); return }
          i += 3
          setText(full.slice(0, i))
          if (i >= full.length) {
            if (typeTimer) clearInterval(typeTimer)
            setTyping(false)
            setShowShap(true)
            finish()
          }
        }, 40)
      })
    return () => { cancelled = true; ctrl.abort(); if (typeTimer) clearInterval(typeTimer) }
  }, [phase, caseDef, assessment, onDone])

  const shapRows = SHAP[caseDef.id] ?? SHAP["P-001"]
  const phaseTag =
    phase === "engine" ? "规则引擎判定中 · 指南条款核对"
    : phase === "kg" ? "知识图谱推理 · 一跳子图展开"
    : "AI 解读中 · 仅解释引擎结论"

  return (
    <div>
      {/* 定位语：判断主体声明 */}
      <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-center">
        <span className="text-[13px] font-medium text-cyan-800">
          判断由<span className="mx-1 font-bold text-cyan-800">指南规则引擎</span>与
          <span className="mx-1 font-bold text-cyan-800">医学知识图谱</span>作出（含 {LIT_TOTAL} 篇文献证据），大模型仅负责解释
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusTag color="violet">{phaseTag}</StatusTag>
        {mode === "live" && (
          <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono-data text-[10px] text-emerald-600">
            ● 实时解读 · DeepSeek{latency !== null ? ` · 首响 ${latency}ms` : ""}
          </span>
        )}
        {mode === "replay" && (
          <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono-data text-[10px] text-amber-600">
            ◐ 回放模式（API 不可用，预置解释文案兜底）
          </span>
        )}
        <span className="ml-auto font-mono-data text-xs text-slate-500">
          依据 <span className="text-cyan-700">中国高血压防治指南（2024 年修订版）</span>
        </span>
      </div>

      {/* 行 1：规则引擎 + 知识图谱（均为判定主体） */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <EnginePanel
          assessment={assessment}
          gradeScanIdx={gradeScanIdx}
          factorIdx={factorIdx}
          matrixFlash={matrixFlash}
          matrixSettled={matrixSettled}
          engineDone={engineDone}
        />
        <KGPanel
          caseId={caseDef.id}
          subgraph={subgraph}
          kgEntities={kgEntities}
          kgNeighbors={kgNeighbors}
          kgClauses={kgClauses}
          active={phase !== "engine"}
        />
      </div>

      {/* 行 1.5：证据文献列表（图谱节点关联，按分类分组） */}
      {phase !== "engine" && <EvidencePanel caseId={caseDef.id} />}

      {/* 行 2：AI 解读（仅解释） + SHAP 参考 */}
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="panel scanline relative p-5 lg:col-span-3">
          <div className="mb-2 flex items-center justify-between font-mono-data text-[10px] text-slate-500">
            <span className="text-slate-600">AI 解读（仅解释，不参与判定）</span>
            <span>explanation.md · deepseek-chat</span>
          </div>
          {phase !== "llm" ? (
            <div className="py-8 text-center font-mono-data text-[11px] text-slate-400">
              等待规则引擎与知识图谱完成判定…
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono-data text-[12.5px] leading-relaxed text-slate-700">
              {text}
              {typing && <span className="type-cursor text-emerald-600">▌</span>}
            </pre>
          )}
          {!typing && phase === "llm" && (
            <div className="mt-3 border-t border-slate-200 pt-2 font-mono-data text-[10px] text-slate-500">
              ⚠ 分层结论由规则引擎作出 · AI 输出仅为自然语言解释，不构成诊断 · 审计日志已记录
            </div>
          )}
        </div>

        <div className={`panel p-5 lg:col-span-2 ${showShap ? "fade-up" : "opacity-30"}`}>
          <div className="mb-1 font-mono-data text-[10px] tracking-widest text-slate-500">SHAP 特征归因 · 危险度贡献</div>
          <div className="mb-3 font-mono-data text-[9px] text-slate-400">模型特征贡献度参考（不参与分级/分层判定）</div>
          <div className="space-y-2.5">
            {shapRows.map((r) => (
              <div key={r.name}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span className="text-slate-600">{r.name}</span>
                  <Prov value={(r.v > 0 ? "+" : "") + r.v.toFixed(2)} src="model" conf={91} className={r.v > 0 ? "text-amber-600" : "text-emerald-600"} />
                </div>
                <div className="flex h-1.5 items-center rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: showShap ? `${Math.abs(r.v) * 250}%` : "0%",
                      background: r.v > 0 ? "linear-gradient(90deg,#f59e0b,#ef4444)" : "linear-gradient(90deg,#059669,#34d399)",
                      boxShadow: `0 0 8px ${r.v > 0 ? "rgba(245,158,11,0.4)" : "rgba(52,211,153,0.4)"}`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 font-mono-data text-[10px] leading-relaxed text-slate-500">
            判定主体：规则引擎 + 知识图谱 · 模型仅提供特征贡献度参考
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 指南规则引擎面板：分级表扫描 → 因子核对 → 矩阵命中 → 结论 ──
function EnginePanel({
  assessment, gradeScanIdx, factorIdx, matrixFlash, matrixSettled, engineDone,
}: {
  assessment: Assessment
  gradeScanIdx: number
  factorIdx: number
  matrixFlash: boolean
  matrixSettled: boolean
  engineDone: boolean
}) {
  const { grade, factors, matrixRow, matrixCol, risk } = assessment
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono-data text-[10px] tracking-widest text-slate-500">指南规则引擎 · 判定轨迹</span>
        <span className="rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 font-mono-data text-[9px] text-cyan-700">规则</span>
      </div>

      {/* 分级表 */}
      <div className="mb-3">
        <div className="mb-1 font-mono-data text-[9px] text-slate-400">① 血压分级表扫描（按最高测值定级）</div>
        <div className="space-y-0.5">
          {BP_GRADE_TABLE.map((row, i) => {
            const scanned = i <= gradeScanIdx
            const isHit = scanned && i === grade.hitIndex && gradeScanIdx >= grade.hitIndex
            const scanning = i === gradeScanIdx && i !== grade.hitIndex
            return (
              <div
                key={row.label}
                className={`flex items-center justify-between rounded px-2 py-1 font-mono-data text-[10.5px] transition-colors duration-200 ${
                  isHit
                    ? "border border-red-300 bg-red-50 text-red-700"
                    : scanning
                      ? "border border-cyan-200 bg-cyan-50 text-cyan-800"
                      : scanned
                        ? "border border-transparent text-slate-400 line-through-none"
                        : "border border-transparent text-slate-400"
                }`}
              >
                <span>{row.label}</span>
                <span>{row.range}{isHit ? " ← 命中" : scanned ? " ✓" : ""}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 危险因素核对 */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between font-mono-data text-[9px] text-slate-400">
          <span>② 危险因素 / 靶器官损害 / 并发症核对</span>
          <span>{Math.min(factorIdx, factors.length)}/{factors.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          {factors.map((f, i) => {
            const done = i < factorIdx
            return (
              <div key={f.key} className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] ${done ? "" : "opacity-40"}`}>
                <span className={`font-mono-data ${done ? (f.present ? "text-red-600" : "text-slate-400") : "text-slate-400"}`}>
                  {done ? (f.present ? "✓" : "✗") : "·"}
                </span>
                <span className={done ? (f.present ? "text-slate-700" : "text-slate-500") : "text-slate-400"}>
                  {f.label}
                  <span className="ml-1 font-mono-data text-[8px] text-slate-400">{CATEGORY_LABEL[f.category]}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 分层矩阵 */}
      <div className="mb-2">
        <div className="mb-1 font-mono-data text-[9px] text-slate-400">③ 心血管危险分层矩阵</div>
        <div className="grid" style={{ gridTemplateColumns: "auto repeat(3, 1fr)", gap: 2 }}>
          <div />
          {MATRIX_COLS.map((c) => (
            <div key={c} className="text-center font-mono-data text-[9px] text-slate-500">{c}</div>
          ))}
          {MATRIX_ROWS.map((rl, r) => (
            <MatrixRow key={rl} rowLabel={rl} r={r} matrixRow={matrixRow} matrixCol={matrixCol} flash={matrixFlash} settled={matrixSettled} />
          ))}
        </div>
      </div>

      {/* 结论 */}
      <div className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 transition-opacity duration-500 ${engineDone ? "opacity-100" : "opacity-0"} ${RISK_STYLE[risk]}`}>
        <div className="font-mono-data text-[10px]">
          <div>血压分级：{grade.label}</div>
          <div className="text-slate-500">{MATRIX_ROWS[matrixRow]}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tracking-wider">{risk}</div>
          <div className="font-mono-data text-[9px] opacity-70">指南规则引擎判定</div>
        </div>
      </div>
    </div>
  )
}

function MatrixRow({ rowLabel, r, matrixRow, matrixCol, flash, settled }: {
  rowLabel: string; r: number; matrixRow: number; matrixCol: number; flash: boolean; settled: boolean
}) {
  return (
    <>
      <div className="flex items-center pr-1 font-mono-data text-[8.5px] leading-tight text-slate-500" style={{ maxWidth: 92 }}>{rowLabel}</div>
      {RISK_MATRIX[r].map((cell, c) => {
        const hit = r === matrixRow && c === matrixCol
        const active = hit && (flash || settled)
        return (
          <div
            key={c}
            className={`rounded border px-1 py-1 text-center font-mono-data text-[10px] transition-all duration-200 ${
              active
                ? `${RISK_STYLE[cell]} ${flash ? "animate-pulse scale-105" : "scale-100"} font-bold`
                : "border-slate-200 text-slate-400"
            }`}
          >
            {cell}
          </div>
        )
      })}
    </>
  )
}

// ── 医学知识图谱面板：径向一跳子图 + 命中条款 ──
function KGPanel({ caseId, subgraph, kgEntities, kgNeighbors, kgClauses, active }: {
  caseId: string
  subgraph: { nodes: KGNode[]; edges: KGEdge[]; entityIds: string[]; clauses: { no: string; text: string; from: string }[] }
  kgEntities: number
  kgNeighbors: boolean
  kgClauses: number
  active: boolean
}) {
  const W = 420, H = 250, CX = W / 2, CY = H / 2 - 8, R1 = 62, R2 = 108

  // 布局：中心病例 → 入口实体环 → 一跳邻点环（贴靠相连实体的角度）
  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>()
    const entities = subgraph.entityIds
    entities.forEach((id, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / entities.length
      pos.set(id, { x: CX + R1 * Math.cos(a), y: CY + R1 * Math.sin(a) })
    })
    const neighbors = subgraph.nodes.filter((n) => !entities.includes(n.id))
    neighbors.forEach((n) => {
      // 取与该邻点相连的入口实体角度均值
      const linkedAngles: number[] = []
      for (const e of subgraph.edges) {
        let other: string | null = null
        if (e.from === n.id && entities.includes(e.to)) other = e.to
        if (e.to === n.id && entities.includes(e.from)) other = e.from
        if (other) {
          const idx = entities.indexOf(other)
          linkedAngles.push(-Math.PI / 2 + (idx * 2 * Math.PI) / entities.length)
        }
      }
      const a = linkedAngles.length
        ? Math.atan2(
            linkedAngles.reduce((s, x) => s + Math.sin(x), 0),
            linkedAngles.reduce((s, x) => s + Math.cos(x), 0),
          )
        : Math.PI / 2
      pos.set(n.id, { x: CX + R2 * Math.cos(a), y: CY + R2 * Math.sin(a) })
    })
    return pos
  }, [subgraph])

  const visibleIds = useMemo(() => {
    if (!active) return new Set<string>()
    const s = new Set<string>(subgraph.entityIds.slice(0, kgEntities))
    if (kgNeighbors) for (const n of subgraph.nodes) if (!subgraph.entityIds.includes(n.id)) s.add(n.id)
    return s
  }, [active, subgraph, kgEntities, kgNeighbors])

  const nodeById = (id: string) => subgraph.nodes.find((n) => n.id === id)

  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono-data text-[10px] tracking-widest text-slate-500">医学知识图谱 · 一跳子图</span>
        <span className="rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 font-mono-data text-[9px] text-cyan-700">规则</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* 边 */}
        {subgraph.edges.map((e, i) => {
          const a = layout.get(e.from), b = layout.get(e.to)
          if (!a || !b) return null
          const vis = visibleIds.has(e.from) && visibleIds.has(e.to)
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={vis ? "#94a3b8" : "#e2e8f0"}
              strokeWidth={vis ? 1.2 : 0.8}
              strokeDasharray={e.type === "增加风险" ? "4 3" : undefined}
              opacity={vis ? 0.9 : 0.35}
              className="transition-opacity duration-500"
            />
          )
        })}
        {/* 一跳邻点 */}
        {subgraph.nodes.filter((n) => !subgraph.entityIds.includes(n.id)).map((n) => {
          const p = layout.get(n.id)!
          const vis = visibleIds.has(n.id)
          const ev = evidenceCount(n.id)
          return (
            <g key={n.id} opacity={vis ? 1 : 0.15} className="transition-opacity duration-500">
              <circle cx={p.x} cy={p.y} r={13} fill="#ffffff" stroke={NODE_TYPE_COLORS[n.type]} strokeWidth={1.4} />
              <text x={p.x} y={p.y + 24} textAnchor="middle" fontSize={8.5} fill={vis ? "#64748b" : "#cbd5e1"}>{n.label}</text>
              {vis && ev > 0 && (
                <g>
                  <circle cx={p.x + 11} cy={p.y - 11} r={6.5} fill={NODE_TYPE_COLORS.literature} />
                  <text x={p.x + 11} y={p.y - 8.6} textAnchor="middle" fontSize={7} fontWeight={700} fill="#ffffff">{ev}</text>
                  <title>证据 {ev} 篇文献</title>
                </g>
              )}
            </g>
          )
        })}
        {/* 入口实体 */}
        {subgraph.entityIds.map((id, i) => {
          const n = nodeById(id)!
          const p = layout.get(id)!
          const vis = i < kgEntities
          const ev = evidenceCount(id)
          return (
            <g key={id} opacity={vis ? 1 : 0.15} className="transition-opacity duration-500">
              <circle cx={p.x} cy={p.y} r={17} fill="#ffffff" stroke={NODE_TYPE_COLORS[n.type]} strokeWidth={2.2}
                style={vis ? { filter: `drop-shadow(0 0 4px ${NODE_TYPE_COLORS[n.type]}44)` } : undefined} />
              <text x={p.x} y={p.y + 30} textAnchor="middle" fontSize={9} fontWeight={600} fill={vis ? "#334155" : "#cbd5e1"}>{n.label}</text>
              {vis && ev > 0 && (
                <g>
                  <circle cx={p.x + 14} cy={p.y - 14} r={7} fill={NODE_TYPE_COLORS.literature} />
                  <text x={p.x + 14} y={p.y - 11.4} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#ffffff">{ev}</text>
                  <title>证据 {ev} 篇文献</title>
                </g>
              )}
            </g>
          )
        })}
        {/* 中心病例节点 */}
        <g>
          <circle cx={CX} cy={CY} r={20} fill="#fffbeb" stroke="#f59e0b" strokeWidth={2.5}
            style={{ filter: "drop-shadow(0 0 6px rgba(245,158,11,0.35))" }} />
          <text x={CX} y={CY + 3} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#d97706">{caseId}</text>
        </g>
      </svg>
      {/* 图例 */}
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono-data text-[8.5px] text-slate-500">
        {(["disease", "riskfactor", "drug", "intervention", "indicator"] as const).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: NODE_TYPE_COLORS[t] }} />
            {{ disease: "疾病", riskfactor: "危险因素", drug: "药物", intervention: "干预", indicator: "指标" }[t]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: NODE_TYPE_COLORS.literature }} />
          证据文献（节点角标为关联篇数）
        </span>
      </div>
      {/* 命中条款 */}
      <div className="mt-2 border-t border-slate-200 pt-2">
        <div className="mb-1 font-mono-data text-[9px] text-slate-400">命中指南条款（图谱节点关联）</div>
        <div className="max-h-[86px] space-y-1 overflow-y-auto pr-1">
          {subgraph.clauses.slice(0, kgClauses).map((cl, i) => (
            <div key={i} className="fade-up rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[9.5px] leading-snug">
              <span className="font-mono-data text-cyan-700">{cl.no}</span>
              <span className="mx-1 text-slate-400">[{cl.from}]</span>
              <span className="text-slate-600">{cl.text}</span>
            </div>
          ))}
          {kgClauses === 0 && <div className="font-mono-data text-[9px] text-slate-400">条款检索中…</div>}
        </div>
      </div>
    </div>
  )
}

// ── 证据文献列表：五大分类分组，命中当前病例子图节点的文献置顶高亮，默认每组 3 条可展开 ──
const LIT_CATEGORY_ORDER: LitCategory[] = ["大模型×高血压", "数字孪生", "真实数据", "数据统计", "生活方式与综合管理"]

function EvidencePanel({ caseId }: { caseId: CaseId }) {
  const { hits } = useMemo(() => caseEvidence(caseId), [caseId])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const nodeLabel = useMemo(() => new Map(KG_NODES.map((n) => [n.id, n.label])), [])
  const hitIds = useMemo(() => new Set(hits.map((h) => h.lit.id)), [hits])
  const hitVia = useMemo(() => new Map(hits.map((h) => [h.lit.id, h.viaNodes])), [hits])

  return (
    <div className="panel fade-up mb-4 p-4" data-lit-panel>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono-data text-[10px] tracking-widest text-slate-500">
          证据文献列表 · 命中 <span className="font-bold text-indigo-600">{hits.length}</span> 篇 / 库共 {LIT_TOTAL} 篇
        </span>
        <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono-data text-[9px] text-indigo-600">文献证据库 · 经「证据支持」边挂接图谱</span>
      </div>
      {hits.length === 0 && (
        <div className="py-3 text-center font-mono-data text-[10px] text-slate-400">当前病例暂无直接关联证据文献</div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {LIT_CATEGORY_ORDER.map((cat) => {
          const all = LIT_BY_CATEGORY[cat] ?? []
          const sorted = [...all].sort((a, b) => Number(hitIds.has(b.id)) - Number(hitIds.has(a.id)))
          const catHits = sorted.filter((it) => hitIds.has(it.id)).length
          const open = !!expanded[cat]
          const shown = open ? sorted : sorted.slice(0, 3)
          return (
            <div key={cat} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5" data-lit-group={cat}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[10.5px] font-semibold text-indigo-700">{cat}</span>
                <span className="font-mono-data text-[9px] text-slate-400">命中 {catHits} / 共 {all.length} 篇</span>
              </div>
              <div className="space-y-1">
                {shown.map((lit: LiteratureItem) => {
                  const hit = hitIds.has(lit.id)
                  const via = hitVia.get(lit.id) ?? []
                  return (
                    <div
                      key={lit.id}
                      data-lit-row
                      className={`flex items-start gap-2 rounded border px-2 py-1 ${
                        hit ? "border-indigo-200 bg-indigo-50/70" : "border-slate-200 bg-white opacity-70"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] leading-snug text-slate-700" title={lit.title}>{lit.title}</div>
                        <div className="font-mono-data text-[9px] text-slate-500">
                          {lit.author} · {lit.year || "年份不详"}
                          {via.length > 0 && (
                            <span className="ml-1 text-indigo-400">关联节点：{via.map((n) => nodeLabel.get(n) ?? n).join("、")}</span>
                          )}
                        </div>
                      </div>
                      {hit && (
                        <span className="shrink-0 rounded border border-indigo-200 bg-indigo-50 px-1 py-0.5 font-mono-data text-[8.5px] text-indigo-600">命中</span>
                      )}
                    </div>
                  )
                })}
              </div>
              {all.length > 3 && (
                <button
                  onClick={() => setExpanded((s) => ({ ...s, [cat]: !open }))}
                  className="mt-1.5 font-mono-data text-[9px] text-indigo-500 hover:text-indigo-700"
                  data-lit-expand={cat}
                >
                  {open ? "▲ 收起" : `▼ 展开全部 (${all.length})`}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
