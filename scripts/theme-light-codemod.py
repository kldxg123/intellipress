# 暗色科技风 → 明亮医疗风：一次性类名/字面量 codemod
# 两段式（占位符防二次映射）；只处理演示 UI 文件，components/ui 走 CSS 变量自动适配
import re, pathlib, sys

ROOT = pathlib.Path("src")
TARGETS = [ROOT / "App.tsx"] + sorted((ROOT / "components").glob("*.tsx")) + sorted((ROOT / "steps").glob("*.tsx"))

CLASS_MAP = {
    # 文字
    "text-slate-100": "text-slate-800", "text-slate-200": "text-slate-700",
    "text-slate-300": "text-slate-600", "text-slate-400": "text-slate-500",
    "text-slate-600": "text-slate-400", "text-slate-700": "text-slate-400",
    "text-emerald-100": "text-emerald-700", "text-emerald-200": "text-emerald-700",
    "text-emerald-300": "text-emerald-600", "text-emerald-400/80": "text-emerald-600",
    "text-emerald-400": "text-emerald-600",
    "text-amber-200": "text-amber-700", "text-amber-300/80": "text-amber-600",
    "text-amber-300": "text-amber-600", "text-amber-400": "text-amber-500",
    "text-red-200": "text-red-700", "text-red-300": "text-red-600", "text-red-400": "text-red-600",
    "text-violet-200": "text-violet-700", "text-violet-300": "text-violet-600",
    "text-violet-400/80": "text-violet-500", "text-violet-400": "text-violet-600",
    "text-cyan-100": "text-cyan-800", "text-cyan-200": "text-cyan-800", "text-cyan-300": "text-cyan-700",
    "text-sky-300": "text-sky-600", "text-teal-300": "text-teal-600",
    # 边框
    "border-slate-800": "border-slate-200", "border-slate-700/60": "border-slate-300",
    "border-slate-700": "border-slate-300",
    "border-emerald-900/30": "border-emerald-200", "border-emerald-900/40": "border-emerald-200",
    "border-emerald-900/50": "border-emerald-200", "border-emerald-900/60": "border-emerald-200",
    "border-emerald-800/50": "border-emerald-200", "border-emerald-800/60": "border-emerald-200",
    "border-emerald-700/50": "border-emerald-200", "border-emerald-700/60": "border-emerald-200",
    "border-emerald-600/50": "border-emerald-200",
    "border-emerald-500/40": "border-emerald-300", "border-emerald-500/50": "border-emerald-300",
    "border-emerald-500/60": "border-emerald-300", "border-emerald-500/70": "border-emerald-500",
    "border-emerald-400/60": "border-emerald-500", "border-emerald-400/70": "border-emerald-500",
    "border-emerald-400": "border-emerald-500",
    "border-teal-700/60": "border-teal-200",
    "border-violet-700/60": "border-violet-200", "border-violet-500/40": "border-violet-200",
    "border-violet-400/70": "border-violet-300",
    "border-amber-700/50": "border-amber-200", "border-amber-700/60": "border-amber-200",
    "border-amber-800/60": "border-amber-200", "border-amber-500/60": "border-amber-300",
    "border-amber-400": "border-amber-500",
    "border-red-800/60": "border-red-200", "border-red-500/50": "border-red-300",
    "border-red-500/60": "border-red-300", "border-red-400/70": "border-red-400",
    "border-cyan-500/40": "border-cyan-200", "border-cyan-500/60": "border-cyan-200",
    "border-cyan-700/50": "border-cyan-200",
    "border-orange-500/60": "border-orange-200",
    # 背景
    "bg-slate-950/40": "bg-slate-50", "bg-slate-950/50": "bg-slate-50",
    "bg-slate-950/60": "bg-slate-50", "bg-slate-950/70": "bg-white",
    "bg-slate-900/40": "bg-white", "bg-slate-900/70": "bg-white", "bg-slate-900": "bg-slate-100",
    "bg-[#050c18]/85": "bg-white/85", "bg-[#050c18]/90": "bg-white/85",
    "bg-[#060d1a]/95": "bg-white/95", "bg-[#06121f]": "bg-white",
    "bg-emerald-950/20": "bg-emerald-50", "bg-emerald-950/25": "bg-emerald-50",
    "bg-emerald-950/30": "bg-emerald-50", "bg-emerald-950/40": "bg-emerald-50",
    "bg-emerald-950/50": "bg-emerald-50", "bg-emerald-950/60": "bg-emerald-50",
    "bg-emerald-500/10": "bg-emerald-50", "bg-emerald-500/15": "bg-emerald-50",
    "bg-emerald-500/20": "bg-emerald-100", "bg-emerald-500/25": "bg-emerald-100",
    "bg-emerald-500/30": "bg-emerald-100",
    "bg-teal-950/40": "bg-teal-50",
    "bg-violet-950/40": "bg-violet-50", "bg-violet-500/8": "bg-violet-50",
    "bg-violet-500/15": "bg-violet-100", "bg-violet-500/20": "bg-violet-100",
    "bg-amber-950/30": "bg-amber-50", "bg-amber-950/40": "bg-amber-50",
    "bg-amber-950/60": "bg-amber-50", "bg-amber-500/10": "bg-amber-50", "bg-amber-500/15": "bg-amber-50",
    "bg-red-950/60": "bg-red-50", "bg-red-500/10": "bg-red-50",
    "bg-red-500/15": "bg-red-50", "bg-red-500/30": "bg-red-100",
    "bg-cyan-950/30": "bg-cyan-50", "bg-cyan-500/10": "bg-cyan-50", "bg-cyan-500/15": "bg-cyan-50",
    "bg-orange-500/15": "bg-orange-50",
    # 交互与其他
    "hover:border-slate-500/70": "hover:border-slate-400",
    "shadow-[0_0_18px_rgba(52,211,153,0.15)]": "shadow-sm",
}

