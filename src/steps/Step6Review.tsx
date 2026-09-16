import { useEffect, useRef, useState } from "react"
import { useApp } from "@/state/store"
import { Prov } from "@/components/Prov"
import { StatusTag } from "@/components/StepCommon"

function useCountUp(target: number, duration: number, delay = 0): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    let start = 0
    const loop = (t: number) => {
      if (!start) start = t
      const p = Math.min(1, (t - start - delay) / duration)
      setV(target * Math.max(0, p))
      if (p < 1) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, delay])
  return v
}

// 第 6 阶段 · 复盘迭代：当日复盘 → 奖励计算 → 医师边界内参数更新 → 联邦学习
export function Step6Review({ onDone }: { onDone: () => void }) {
  const { dispatch } = useApp()
  const execRate = useCountUp(91.7, 1800)
  const ttr = useCountUp(14.2, 1800, 300)
  const reward = useCountUp(0.842, 2200, 600)
  const updatePct = useCountUp(10, 2000, 1200)
  const doneRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusTag color="emerald">复盘分析 · 医师在环</StatusTag>
        <span className="font-mono-data text-xs text-slate-500">当日复盘 → 奖励计算 → 医师边界内参数更新（≤10%）</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5 text-center">
          <div className="font-mono-data text-[10px] tracking-widest text-slate-500">干预执行率</div>
          <Prov value={execRate.toFixed(1) + "%"} src="measured" className="mt-2 block text-3xl font-bold text-emerald-600 text-glow-emerald" />
          <div className="mt-1 font-mono-data text-[10px] text-slate-500">任务完成 11/12 · 漏服 0 次</div>
        </div>
        <div className="panel p-5 text-center">
          <div className="font-mono-data text-[10px] tracking-widest text-slate-500">血压达标时长 TTR</div>
          <Prov value={ttr.toFixed(1) + "h / 24h"} src="twin" className="mt-2 block text-3xl font-bold text-violet-600" />
          <div className="mt-1 font-mono-data text-[10px] text-slate-500">达标阈值 &lt;140/90 · 规则</div>
        </div>
        <div className="panel p-5 text-center">
          <div className="font-mono-data text-[10px] tracking-widest text-slate-500">当日奖励 REWARD</div>
          <Prov value={reward.toFixed(3)} src="model" conf={90} className="mt-2 block text-3xl font-bold text-emerald-600" />
          <div className="mt-1 font-mono-data text-[10px] text-slate-500">r = 达标奖励 + 依从奖励 - 风险惩罚</div>
        </div>
      </div>

      {/* 参数更新进度条：封顶 10% */}
      <div className="panel mt-4 p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono-data text-[11px] tracking-widest text-slate-500">干预参数自动更新（医师设定边界内）</span>
          <span className="font-mono-data text-xs text-emerald-600">{updatePct.toFixed(1)}% / 上限 10%</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-500"
            style={{ width: `${updatePct * 10}%`, boxShadow: "none" }}
          />
          {/* 10% 封顶线 */}
          <div className="absolute inset-y-0 left-[10%] w-0.5 bg-amber-400" style={{ boxShadow: "none" }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 font-mono-data text-[10px] text-slate-500">
          <span>提醒时点偏移 +2.3%</span>
          <span>限盐阈值微调 +1.1%</span>
          <span>运动强度建议 +3.4%</span>
          <span className="text-amber-600">▲ 封顶 10% · 超出边界需医师审批</span>
        </div>
        <p className="mt-3 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">
          所有参数更新均限制在<span className="text-amber-600">医师设定的安全边界（≤10%）</span>内自动完成；
          任何超出边界的调整（如用药剂量变更）都会生成审批工单，<span className="text-slate-700">由医师确认后才生效</span>。
        </p>
      </div>

      {/* 联邦学习 */}
      <div className="panel mt-4 p-5">
        <div className="mb-1 font-mono-data text-[11px] tracking-widest text-slate-500">联邦学习 · 多中心协同迭代</div>
        <p className="text-xs leading-relaxed text-slate-500">
          本机经验加密梯度上传至联邦聚合节点，与 <Prov value="3 家合作机构" src="rule" className="text-emerald-600" /> 的经验汇总成全局模型后再下发——
          <span className="text-emerald-600">原始数据不出域</span>，隐私分级保护。
        </p>
        <div className="mt-3 flex items-center gap-3 font-mono-data text-[10px] text-slate-500">
          <span className="rounded border border-slate-300 px-2 py-1">本院节点 ✓</span>
          <span className="text-slate-400">⇄</span>
          <span className="rounded border border-slate-300 px-2 py-1">联邦聚合（梯度 only）</span>
          <span className="text-slate-400">⇄</span>
          <span className="rounded border border-slate-300 px-2 py-1">协作机构 ×3</span>
          <span className="ml-auto text-emerald-600">本轮聚合增益 +0.6% 分层准确率</span>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          onClick={() => dispatch({ type: "BACK_TO_SETUP" })}
          className="rounded-lg border border-emerald-500 bg-emerald-50 px-12 py-3 font-mono-data text-sm tracking-[0.2em] text-emerald-700 transition hover:bg-emerald-100 hover:text-glow-emerald"
        >
          ↻ 返回病例设置 · 再演示一次
        </button>
      </div>
    </div>
  )
}
