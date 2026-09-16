import type { ReactNode } from "react"
import { useApp } from "@/state/store"
import { PROV_META, type ProvenanceKind } from "@/lib/data"

// 溯源数字：overlay 开启时浮现来源角标（实测/孪生/规则/模型）
export function Prov({
  value,
  src,
  conf,
  className = "",
}: {
  value: ReactNode
  src: ProvenanceKind
  conf?: number
  className?: string
}) {
  const { state } = useApp()
  const meta = PROV_META[src]
  return (
    <span className={`relative inline-flex items-baseline gap-1 ${className}`}>
      <span className="font-mono-data">{value}</span>
      {state.provenanceOn && (
        <span
          className="pointer-events-none -translate-y-1 whitespace-nowrap rounded-sm px-1 py-px text-[9px] leading-none font-mono-data fade-up"
          style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}55` }}
        >
          {meta.label}
          {src === "model" && conf !== undefined ? ` ${conf}%` : ""}
        </span>
      )}
    </span>
  )
}
