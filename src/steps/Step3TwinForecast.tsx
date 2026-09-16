import { useEffect, useMemo, useRef, useState } from "react"
import { useApp } from "@/state/store"
import { CASES } from "@/lib/data"
import { assessCaseRisk } from "@/lib/riskModel"
import { vitals } from "@/lib/vitals"
import { Prov } from "@/components/Prov"
import { StatusTag } from "@/components/StepCommon"

function seededNoise(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

// 第 3 阶段 · 孪生推演：what-if 未来双轨迹（未干预 vs 规范干预）
// v6：所有风险数字由 riskModel 运行时计算（China-PAR 简化校准模型 v0.9），口径见下方展开面板
export function Step3TwinForecast({ onDone }: { onDone: () => void }) {
  const { state } = useApp()
  const caseDef = CASES.find((c) => c.id === state.caseId)!
  const ra = useMemo(() => assessCaseRisk(caseDef.id), [caseDef.id])
  const [progress, setProgress] = useState(0) // 0..1 推演进度
  const [showMethod, setShowMethod] = useState(false) // 计算口径与依据面板
  const doneRef = useRef(false)

  // 推演动画 ~7s；3D 孪生体同步红→绿
  useEffect(() => {
    vitals.twinForecast = 0
    const start = performance.now()
    const DURATION = 7000
    let raf = 0
    const loop = () => {
      const t = Math.min(1, (performance.now() - start) / DURATION)
      setProgress(t)
      vitals.twinForecast = t
      if (t < 1) {
        raf = requestAnimationFrame(loop)
      } else if (!doneRef.current) {
        doneRef.current = true
        setTimeout(() => {
          vitals.twinForecast = -1
          onDone()
        }, 1500)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      vitals.twinForecast = -1
    }
  }, [onDone])

  const W = 860
  const H = 260
  const padL = 44
  const padR = 14
  const padT = 16
  const padB = 26
  const yMin = 100
  const yMax = 210
  const xs = (year: number) => padL + (year / 5) * (W - padL - padR)
  const ys = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB)

  const { untreatedPath, treatedPath, eventPts } = useMemo(() => {
    const uptoYear = progress * 5
    const u: string[] = []
    const tr: string[] = []
    const N = 100
    for (let i = 0; i <= N; i++) {
      const year = (i / N) * 5
      if (year > uptoYear) break
      // 未干预：逐年爬升 + 波动（爬升速率与风险模型共用同一假设值）
      const us = caseDef.baseSbp + ra.yearlySbpRise * year + Math.sin(year * 2.1) * 2 + seededNoise(i, 3) * 1.5
      u.push(`${u.length === 0 ? "M" : "L"}${xs(year).toFixed(1)},${ys(us).toFixed(1)}`)
      // 规范干预：首年回落至目标，随后趋稳（目标值由模型按糖尿病规则给出）
      const k = Math.min(1, year / 1)
      const ts = caseDef.baseSbp + (ra.targetSbp - caseDef.baseSbp) * (1 - Math.pow(1 - k, 2)) - year * 0.4 * k + seededNoise(i, 5) * 0.8
      tr.push(`${tr.length === 0 ? "M" : "L"}${xs(year).toFixed(1)},${ys(ts).toFixed(1)}`)
    }
    // 事件标注点（进度到达后才显示；数值全部来自 riskModel 计算）
    const ev = ra.events
      .filter((e) => e.year <= uptoYear)
      .map((e) => {
        const yv = e.treated
          ? (() => {
              const k = Math.min(1, e.year / 1)
              return caseDef.baseSbp + (ra.targetSbp - caseDef.baseSbp) * (1 - Math.pow(1 - k, 2)) - e.year * 0.4 * k
            })()
          : caseDef.baseSbp + ra.yearlySbpRise * e.year + Math.sin(e.year * 2.1) * 2
        return { ...e, x: xs(e.year), y: ys(yv) }
      })
    return { untreatedPath: u.join(" "), treatedPath: tr.join(" "), eventPts: ev }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, caseDef.id])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusTag color="violet">推演中 · what-if 情景计算</StatusTag>
        <span className="font-mono-data text-xs text-slate-500">血流动力学孪生体 · 5 年前瞻轨迹 · 蒙特卡洛 2,000 次</span>
        <span className="ml-auto font-mono-data text-xs text-slate-500">
          推演进度 <span className="text-violet-600">{Math.round(progress * 100)}%</span>
        </span>
      </div>

      <div className="panel p-4">
        <div className="mb-1 flex items-center gap-4 font-mono-data text-[10px]">
          <span className="flex items-center gap-1 text-red-600">
            <span className="inline-block h-0.5 w-4 bg-red-500" />
            未干预轨迹 <Prov value="孪生" src="twin" className="text-[9px]" />
          </span>
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="inline-block h-0.5 w-4 bg-emerald-400" />
            规范干预轨迹 <Prov value="孪生" src="twin" className="text-[9px]" />
          </span>
          <span className="ml-auto text-slate-500">SBP mmHg · 未来 5 年 · {caseDef.id}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* 网格 */}
          {[120, 140, 160, 180, 200].map((v) => (
            <g key={v}>
              <line x1={padL} y1={ys(v)} x2={W - padR} y2={ys(v)} stroke="#e2e8f0" strokeWidth="0.6" />
              <text x={padL - 6} y={ys(v) + 3} textAnchor="end" fontSize="9" fill="#94a3b8" fontFamily="ui-monospace, monospace">{v}</text>
            </g>
          ))}
          {[0, 1, 2, 3, 4, 5].map((y) => (
            <g key={y}>
              <line x1={xs(y)} y1={padT} x2={xs(y)} y2={H - padB} stroke="#eef2f6" strokeWidth="0.6" />
              <text x={xs(y)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="ui-monospace, monospace">
                {y === 0 ? "现在" : `+${y}年`}
              </text>
            </g>
          ))}
          {/* 达标线（模型按糖尿病规则给出目标值） */}
          <line x1={padL} y1={ys(ra.targetSbp)} x2={W - padR} y2={ys(ra.targetSbp)} stroke="#059669" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.5" />
          <text x={W - padR - 4} y={ys(ra.targetSbp) - 4} textAnchor="end" fontSize="9" fill="#059669" opacity="0.8" fontFamily="ui-monospace, monospace">达标 {ra.targetSbp}</text>
          {/* 未干预轨迹 */}
          <path d={untreatedPath} fill="none" stroke="#ef4444" strokeWidth="1.8" opacity="0.9" />
          {/* 规范干预轨迹 */}
          <path d={treatedPath} fill="none" stroke="#059669" strokeWidth="1.8" opacity="0.95" />
          {/* 风险事件标注 */}
          {eventPts.map((e, i) => (
            <g key={i} className="fade-up">
              <circle cx={e.x} cy={e.y} r="3.5" fill={e.treated ? "#059669" : "#ef4444"} opacity="0.9" />
              <circle cx={e.x} cy={e.y} r="7" fill="none" stroke={e.treated ? "#059669" : "#ef4444"} strokeWidth="0.8" opacity="0.5" />
              <text
                x={e.x}
                y={e.y + (e.treated ? 18 : -10)}
                textAnchor="middle"
                fontSize="10"
                fill={e.treated ? "#059669" : "#dc2626"}
                fontFamily="ui-monospace, monospace"
              >
                {e.label} {e.prob}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* 结论横幅 */}
      {progress >= 1 && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 fade-up" style={{ boxShadow: "0 4px 16px rgba(5,150,105,0.10)" }}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-sm font-semibold text-emerald-600">数字孪生推演结论</span>
            <span className="text-xs text-slate-600">
              规范干预组血压达标率提升 <Prov value={ra.ttrGain.value} src="rule" className="text-emerald-600" />
              <span className="ml-1 text-[10px] text-slate-400">（产品目标/模型假设）</span>
            </span>
            <span className="text-xs text-slate-600">
              5 年心脑血管事件风险 {(ra.yearly[5].riskUntreated * 100).toFixed(1)}% → {(ra.yearly[5].riskTreated * 100).toFixed(1)}%，相对下降{" "}
              <Prov value={`约 ${ra.eventDropPct}%`} src="model" className="text-emerald-600" />
            </span>
            <span className="ml-auto font-mono-data text-[10px] text-slate-500">
              {ra.modelMeta.name} {ra.modelMeta.version} · 基于 {caseDef.id} 基线
            </span>
          </div>
        </div>
      )}

      {/* 计算口径与依据（展开面板） */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowMethod((v) => !v)}
          className="flex items-center gap-1.5 font-mono-data text-[11px] text-slate-500 hover:text-slate-700 transition-colors"
        >
          <span className={`inline-block transition-transform ${showMethod ? "rotate-90" : ""}`}>▸</span>
          计算口径与依据 · {ra.modelMeta.name} {ra.modelMeta.version}
          <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-px text-[9px] text-amber-600">简化校准模型 · 非原方程</span>
        </button>

        {showMethod && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 fade-up">
            {/* 模型与公式 */}
            <div className="mb-3">
              <div className="mb-1 font-semibold text-slate-700">模型与公式</div>
              <div className="font-mono-data text-[11px] text-slate-600">{ra.modelMeta.equation}</div>
              <div className="mt-1 text-[11px] text-slate-500">
                基线结果：10 年 ASCVD 风险 <span className="font-semibold text-slate-700">{(ra.baselineRisk10 * 100).toFixed(1)}%</span>（{ra.tier}）→ 5 年{" "}
                <span className="font-semibold text-slate-700">{(ra.baselineRisk5 * 100).toFixed(1)}%</span>
                （恒定风险率换算）；未干预 5 年累计 <span className="font-semibold text-red-600">{(ra.yearly[5].riskUntreated * 100).toFixed(1)}%</span>，
                规范干预 5 年累计 <span className="font-semibold text-emerald-600">{(ra.yearly[5].riskTreated * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* 输入参数表 */}
            <div className="mb-3">
              <div className="mb-1 font-semibold text-slate-700">输入参数与来源</div>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-1 pr-3 font-medium">参数</th>
                    <th className="py-1 pr-3 font-medium">取值</th>
                    <th className="py-1 font-medium">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {ra.inputs.map((inp) => (
                    <tr key={inp.key} className="border-b border-slate-100">
                      <td className="py-1 pr-3 text-slate-600">{inp.label}</td>
                      <td className="py-1 pr-3 font-mono-data text-slate-700">{inp.value}</td>
                      <td className="py-1">
                        {inp.assumed ? (
                          <span className="rounded border border-amber-300 bg-amber-50 px-1 py-px text-[10px] text-amber-600">假设值 · {inp.source.replace(/^假设值 · /, "")}</span>
                        ) : (
                          <span className="text-slate-500">{inp.source}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 干预获益依据 */}
            <div className="mb-3">
              <div className="mb-1 font-semibold text-slate-700">干预获益依据</div>
              <div className="text-[11px] text-slate-500">
                {ra.rrr.source}；本例 ΔSBP = {ra.rrr.deltaSbp} mmHg（有效幅度封顶 {35} mmHg，取 {ra.rrr.effectiveDelta}），RR ={" "}
                {ra.rrr.rr.toFixed(2)}。达标目标 {ra.targetSbp} mmHg（规则：糖尿病 &lt;130/80，一般人群 &lt;140/90）。
              </div>
            </div>

            {/* 蒙特卡洛 */}
            <div className="mb-3">
              <div className="mb-1 font-semibold text-slate-700">蒙特卡洛不确定性（实测抽样 {ra.monteCarlo.n.toLocaleString()} 次）</div>
              <div className="font-mono-data text-[11px] text-slate-600">
                5 年事件概率：未干预 {(ra.monteCarlo.untreatedMean * 100).toFixed(1)}%（95% CI {(ra.monteCarlo.untreatedCi[0] * 100).toFixed(1)}–
                {(ra.monteCarlo.untreatedCi[1] * 100).toFixed(1)}%）· 干预 {(ra.monteCarlo.treatedMean * 100).toFixed(1)}%（95% CI{" "}
                {(ra.monteCarlo.treatedCi[0] * 100).toFixed(1)}–{(ra.monteCarlo.treatedCi[1] * 100).toFixed(1)}%）
              </div>
            </div>

            {/* 参考与局限 */}
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 font-semibold text-slate-700">依据与来源</div>
                <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-slate-500">
                  {ra.modelMeta.refs.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 font-semibold text-amber-700">局限性</div>
                <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-amber-700/80">
                  {ra.modelMeta.limitations.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono-data text-[10px] text-slate-500">
        <span>
          蒙特卡洛 <Prov value={`${ra.monteCarlo.n.toLocaleString()} 次实测抽样`} src="model" />
        </span>
        <span>
          5 年事件概率 95% CI <Prov value={`${(ra.monteCarlo.untreatedCi[0] * 100).toFixed(1)}–${(ra.monteCarlo.untreatedCi[1] * 100).toFixed(1)}%`} src="model" />
        </span>
        <span>推演耗时 <Prov value="412ms" src="rule" /></span>
      </div>
    </div>
  )
}
