// 可变生命体征存储：three.js 渲染循环每帧读取，避免 60fps 触发 React 重渲染
export const vitals = {
  sbp: 122,
  dbp: 78,
  alertLevel: 0, // 0 无 / 4 / 3 / 2 / 1
  twinLit: false, // 孪生体点亮（第 3 阶段起）
  monitoring: false, // 第 5 阶段加强脉动
  twinForecast: -1, // 第 3 阶段孪生推演：-1 关闭；0..1 推演进度（红→绿）
  beatPhase: 0,
}

// 背景亮度（0.2 - 1.0），localStorage 记忆
const KEY = "intellipress_bg_brightness"
export function getBrightness(): number {
  const v = parseFloat(localStorage.getItem(KEY) || "")
  return Number.isFinite(v) && v > 0 ? Math.min(1, Math.max(0.2, v)) : 0.75
}
export function setBrightness(v: number) {
  localStorage.setItem(KEY, String(v))
}
