import { useEffect, useMemo, useRef, useState } from "react"
import { useApp } from "@/state/store"
import { CASES, INCIDENTS, LEVEL_META } from "@/lib/data"
import { generatePlan } from "@/lib/planEngine"
import { measuredBP, fmtSimTime } from "@/lib/bpSim"
import { runtime } from "@/lib/runtime"
import { BPChart } from "@/components/BPChart"
import { Prov } from "@/components/Prov"
import { StatusTag } from "@/components/StepCommon"

const ENDPOINTS = [
  { name: "微信小程序", icon: "📱", desc: "患者端任务与打卡" },
  { name: "智能手表", icon: "⌚", desc: "测量 + 振动提醒" },
  { name: "医疗 SaaS", icon: "🖥️", desc: "医生端监护看板" },
]

interface Alert {
  level: 4 | 3 | 2 | 1
  latencyMs: string
  ts: string
}

// 第 5 阶段 · 居家执行：方案 → 照护任务时间轴（压缩呈现 ~5s）→ 24h 监护 + 突发情景分级响应
export function Step5HomeExecution({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useApp()
  const caseDef = CASES.find((c) => c.id === state.caseId)!
  const incidentDef = INCIDENTS.find((i) => i.id === state.incident)!
  // 照护任务时间轴与第 4 阶段方案同源：planEngine 输出（测量频次/服药时间对齐分层结论）
  const plan = useMemo(() => generatePlan(caseDef.id), [caseDef.id])
  const TASKS = plan.careTasks

  const [phase, setPhase] = useState<"timeline" | "monitoring">("timeline")
  const [taskCount, setTaskCount] = useState(0)
  const [epCount, setEpCount] = useState(0)

  const [triggered, setTriggered] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [resolved, setResolved] = useState(false)
  const [archived, setArchived] = useState(0)
  const [dayEnded, setDayEnded] = useState(false)
  const doneRef = useRef(false)
  const simMinRef = useRef(state.simMin)
  simMinRef.current = state.simMin
  const alertsRef = useRef(alerts)
  alertsRef.current = alerts

  const levels = incidentDef.levels

  // ── 时间轴压缩呈现（~5s 后切入监护）──
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    TASKS.forEach((_, i) => timers.push(setTimeout(() => setTaskCount(i + 1), 300 + i * 400)))
    ENDPOINTS.forEach((_, i) => timers.push(setTimeout(() => setEpCount(i + 1), 2900 + i * 500)))
    timers.push(setTimeout(() => setPhase("monitoring"), 4700))
    return () => timers.forEach(clearTimeout)
  }, [])

  // ── 突发情景触发（进入监护后 ~8s 自动，或手动 ⚡）；不注入路径不再定时完成，统一在 24:00 收尾 ──
  const trigger = () => {
    if (triggered || incidentDef.id === "none" || dayEnded) return
    setTriggered(true)
    runtime.incident = { id: incidentDef.id, startMin: simMinRef.current }
  }

  useEffect(() => {
    if (phase !== "monitoring") return
    if (incidentDef.id === "none") return
    const t = setTimeout(trigger, 8000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── 告警分级推进：每 5s 升级一级，末级保持 5s 后消退；消退 4s 后归档（不在此处完成阶段）──
  useEffect(() => {
    if (!triggered || levels.length === 0) return
    const timers: ReturnType<typeof setTimeout>[] = []
    levels.forEach((lv, i) => {
      timers.push(
        setTimeout(() => {
          runtime.alertLevel = lv
          setAlerts((prev) => [
            ...prev,
            { level: lv, latencyMs: (2.4 + Math.random() * 6.1).toFixed(2), ts: fmtSimTime(simMinRef.current) },
          ])
        }, i * 5000),
      )
    })
    timers.push(
      setTimeout(() => {
        runtime.alertLevel = 0
        setResolved(true)
        // 4s 后清空告警流并归档
        timers.push(
          setTimeout(() => {
            setArchived((n) => n + alertsRef.current.length)
            setAlerts([])
          }, 4000),
        )
      }, levels.length * 5000 + 5000),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggered])

  // ── 日间监护收尾：监护时钟到达 24:00（两条路径统一在此完成）──
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (endTimerRef.current) clearTimeout(endTimerRef.current) }, []) // 仅卸载时清理
  useEffect(() => {
    if (phase !== "monitoring" || dayEnded) return
    if (state.simMin < 1440) return
    setDayEnded(true)
    dispatch({ type: "SET_SIM_RUNNING", on: false })
    runtime.alertLevel = 0
    setResolved(true)
    if (alertsRef.current.length > 0) {
      setArchived((n) => n + alertsRef.current.length)
      setAlerts([])
    }
    // 注意：不随 effect 清理（dayEnded 翻转会重跑本 effect），计时器由卸载 effect 统一清理
    endTimerRef.current = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, 800)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state.simMin, dayEnded])

  const bp = measuredBP(caseDef, state.simMin, runtime.incident)
  const hr = Math.round(66 + (bp.sbp - 120) / 3.5 + (runtime.alertLevel > 0 ? 8 : 0))
  const bpColor = runtime.alertLevel === 1 ? "text-red-600 text-glow-red" : runtime.alertLevel > 0 ? "text-amber-600 text-glow-amber" : "text-emerald-600 text-glow-emerald"

  const chartIncident = useMemo(() => runtime.incident, [triggered, state.simMin]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusTag color="amber">{phase === "timeline" ? "照护任务下发中" : "监护值守中"}</StatusTag>
        <span className="font-mono-data text-xs text-slate-500">
          {phase === "timeline" ? "方案拆解 → 照护任务时间轴 → 三端同步" : "监护时钟压缩推进 · 孪生体实时映射 · 分级响应 Ⅳ→Ⅰ"}
        </span>
        {phase === "monitoring" && incidentDef.id !== "none" && !triggered && (
          <button
            onClick={trigger}
            className="ml-auto rounded border border-red-300 bg-red-50 px-3 py-1 font-mono-data text-xs text-red-600 transition hover:bg-red-100"
          >
            ⚡ 触发「{incidentDef.label}」
          </button>
        )}
        {phase === "monitoring" && incidentDef.id === "none" && (
          <span className="ml-auto font-mono-data text-[10px] text-emerald-600">本次演练不注入突发情景 · 全程平稳</span>
        )}
      </div>

      {/* 照护任务时间轴（压缩呈现） */}
      <div className={`grid gap-4 transition-all duration-700 lg:grid-cols-3 ${phase === "monitoring" ? "mb-4 opacity-80" : ""}`}>
        <div className="panel p-4 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between font-mono-data text-[10px] tracking-widest text-slate-500">
            <span>照护时间轴 · 24 小时血压日</span>
            {phase === "monitoring" && <span className="text-emerald-600">✓ 已下发</span>}
          </div>
          <div className={`relative space-y-${phase === "monitoring" ? "1.5" : "2.5"} pl-6`}>
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-emerald-500/60 via-emerald-900/40 to-transparent" />
            {TASKS.slice(0, taskCount).map((t) => (
              <div key={t.time} className="relative flex items-center gap-3 fade-up">
                <span className="absolute -left-6 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-emerald-500 bg-white" style={{ boxShadow: "0 0 0 3px rgba(16,185,129,0.18)" }} />
                <Prov value={t.time} src="rule" className="w-12 text-sm text-amber-600" />
                <span className="text-xs text-slate-700">{t.task}</span>
                <span className="ml-auto font-mono-data text-[10px] text-slate-500">{t.ch}</span>
                <span
                  className="rounded px-1 py-px font-mono-data text-[9px]"
                  style={t.prov === "rule" ? { color: "#b45309", background: "rgba(245,158,11,0.1)" } : { color: "#047857", background: "rgba(52,211,153,0.1)" }}
                >
                  {t.prov === "rule" ? "规则" : "模型"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-4">
          <div className="mb-2 font-mono-data text-[10px] tracking-widest text-slate-500">三端同步下发</div>
          <div className="space-y-2">
            {ENDPOINTS.map((ep, i) => {
              const on = epCount > i
              return (
                <div
                  key={ep.name}
                  className={`flex items-center gap-3 rounded-lg border p-2.5 transition-all duration-500 ${
                    on ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50 opacity-40"
                  }`}
                >
                  <span className="text-lg">{ep.icon}</span>
                  <div>
                    <div className={`text-xs font-medium ${on ? "text-emerald-600" : "text-slate-500"}`}>{ep.name}</div>
                    <div className="font-mono-data text-[10px] text-slate-500">{ep.desc}</div>
                  </div>
                  {on && (
                    <span className="ml-auto flex items-center gap-1 font-mono-data text-[10px] text-emerald-600 fade-up">
                      <span className="status-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" /> 已同步
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 24h 监护：生命体征 + 图表 + 告警流侧栏（不再使用固定浮层，避免遮挡操作区） */}
      {phase === "monitoring" && (
        <div className="grid gap-4 lg:grid-cols-4 fade-up">
          <div className="panel scanline relative p-5">
            <div className="mb-2 font-mono-data text-[10px] tracking-widest text-slate-500">实时生命体征 · 监护 {fmtSimTime(state.simMin)}</div>
            <div className="flex items-baseline gap-2">
              <Prov value={`${bp.sbp}/${bp.dbp}`} src="measured" className={`text-4xl font-bold ${bpColor}`} />
              <span className="font-mono-data text-xs text-slate-500">mmHg</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <Prov value={hr} src="measured" className="text-xl text-emerald-600" />
              <span className="font-mono-data text-xs text-slate-500">bpm · PPG</span>
            </div>
            <svg viewBox="0 0 260 46" className="mt-3 w-full">
              <polyline
                fill="none"
                stroke={runtime.alertLevel === 1 ? "#ef4444" : runtime.alertLevel > 0 ? "#f59e0b" : "#10b981"}
                strokeWidth="1.4"
                points={Array.from({ length: 65 }, (_, i) => {
                  const x = i * 4
                  const ph = (i % 13) / 13
                  const y = ph < 0.1 ? 8 : ph < 0.2 ? 36 : ph < 0.3 ? 18 : 24 + Math.sin(i * 0.5) * 2
                  return `${x},${y}`
                }).join(" ")}
              />
            </svg>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono-data text-[10px] text-slate-500">
              <span>采样 <Prov value="100Hz" src="measured" /></span>
              <span>链路时延 <Prov value="86ms" src="measured" /></span>
              <span>孪生同步偏差 <Prov value="±1.8mmHg" src="twin" /></span>
              <span>异常检出率 <Prov value="96.3%" src="model" conf={96} /></span>
            </div>
            {resolved && !dayEnded && incidentDef.id !== "none" && (
              <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 font-mono-data text-[11px] text-emerald-600 fade-up">
                ✓ 异常消退 · 曲线恢复基线
              </div>
            )}
            {dayEnded && (
              <div className="mt-3 rounded border border-cyan-200 bg-cyan-50 px-3 py-2 font-mono-data text-[11px] text-cyan-800 fade-up">
                ■ 日间监护结束 · 24:00 · 监护时钟已停止
                {incidentDef.id === "none" ? " · 全程平稳" : ""}
                {archived > 0 ? ` · 已归档 ${archived} 起告警` : ""}
              </div>
            )}
          </div>

          <div className="panel p-4 lg:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono-data text-[11px] tracking-widest text-slate-500">24h 血压日 · 实时绘制</span>
              <span className="font-mono-data text-[10px] text-slate-500">
                当前 <Prov value={`${bp.sbp}/${bp.dbp}`} src="measured" className="text-emerald-600" /> mmHg
              </span>
            </div>
            <BPChart caseDef={caseDef} uptoMin={state.simMin} incident={chartIncident} height={220} />
          </div>

          {/* 分级告警流侧栏 */}
          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between font-mono-data text-[10px] tracking-widest text-slate-500">
              <span>分级告警流</span>
              {alerts.length > 0 ? (
                <span className="text-amber-600">{alerts.length} 起进行中</span>
              ) : archived > 0 ? (
                <span className="text-emerald-600">已归档 {archived} 起</span>
              ) : null}
            </div>
            {alerts.length === 0 && archived === 0 && (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 text-center">
                <span className="status-dot inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <span className="font-mono-data text-[11px] text-slate-500">暂无告警 · 值守中</span>
              </div>
            )}
            {alerts.length === 0 && archived > 0 && (
              <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 text-center fade-up">
                <span className="text-emerald-600">✓</span>
                <span className="font-mono-data text-[11px] text-emerald-600">已归档 {archived} 起 · 审计日志</span>
              </div>
            )}
            <div className="space-y-2">
              {alerts.map((a, i) => {
                const meta = LEVEL_META[a.level]
                const isLatest = i === alerts.length - 1
                return (
                  <div
                    key={`${a.level}-${a.ts}-${i}`}
                    className="alert-in rounded-lg border p-3"
                    style={{
                      borderColor: `${meta.color}88`,
                      background: "#ffffff",
                      boxShadow: isLatest ? `0 0 18px ${meta.color}33` : undefined,
                      opacity: isLatest ? 1 : 0.55,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono-data text-xs font-bold" style={{ color: meta.color }}>{meta.name}</span>
                      <span className="font-mono-data text-[9px] text-slate-500">监护 {a.ts}</span>
                    </div>
                    <div className="mt-1 text-[10.5px] text-slate-600">{incidentDef.metric}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-500">处置：{meta.action}</div>
                    {a.level === 1 && (
                      <div className="mt-1 rounded bg-red-50 px-2 py-1 font-mono-data text-[10px] font-bold text-red-600 text-glow-red">
                        🚑 直连 120 · 位置已发送 · 家属已同步
                      </div>
                    )}
                    <div className="mt-1.5 flex justify-between font-mono-data text-[9px] text-slate-500">
                      <span>预警模块 → 照护协同</span>
                      <span>时延 <span className="text-emerald-600">{a.latencyMs}ms</span></span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
