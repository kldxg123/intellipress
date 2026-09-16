// 跨组件运行时（可变）：异常注入窗口与当前告警级别
// 由第 6 步写入，SimDriver / TwinBackground 读取
import type { IncidentWindow } from "./bpSim"

export const runtime = {
  incident: null as IncidentWindow | null,
  alertLevel: 0 as 0 | 1 | 2 | 3 | 4,
}

export function resetRuntime() {
  runtime.incident = null
  runtime.alertLevel = 0
}
