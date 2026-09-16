import { useEffect, useRef, useState } from "react"
import { useApp } from "@/state/store"
import { CASES, type CaseDef } from "@/lib/data"
import { Prov } from "@/components/Prov"
import { StatusTag } from "@/components/StepCommon"

// 非结构化病历原文（按病例）
const RECORDS: Record<string, string> = {
  "P-001": "患者男，58岁。发现血压升高 8 年，诊室最高 178/102mmHg，动态血压晨峰最高 186/112mmHg，晨起血压偏高明显。既往 2 型糖尿病史 5 年，空腹血糖 8.9mmol/L。现口服氨氯地平 5mg qd，自行间断服药。尿微量白蛋白 86mg/L。吸烟 20 年。",
  "D-01": "患者女，65岁。诊室血压 156/94mmHg，自诉家中自测正常。动态血压提示夜间血压下降不足，呈非杓型节律。检验：血钾 4.1mmol/L，肌酐 78μmol/L。未规律服药。",
  "D-02": "患者男，42岁。体检发现血压 148/92mmHg，诊室复测 151/95mmHg，家庭自测 132/84mmHg，考虑白大衣效应。BMI 29.4，腰围 102cm。平素作息不规律，未服药。",
}

interface Field {
  label: string
  value: string
  kind: "诊断" | "用药" | "指标" | "检验" | "生活"
  span: string // 病历原文中被高亮的片段
}

const FIELDS: Record<string, Field[]> = {
  "P-001": [
    { label: "主要诊断", value: "高血压3级（很高危）", kind: "诊断", span: "血压升高 8 年" },
    { label: "血压峰值", value: "186/112 mmHg（晨峰）", kind: "指标", span: "186/112mmHg" },
    { label: "血压节律", value: "晨峰型", kind: "指标", span: "晨起血压偏高明显" },
    { label: "合并症", value: "2型糖尿病 · FPG 8.9mmol/L", kind: "诊断", span: "2 型糖尿病史 5 年" },
    { label: "当前用药", value: "氨氯地平 5mg qd（依从性差）", kind: "用药", span: "氨氯地平 5mg qd" },
    { label: "靶器官", value: "尿微量白蛋白 86mg/L ↑", kind: "检验", span: "尿微量白蛋白 86mg/L" },
    { label: "危险因素", value: "吸烟 20 年", kind: "生活", span: "吸烟 20 年" },
  ],
  "D-01": [
    { label: "主要诊断", value: "高血压2级（高危）", kind: "诊断", span: "诊室血压 156/94mmHg" },
    { label: "血压表型", value: "隐匿性高血压", kind: "诊断", span: "家中自测正常" },
    { label: "血压节律", value: "夜间非杓型", kind: "指标", span: "非杓型节律" },
    { label: "检验", value: "血钾 4.1 · 肌酐 78μmol/L", kind: "检验", span: "肌酐 78μmol/L" },
    { label: "当前用药", value: "未规律服药", kind: "用药", span: "未规律服药" },
  ],
  "D-02": [
    { label: "主要诊断", value: "高血压1级（中危）", kind: "诊断", span: "血压 148/92mmHg" },
    { label: "血压表型", value: "白大衣高血压", kind: "诊断", span: "白大衣效应" },
    { label: "家庭自测", value: "132/84 mmHg", kind: "指标", span: "132/84mmHg" },
    { label: "人体测量", value: "BMI 29.4 · 腰围 102cm", kind: "指标", span: "BMI 29.4" },
    { label: "生活方式", value: "作息不规律", kind: "生活", span: "作息不规律" },
    { label: "当前用药", value: "未服药", kind: "用药", span: "未服药" },
  ],
}

const KIND_COLORS: Record<Field["kind"], string> = {
  诊断: "#db2777",
  用药: "#059669",
  指标: "#0d9488",
  检验: "#7c3aed",
  生活: "#d97706",
}

// 把病历文本按已解析字段切分并高亮
function HighlightedRecord({ text, fields, parsedCount }: { text: string; fields: Field[]; parsedCount: number }) {
  // 收集已解析字段的 span 位置
  const marks = fields
    .slice(0, parsedCount)
    .map((f, i) => ({ start: text.indexOf(f.span), len: f.span.length, color: KIND_COLORS[f.kind], key: i }))
    .filter((m) => m.start >= 0)
    .sort((a, b) => a.start - b.start)
  const out: React.ReactNode[] = []
  let pos = 0
  marks.forEach((m, i) => {
    if (m.start > pos) out.push(<span key={`t${i}`}>{text.slice(pos, m.start)}</span>)
    out.push(
      <mark
        key={`m${i}`}
        className="fade-up rounded px-0.5"
        style={{ background: `${m.color}26`, color: m.color, borderBottom: `1px solid ${m.color}` }}
      >
        {text.slice(m.start, m.start + m.len)}
      </mark>,
    )
    pos = m.start + m.len
  })
  out.push(<span key="tail">{text.slice(pos)}</span>)
  return <>{out}</>
}

