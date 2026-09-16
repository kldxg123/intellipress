import { useEffect, useMemo, useRef, useState } from "react"
import { useApp } from "@/state/store"
import { CASES } from "@/lib/data"
import { generatePlan } from "@/lib/planEngine"
import { Prov } from "@/components/Prov"
import { StatusTag } from "@/components/StepCommon"

// 第 4 阶段 · 个性方案：五维度分区卡片，内容由 planEngine 规则引擎按病例参数确定性生成
export function Step4Plan({ onDone }: { onDone: () => void }) {
  const { state } = useApp()
  const caseDef = CASES.find((c) => c.id === state.caseId)!
  const plan = useMemo(() => generatePlan(caseDef.id), [caseDef.id])
  const [visible, setVisible] = useState(0)
  const doneRef = useRef(false)

  useEffect(() => {
    const timers = plan.sections.map((_, i) => setTimeout(() => setVisible(i + 1), 500 + i * 900))
    timers.push(
      setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true
          onDone()
        }
      }, 500 + plan.sections.length * 900 + 800),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone, caseDef.id])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusTag color="amber">方案生成 · 分层匹配</StatusTag>
        <span className="font-mono-data text-xs text-slate-500">
          方案由临床路径规则引擎按分层结论生成 · <Prov value={`${caseDef.risk} · ${caseDef.grade}`} src="rule" className="text-amber-600" />
        </span>
        <span className="ml-auto font-mono-data text-[10px] text-amber-600">全部方案经医师审核模板 v3.2 兜底 · 不直接触达患者</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {plan.sections.slice(0, visible).map((sec, idx) => (
          <div
            key={sec.key}
            className={`panel relative overflow-hidden p-5 fade-up ${idx === plan.sections.length - 1 && plan.sections.length % 2 === 1 ? "md:col-span-2" : ""}`}
          >
            <div className="absolute right-0 top-0 rounded-bl-lg border-b border-l border-amber-200 bg-amber-50 px-2 py-1 font-mono-data text-[9px] text-amber-600">
              医师审核模板 v3.2 兜底
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{sec.icon}</span>
              <span className="text-sm font-semibold text-slate-800">{sec.title}</span>
              <span
                className="ml-auto rounded px-1.5 py-0.5 font-mono-data text-[9px]"
                style={{ color: "#b45309", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)" }}
              >
                来源：规则
              </span>
            </div>
            <ul className="mt-2.5 space-y-1.5">
              {sec.items.map((it, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-600">
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                  <span>
                    {it.text}
                    {it.clause && (
                      <span className="ml-1.5 whitespace-nowrap rounded border border-amber-200 bg-amber-50 px-1 py-px font-mono-data text-[9px] text-amber-600">
                        {it.clause}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 font-mono-data text-[10px] text-slate-500">依据：{sec.metric}</div>
          </div>
        ))}
      </div>

      {visible >= plan.sections.length && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono-data text-[11px] text-slate-500 fade-up">
          处方已锁定 · 达标线 <Prov value={plan.targetBP} src="rule" className="text-emerald-600" /> mmHg · 复诊节点{" "}
          <Prov value={plan.reviewNode} src="rule" className="text-emerald-600" /> · 待编排中枢拆解为可执行任务流 →
        </div>
      )}
    </div>
  )
}
