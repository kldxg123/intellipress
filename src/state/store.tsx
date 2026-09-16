import { createContext, useContext, useReducer, type ReactNode } from "react"
import type { CaseId, IncidentId } from "@/lib/data"

export type Phase = "gate" | "setup" | "demo"

export interface AppState {
  phase: Phase
  caseId: CaseId
  incident: IncidentId
  step: number // 1..7
  doneSteps: boolean[] // index 0..6
  simMin: number // 监护时钟（仿真分钟），起点 05:00 = 300
  simRunning: boolean
  provenanceOn: boolean
  drawerOpen: boolean
}

const initialState: AppState = {
  phase: "gate",
  caseId: "P-001",
  incident: "none",
  step: 1,
  doneSteps: [false, false, false, false, false, false],
  simMin: 300,
  simRunning: false,
  provenanceOn: false,
  drawerOpen: false,
}

export type Action =
  | { type: "AUTH_OK" }
  | { type: "START_DEMO"; caseId: CaseId; incident: IncidentId }
  | { type: "COMPLETE_STEP"; step: number }
  | { type: "GOTO_STEP"; step: number }
  | { type: "TICK"; dMin: number }
  | { type: "SET_SIM_RUNNING"; on: boolean }
  | { type: "SET_SIM_MIN"; min: number }
  | { type: "TOGGLE_PROVENANCE" }
  | { type: "TOGGLE_DRAWER" }
  | { type: "BACK_TO_SETUP" }
  | { type: "RESET_ALL" }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "AUTH_OK":
      return { ...s, phase: "setup" }
    case "START_DEMO":
      return {
        ...s,
        phase: "demo",
        caseId: a.caseId,
        incident: a.incident,
        step: 1,
        doneSteps: [false, false, false, false, false, false],
        simMin: 300,
        simRunning: true,
        provenanceOn: false,
        drawerOpen: false,
      }
    case "COMPLETE_STEP": {
      const done = s.doneSteps.slice()
      done[a.step - 1] = true
      return { ...s, doneSteps: done }
    }
    case "GOTO_STEP":
      return { ...s, step: a.step, drawerOpen: false }
    case "TICK": {
      if (!s.simRunning) return s
      const next = s.simMin + a.dMin
      // 第 5 阶段（居家监护）：时钟在 24:00 停止推进（不再跨日回绕）；其余阶段按日循环
      return { ...s, simMin: s.step === 5 ? Math.min(1440, next) : next % 1440 }
    }
    case "SET_SIM_RUNNING":
      return { ...s, simRunning: a.on }
    case "SET_SIM_MIN":
      return { ...s, simMin: a.min }
    case "TOGGLE_PROVENANCE":
      return { ...s, provenanceOn: !s.provenanceOn }
    case "TOGGLE_DRAWER":
      return { ...s, drawerOpen: !s.drawerOpen }
    case "BACK_TO_SETUP":
      return { ...s, phase: "setup", simRunning: false, drawerOpen: false, provenanceOn: false }
    case "RESET_ALL":
      return { ...initialState, phase: "setup" }
    default:
      return s
  }
}

const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useApp must be used within AppProvider")
  return v
}