// 第 1 阶段 · 初诊建档：非结构化病历 → LLM 语义解析 → 结构化字段抽取
export function Step1Intake({ onDone }: { onDone: () => void }) {
  const { state } = useApp()
  const caseDef: CaseDef = CASES.find((c) => c.id === state.caseId)!
  const fields = FIELDS[caseDef.id] ?? FIELDS["P-001"]
  const record = RECORDS[caseDef.id] ?? RECORDS["P-001"]

  const [parsed, setParsed] = useState(0)
  const [quality, setQuality] = useState(58.4)
  const doneRef = useRef(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    fields.forEach((_, i) => timers.push(setTimeout(() => setParsed(i + 1), 900 + i * 950)))
    const qTimer = setInterval(() => {
      setQuality((q) => Math.min(96.8, q + (96.8 - q) * 0.09 + Math.random() * 0.12))
    }, 120)
    timers.push(
      setTimeout(() => {
        clearInterval(qTimer)
        setQuality(96.8)
        if (!doneRef.current) {
          doneRef.current = true
          onDone()
        }
      }, 900 + fields.length * 950 + 1400),
    )
    return () => {
      timers.forEach(clearTimeout)
      clearInterval(qTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone, caseDef.id])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusTag color="emerald">解析中 · 本地推理</StatusTag>
        <span className="font-mono-data text-xs text-slate-500">本地部署 LLM · 数据不出域 · 语义解析建档</span>
        <div className="ml-auto flex items-baseline gap-2">
          <span className="text-xs text-slate-500">数据质量评分</span>
          <Prov value={quality.toFixed(1) + "%"} src="rule" className="text-xl font-bold text-emerald-600 text-glow-emerald" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 非结构化病历原文 */}
        <div className="panel scanline relative p-5">
          <div className="mb-2 flex items-center justify-between font-mono-data text-[10px] text-slate-500">
            <span>门诊病历原文 · 非结构化文本</span>
            <span className="text-emerald-600">LLM 语义解析 ●</span>
          </div>
          <p className="text-[13px] leading-loose text-slate-600">
            <HighlightedRecord text={record} fields={fields} parsedCount={parsed} />
            {parsed < fields.length && <span className="type-cursor text-emerald-600">▌</span>}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-200 pt-2 font-mono-data text-[9px] text-slate-500">
            {(Object.keys(KIND_COLORS) as Field["kind"][]).map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: KIND_COLORS[k] }} />
                {k}实体
              </span>
            ))}
          </div>
        </div>

        {/* 结构化字段卡片 */}
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between font-mono-data text-[10px] text-slate-500">
            <span>结构化电子健康档案 · 逐项落库</span>
            <span className="font-mono-data text-emerald-600">{parsed}/{fields.length} 字段</span>
          </div>
          <div className="space-y-2">
            {fields.slice(0, parsed).map((f) => (
              <div key={f.label} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 fade-up">
                <span
                  className="rounded px-1.5 py-0.5 font-mono-data text-[9px]"
                  style={{ color: KIND_COLORS[f.kind], background: `${KIND_COLORS[f.kind]}1f`, border: `1px solid ${KIND_COLORS[f.kind]}55` }}
                >
                  {f.kind}
                </span>
                <span className="w-20 shrink-0 text-[11px] text-slate-500">{f.label}</span>
                <Prov value={f.value} src="model" conf={90} className="text-xs text-slate-700" />
              </div>
            ))}
            {parsed < fields.length && (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center font-mono-data text-[10px] text-slate-400">
                解析中…
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 硬指标 + 陪衬数据源 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono-data text-[11px] text-slate-500">
        <span>实体/关系抽取准确率 <Prov value="90.4%" src="model" conf={90} className="text-emerald-600" /></span>
        <span>建档效率提升 <Prov value="8 倍" src="rule" className="text-amber-600" /></span>
        <span>本地部署 · 数据不出域 <Prov value="0 字节外传" src="rule" className="text-emerald-600" /></span>
        <span className="ml-auto text-slate-400">同步汇入：检验单 · 基因报告 · 生活方式问卷 · 穿戴基线</span>
      </div>
    </div>
  )
}
