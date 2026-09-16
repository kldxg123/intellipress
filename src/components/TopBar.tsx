import { useState } from "react"
import { useApp } from "@/state/store"
import { STEPS } from "@/lib/data"
import { fmtSimTime } from "@/lib/bpSim"
import { getBrightness, setBrightness } from "@/lib/vitals"

export function TopBar() {
  const { state, dispatch } = useApp()
  const stepMeta = STEPS[state.step - 1]

  return (
    <header className="sticky top-0 z-40 border-b border-emerald-200 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-wide text-slate-800">
            Intelli<span className="text-emerald-600 text-glow-emerald">Press</span>
          </span>
          <span className="hidden text-[10px] text-slate-500 md:inline">多智能体协同 · 高血压居家管理全流程</span>
        </div>

        <div className="flex items-center gap-2 font-mono-data text-xs">
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-600">
            阶段 {state.step}/6 · {stepMeta.name}
          </span>
          <span className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-600">
            <span className="status-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            在线
          </span>
          <span className="rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-600">{state.caseId}</span>
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-600" title="监护时钟">
            监护 {fmtSimTime(state.simMin)}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 font-mono-data text-xs">
          <button
            onClick={() => dispatch({ type: "TOGGLE_PROVENANCE" })}
            className={`rounded border px-2 py-1 transition ${
              state.provenanceOn
                ? "border-violet-300 bg-violet-100 text-violet-700"
                : "border-slate-300 bg-white text-slate-500 hover:text-slate-700"
            }`}
          >
            指标溯源
          </button>
          <button
            onClick={() => dispatch({ type: "TOGGLE_DRAWER" })}
            className={`rounded border px-2 py-1 transition ${
              state.drawerOpen
                ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                : "border-slate-300 bg-white text-slate-500 hover:text-slate-700"
            }`}
          >
            数据明细
          </button>
          <button
            onClick={() => dispatch({ type: "BACK_TO_SETUP" })}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-500 transition hover:border-red-200 hover:text-red-600"
          >
            返回病例设置
          </button>
          <label className="hidden items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-slate-500 lg:flex" title="背景亮度">
            <span className="text-[10px]">亮度</span>
            <BrightnessSlider />
          </label>
        </div>
      </div>
    </header>
  )
}

function BrightnessSlider() {
  const [v, setV] = useState(getBrightness())
  return (
    <input
      type="range"
      min={0.2}
      max={1}
      step={0.05}
      value={v}
      onChange={(e) => {
        const nv = parseFloat(e.target.value)
        setV(nv)
        setBrightness(nv)
      }}
      className="h-1 w-16 cursor-pointer accent-emerald-400"
    />
  )
}