# 按文件的字面量替换（原始色值 / 内联样式，在类名映射之后执行）
LITERALS = {
    "src/components/PathRail.tsx": [
        ('"#cbd5e1"', '"#334155"'), ('"#64748b"', '"#94a3b8"'), ('"#33475c"', '"#cbd5e1"'),
        ('"#34d399"', '"#059669"'), ('"#f59e0b"', '"#d97706"'), ('"#fbbf24"', '"#b45309"'),
        ('"#0a1524"', '"#f1f5f9"'),
        ("rgba(167,139,250,0.07)", "rgba(124,58,237,0.06)"),
    ],
    "src/components/BPChart.tsx": [
        ('"#16324a"', '"#e2e8f0"'), ('"#122738"', '"#eef2f6"'), ('"#4b6b85"', '"#94a3b8"'),
        ('"#34d399"', '"#10b981"'), ('"#a78bfa"', '"#8b5cf6"'),
        (' style={{ filter: "drop-shadow(0 0 4px rgba(52,211,153,0.4))" }}', ""),
        ("bg-emerald-400", "bg-emerald-500"),
    ],
    "src/steps/Step1Intake.tsx": [
        ('"#f472b6"', '"#db2777"'), ('"#34d399"', '"#059669"'), ('"#2dd4bf"', '"#0d9488"'),
        ('"#a78bfa"', '"#7c3aed"'), ('"#f59e0b"', '"#d97706"'),
    ],
    "src/steps/Step3TwinForecast.tsx": [
        ('"#16324a"', '"#e2e8f0"'), ('"#122738"', '"#eef2f6"'), ('"#4b6b85"', '"#94a3b8"'),
        ('"#34d399"', '"#059669"'), ('"#6ee7b7"', '"#059669"'), ('"#fca5a5"', '"#dc2626"'),
        (' style={{ filter: "drop-shadow(0 0 4px rgba(239,68,68,0.4))" }}', ""),
        (' style={{ filter: "drop-shadow(0 0 4px rgba(52,211,153,0.4))" }}', ""),
        ('boxShadow: "0 0 24px rgba(52,211,153,0.12)"', 'boxShadow: "0 4px 16px rgba(5,150,105,0.10)"'),
    ],
    "src/steps/Step4Plan.tsx": [
        ('color: "#f59e0b"', 'color: "#b45309"'), ('color: "#34d399"', 'color: "#047857"'),
    ],
    "src/steps/Step5HomeExecution.tsx": [
        ('"rgba(6,12,24,0.92)"', '"#ffffff"'),
        ('color: "#f59e0b"', 'color: "#b45309"'), ('color: "#34d399"', 'color: "#047857"'),
        ('stroke={runtime.alertLevel === 1 ? "#ef4444" : runtime.alertLevel > 0 ? "#f59e0b" : "#34d399"}',
         'stroke={runtime.alertLevel === 1 ? "#ef4444" : runtime.alertLevel > 0 ? "#f59e0b" : "#10b981"}'),
        ("boxShadow: \"0 0 8px rgba(52,211,153,0.6)\"", "boxShadow: \"0 0 0 3px rgba(16,185,129,0.18)\""),
    ],
    "src/steps/Step6Review.tsx": [
        ('boxShadow: "0 0 12px rgba(52,211,153,0.5)"', 'boxShadow: "none"'),
        ('boxShadow: "0 0 8px rgba(245,158,11,0.8)"', 'boxShadow: "none"'),
    ],
}

def sub_tokens(text: str) -> tuple[str, int]:
    count = 0
    # 第一遍：命中 token → 占位符
    for i, tok in enumerate(CLASS_MAP):
        pat = re.compile(r"(?<![-\w/\]])" + re.escape(tok) + r"(?![-\w/\]])")
        text, n = pat.subn(f"\x00{i}\x00", text)
        count += n
    # 第二遍：占位符 → 目标
    for i, tok in enumerate(CLASS_MAP):
        text = text.replace(f"\x00{i}\x00", CLASS_MAP[tok])
    return text, count

total = 0
for f in TARGETS:
    key = f.as_posix()
    src = f.read_text(encoding="utf-8")
    out, n = sub_tokens(src)
    m = 0
    for old, new in LITERALS.get(key, []):
        c = out.count(old)
        if c == 0:
            print(f"  !! 未命中 {key}: {old[:60]}")
        out = out.replace(old, new)
        m += c
    if out != src:
        f.write_text(out, encoding="utf-8")
    total += n + m
    print(f"{key}: 类名 {n} 处, 字面量 {m} 处")
print(f"总计 {total} 处替换")
