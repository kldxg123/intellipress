import { gradeBP } from './guidelines'
export interface BPReading { sbp: number; dbp: number }
/** Same-setting repeated readings only. This summarizes measurements, not a diagnosis. */
export function summarizeRepeatedBP(readings: readonly BPReading[]) {
  if (readings.length < 2) throw new RangeError('至少需要两次同场景有效测量')
  for (const r of readings) {
    if (!Number.isFinite(r.sbp) || !Number.isFinite(r.dbp) || r.sbp <= 0 || r.dbp <= 0 || r.sbp <= r.dbp) {
      throw new RangeError('测量需为有限正数，且收缩压高于舒张压')
    }
  }
  const mean = {
    sbp: readings.reduce((s, r) => s + r.sbp, 0) / readings.length,
    dbp: readings.reduce((s, r) => s + r.dbp, 0) / readings.length,
  }
  const grades = readings.map(r => gradeBP(r.sbp, r.dbp))
  return {
    count: readings.length, mean, grade: gradeBP(mean.sbp, mean.dbp),
    thresholdDisagreement: new Set(grades.map(g => g.level >= 1)).size > 1,
    peak: { sbp: Math.max(...readings.map(r => r.sbp)), dbp: Math.max(...readings.map(r => r.dbp)) },
    interpretation: '同场景重复测量汇总；跨阈值时提示复测；不能据此单独确诊高血压',
  }
}
