import { useApp } from "@/state/store"
import { STEPS } from "@/lib/data"
import { Prov } from "@/components/Prov"

// 「数据明细」抽屉：当前阶段的原始指标 / 模型版本 / 数据来源统计
export function DetailDrawer() {
  const { state, dispatch } = useApp()
  if (!state.drawerOpen) return null

  const step = state.step
  const meta = STEPS[step - 1]

  const rows: { label: string; value: string; src: "measured" | "twin" | "rule" | "model"; conf?: number }[][] = [
    [],
    // 1 初诊建档
    [
      { label: "语义解析模型", value: "本地部署 LLM · 数据不出域", src: "rule" },
      { label: "实体/关系抽取准确率", value: "90.4%", src: "model", conf: 90 },
      { label: "建档效率", value: "较人工提升 8 倍", src: "rule" },
      { label: "知识图谱", value: "12,847 医学实体 · v2.3.1", src: "rule" },
      { label: "同步数据源", value: "检验单 / 基因报告 / 问卷 / 穿戴基线", src: "measured" },
    ],
    // 2 智能早筛
    [
      { label: "判定主体", value: "指南规则引擎 + 医学知识图谱（大模型仅解释）", src: "rule" },
      { label: "规则引擎", value: "血压分级表 5 档 · 4×3 危险分层矩阵 · 11 项因子核对", src: "rule" },
      { label: "指南条款库", value: "中国高血压防治指南 2024 修订版 · 逐条引用", src: "rule" },
      { label: "知识图谱", value: "35 节点 · 46 边 · 8 类关系 · 一跳子图推理", src: "rule" },
      { label: "解释模型", value: "deepseek-chat · temperature 0.3 · 禁止更改结论", src: "model", conf: 92 },
      { label: "审计日志", value: "已写入 · 哈希链 #a3f9…c21e", src: "rule" },
    ],
    // 3 孪生推演
    [
      { label: "孪生引擎", value: "血流动力学仿真 · TwinCore v1.4", src: "twin" },
      { label: "轨迹预测误差", value: "MAE ±2.1 mmHg", src: "twin" },
      { label: "推演方式", value: "蒙特卡洛 2,000 次 · 5 年前瞻", src: "rule" },
      { label: "风险概率校准", value: "Brier 分数 0.082", src: "model", conf: 88 },
      { label: "对照模型", value: "队列对照模型 v2.2", src: "model", conf: 88 },
    ],
    // 4 个性方案
    [
      { label: "分层注意力模型", value: "HierAttn v2.1 · 匹配准确率 91.8%", src: "model", conf: 92 },
      { label: "医师审核模板", value: "v3.2 · 2025-11 更新", src: "rule" },
      { label: "营养助手", value: "钠估算误差 ±0.4g/餐", src: "model", conf: 93 },
      { label: "方案生效", value: "医师确认后下发", src: "rule" },
    ],
    // 5 居家执行
    [
      { label: "照护编排引擎", value: "v1.2 · 优先级队列 · 下发时延 38ms", src: "measured" },
      { label: "预警引擎", value: "v1.5 · 规则+模型双通道", src: "rule" },
      { label: "处置指令时延", value: "2.4 - 8.5 ms", src: "measured" },
      { label: "异常检出率 / 误报率", value: "96.3% / 1.8%", src: "model", conf: 96 },
      { label: "Ⅰ级直连", value: "120 急救平台对接 · 定位精度 15m", src: "rule" },
    ],
    // 6 复盘迭代
    [
      { label: "奖励函数", value: "r = 达标 + 依从 - 风险惩罚", src: "rule" },
      { label: "参数更新边界", value: "≤10% · 医师设定", src: "rule" },
      { label: "联邦聚合", value: "FedAvg · 3 机构 · 梯度加密", src: "model", conf: 90 },
      { label: "数据出域", value: "0 字节 · 仅梯度", src: "rule" },
    ],
  ]

  return (
    <aside className="fixed bottom-0 right-0 top-12 z-40 w-80 overflow-y-auto border-l border-emerald-200 bg-white/95 p-4 backdrop-blur-md fade-up">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="font-mono-data text-[10px] tracking-[0.25em] text-emerald-600">数据明细 · 阶段 {step}/6</div>
          <div className="text-sm font-semibold text-slate-800">{meta.name} · 数据详情</div>
        </div>
        <button
          onClick={() => dispatch({ type: "TOGGLE_DRAWER" })}
          className="rounded border border-slate-300 px-2 py-1 font-mono-data text-xs text-slate-500 hover:text-slate-700"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2.5">
        {(rows[step] ?? []).map((r) => (
          <div key={r.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[10px] text-slate-500">{r.label}</div>
            <Prov value={r.value} src={r.src} conf={r.conf} className="mt-0.5 block text-xs text-slate-700" />
          </div>
        ))}
      </div>
      <p className="mt-4 font-mono-data text-[9px] leading-relaxed text-slate-400">
        所有指标均可溯源，按四类来源标记：实测 / 孪生 / 规则 / 模型。
      </p>
    </aside>
  )
}
