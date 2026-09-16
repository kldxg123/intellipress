import { useApp } from "@/state/store"
import { STEPS } from "@/lib/data"

// 诊疗路径：左侧纵向侧栏（lg+）；窄屏回退为顶部横排
export function PathRail() {
  const { state } = useApp()

  const nodeState = (i: number): "done" | "active" | "pending" =>
    state.doneSteps[i] ? "done" : state.step === i + 1 ? "active" : "pending"

  const colors = {
    done: { dot: "#059669", text: "#334155", ring: "border-emerald-500" },
    active: { dot: "#d97706", text: "#b45309", ring: "border-amber-500" },
    pending: { dot: "#cbd5e1", text: "#94a3b8", ring: "border-slate-300" },
  } as const

  return (
    <>
      {/* 桌面：左侧纵向侧栏 */}
      <aside className="fixed bottom-0 left-0 top-[41px] z-30 hidden w-[208px] flex-col border-r border-emerald-200 bg-white/85 px-4 py-5 backdrop-blur-md lg:flex">
        <div className="mb-4 font-mono-data text-[10px] tracking-[0.3em] text-emerald-400/70">诊疗路径</div>
        <nav className="relative flex-1">
          {/* 纵向连接线 */}
          <div className="absolute bottom-6 left-[11px] top-3 w-px bg-gradient-to-b from-emerald-400/60 via-emerald-200/50 to-slate-200" />
          <ul className="relative space-y-4">
            {STEPS.map((s, i) => {
              const st = nodeState(i)
              const c = colors[st]
              return (
                <li key={s.n} className="flex items-start gap-3">
                  <span className="relative mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center">
                    {st === "active" && (
                      <span className="ring-pulse absolute inset-0 rounded-full border border-amber-500" />
                    )}
                    <span
                      className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border font-mono-data text-[10px] font-bold ${c.ring}`}
                      style={{
                        color: c.dot,
                        background: st === "done" ? "rgba(52,211,153,0.14)" : st === "active" ? "rgba(245,158,11,0.14)" : "#f1f5f9",
                        boxShadow: st === "active" ? "0 0 10px rgba(245,158,11,0.35)" : st === "done" ? "0 0 8px rgba(52,211,153,0.25)" : "none",
                      }}
                    >
                      {st === "done" ? "✓" : s.n}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium leading-tight" style={{ color: c.text }}>
                      {s.name}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-400">{s.sub}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        </nav>
        {/* AI 推理引擎徽标 */}
        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-center" style={{ background: "rgba(124,58,237,0.06)" }}>
          <div className="text-[12px] text-violet-600">AI 推理引擎</div>
          <div className="mt-0.5 font-mono-data text-[10px] text-violet-500">DeepSeek · 指南增强</div>
        </div>
        <div className="mt-3 text-center font-mono-data text-[9px] tracking-widest text-slate-400">
          全流程闭环 · 医师在环
        </div>
      </aside>

      {/* 窄屏：顶部横排回退 */}
      <div className="panel mx-auto flex w-full max-w-[1200px] items-center gap-1.5 overflow-x-auto px-3 py-2 lg:hidden">
        {STEPS.map((s, i) => {
          const st = nodeState(i)
          const c = colors[st]
          return (
            <div key={s.n} className="flex shrink-0 items-center gap-1.5">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border font-mono-data text-[9px] font-bold ${c.ring}`}
                style={{ color: c.dot, background: st === "done" ? "rgba(52,211,153,0.14)" : st === "active" ? "rgba(245,158,11,0.14)" : "#f1f5f9" }}
              >
                {st === "done" ? "✓" : s.n}
              </span>
              <span className="whitespace-nowrap text-[11px]" style={{ color: c.text }}>{s.name}</span>
              {i < 6 && <span className="text-slate-400">›</span>}
            </div>
          )
        })}
      </div>
    </>
  )
}
