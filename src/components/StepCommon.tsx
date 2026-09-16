import type { ReactNode } from "react"

// 阶段标题：第 N 阶段 · 阶段名 · 副标题
export function StepHeader({ n, name, sub }: { n: number; name: string; sub: string }) {
  return (
    <div className="mb-5 fade-up">
      <div className="font-mono-data text-[11px] tracking-[0.3em] text-emerald-600">阶段 {n}/6</div>
      <h2 className="mt-1 text-2xl font-semibold text-slate-800">
        第 {n} 阶段 · {name} <span className="ml-2 text-sm font-normal text-slate-500">{sub}</span>
      </h2>
    </div>
  )
}

// 运行状态标签：纯中文临床状态词（采集中 / 评估中 / 监护值守中 …）
export function StatusTag({ children, color = "emerald" }: { children: ReactNode; color?: "emerald" | "violet" | "amber" | "teal" }) {
  const map = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-600",
    teal: "border-teal-200 bg-teal-50 text-teal-600",
    violet: "border-violet-200 bg-violet-50 text-violet-600",
    amber: "border-amber-200 bg-amber-50 text-amber-600",
  }
  return <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono-data text-[10px] ${map[color]}`}>{children}</span>
}
