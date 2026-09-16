import { useState } from "react"
import { useApp } from "@/state/store"
import { CASES, INCIDENTS, type CaseId, type IncidentId } from "@/lib/data"

export function MissionSetup() {
  const { dispatch } = useApp()
  const [caseId, setCaseId] = useState<CaseId>("P-001")
  const [incident, setIncident] = useState<IncidentId>("none")

  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="mb-8 fade-up">
        <div className="flex items-center gap-2">
          <span className="status-dot inline-block h-2 w-2 rounded-full bg-emerald-400 text-emerald-600" />
          <span className="font-mono-data text-[11px] tracking-[0.3em] text-emerald-600">示教病例与演练情景</span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold text-slate-800">
          示教病例设置 <span className="text-emerald-600 text-glow-emerald">· IntelliPress</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">选择病例与演练情景，进入全流程演示</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* 病例选择 */}
        <section className="panel p-5 lg:col-span-3 fade-up" style={{ animationDelay: "0.05s" }}>
          <h2 className="mb-1 font-mono-data text-xs tracking-[0.25em] text-emerald-600">① 病例选择</h2>
          <p className="mb-4 text-xs text-slate-500">1 个真实病例（已脱敏）+ 2 个演示病例</p>
          <div className="space-y-3">
            {CASES.map((c) => {
              const active = caseId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setCaseId(c.id)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    active
                      ? "border-emerald-500 bg-emerald-50 shadow-sm"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono-data text-sm font-semibold ${active ? "text-emerald-600" : "text-slate-600"}`}>
                      {c.id}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono-data text-[10px] ${
                        c.kind === "真实病例·已脱敏" ? "bg-emerald-50 text-emerald-600" : "bg-violet-100 text-violet-600"
                      }`}
                    >
                      {c.kind}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{c.summary}</p>
                </button>
              )
            })}
          </div>
        </section>

        {/* 突发情景演练 */}
        <section className="panel p-5 lg:col-span-2 fade-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-1 font-mono-data text-xs tracking-[0.25em] text-emerald-600">② 突发情景演练</h2>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            用于演练系统在突发情景下的分级响应能力。真实系统中，这些事件由穿戴传感器与监测算法自动检出；
            此处人为注入一次，演示风险预警的分级处置流程（Ⅳ 提示 → Ⅲ 加强监测 → Ⅱ 通知家属/医生 → Ⅰ 紧急直连 120）。
          </p>
          <div className="grid grid-cols-2 gap-2">
            {INCIDENTS.map((it) => {
              const active = incident === it.id
              const catColor =
                it.category === "生理" ? "text-red-600" : it.category === "行为" ? "text-amber-600" : it.category === "设备" ? "text-sky-600" : "text-slate-500"
              return (
                <button
                  key={it.id}
                  onClick={() => setIncident(it.id)}
                  className={`rounded-md border px-2.5 py-2 text-left transition ${
                    active
                      ? "border-red-400 bg-red-50"
                      : "border-slate-300 bg-white hover:border-slate-400"
                  }`}
                >
                  <div className={`text-[11px] leading-tight ${active ? "text-slate-800" : "text-slate-500"}`}>{it.label}</div>
                  {it.category !== "无" && <div className={`mt-1 font-mono-data text-[9px] ${catColor}`}>{it.category}类</div>}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 fade-up" style={{ animationDelay: "0.15s" }}>
        <button
          onClick={() => dispatch({ type: "START_DEMO", caseId, incident })}
          className="rounded-lg border border-emerald-500 bg-emerald-50 px-14 py-3.5 font-mono-data text-lg tracking-[0.2em] text-emerald-700 transition hover:bg-emerald-100 hover:text-glow-emerald"
        >
          开始演示 →
        </button>
        <p className="text-xs text-slate-500">演示按阶段推进，每个阶段结束后点击进入下一阶段</p>
      </div>
    </div>
  )
}
