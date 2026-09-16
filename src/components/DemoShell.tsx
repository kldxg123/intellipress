import { useCallback, useEffect } from "react"
import { useApp } from "@/state/store"
import { CASES, STEPS, SIM_MIN_PER_SEC } from "@/lib/data"
import { measuredBP } from "@/lib/bpSim"
import { runtime, resetRuntime } from "@/lib/runtime"
import { vitals } from "@/lib/vitals"
import { TopBar } from "@/components/TopBar"
import { PathRail } from "@/components/PathRail"
import { DetailDrawer } from "@/components/DetailDrawer"
import { StepHeader } from "@/components/StepCommon"
import { Step1Intake } from "@/steps/Step1Intake"
import { Step2Screening } from "@/steps/Step2Screening"
import { Step3TwinForecast } from "@/steps/Step3TwinForecast"
import { Step4Plan } from "@/steps/Step4Plan"
import { Step5HomeExecution } from "@/steps/Step5HomeExecution"
import { Step6Review } from "@/steps/Step6Review"

const STEP_COMPONENTS = [Step1Intake, Step2Screening, Step3TwinForecast, Step4Plan, Step5HomeExecution, Step6Review]

export function DemoShell() {
  const { state, dispatch } = useApp()
  const caseDef = CASES.find((c) => c.id === state.caseId)!
  const curDone = state.doneSteps[state.step - 1]
  const meta = STEPS[state.step - 1]
  const StepComp = STEP_COMPONENTS[state.step - 1]

  // 监护时钟驱动：250ms 一拍，固定 SIM_MIN_PER_SEC 仿真分钟/秒；第 5 阶段 2 倍速率压缩（06:00→24:00 约 54s）
  // 同步 vitals 给 three.js
  useEffect(() => {
    const timer = setInterval(() => {
      dispatch({ type: "TICK", dMin: SIM_MIN_PER_SEC * 0.25 * (state.step === 5 ? 2 : 1) })
      const bp = measuredBP(caseDef, state.simMin, runtime.incident)
      vitals.sbp = bp.sbp
      vitals.dbp = bp.dbp
      vitals.alertLevel = runtime.alertLevel
      vitals.twinLit = state.step >= 3
      vitals.monitoring = state.step === 5 && state.simRunning
    }, 250)
    return () => clearInterval(timer)
  }, [state.simMin, state.step, state.simRunning, caseDef, dispatch])

  // 进入新阶段时重置运行时异常状态与推演状态；进入第 5 阶段时监护时钟回到早晨 06:00（24h 血压日从早晨开始演示）
  useEffect(() => {
    if (state.step !== 5) resetRuntime()
    else dispatch({ type: "SET_SIM_MIN", min: 360 })
    if (state.step !== 3) vitals.twinForecast = -1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step])

  // 键盘快捷键：S 溯源 / D 明细（界面不宣传）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "s" || e.key === "S") dispatch({ type: "TOGGLE_PROVENANCE" })
      if (e.key === "d" || e.key === "D") dispatch({ type: "TOGGLE_DRAWER" })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dispatch])

  const onStepDone = useCallback(() => {
    dispatch({ type: "COMPLETE_STEP", step: state.step })
  }, [dispatch, state.step])

  const next = STEPS[state.step] // 下一阶段 meta（step 为 7 时 undefined）

  return (
    <div className="relative z-10 min-h-screen">
      <TopBar />
      <PathRail />
      <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 pb-24 lg:ml-[208px] lg:max-w-[calc(1400px-208px)]">
        <section className="panel panel-glow p-6" key={state.step}>
          <StepHeader n={meta.n} name={meta.name} sub={meta.sub} />
          <StepComp onDone={onStepDone} />

          {curDone && (
            <div className="mt-6 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 fade-up">
              <span className="flex items-center gap-2 font-mono-data text-xs text-emerald-600">
                <span className="status-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                本阶段演示完成
              </span>
              {next ? (
                <button
                  onClick={() => dispatch({ type: "GOTO_STEP", step: state.step + 1 })}
                  className="rounded-md border border-emerald-500 bg-emerald-50 px-5 py-2 font-mono-data text-sm text-emerald-700 transition hover:bg-emerald-100 hover:text-glow-emerald"
                >
                  下一阶段 · 第 {next.n} 阶段 {next.name} →
                </button>
              ) : (
                <button
                  onClick={() => dispatch({ type: "BACK_TO_SETUP" })}
                  className="rounded-md border border-emerald-500 bg-emerald-50 px-5 py-2 font-mono-data text-sm text-emerald-700 transition hover:bg-emerald-100"
                >
                  ↻ 返回病例设置
                </button>
              )}
            </div>
          )}
        </section>
      </main>
      <DetailDrawer />
    </div>
  )
}
