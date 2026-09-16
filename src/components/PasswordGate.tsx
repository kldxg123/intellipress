import { useState } from "react"
import { useApp } from "@/state/store"

const AUTH_KEY = "intellipress_auth_ts"
const PASSWORD = "Aa123456"
const TTL = 30 * 24 * 3600 * 1000 // 30 天免密

export function isAuthed(): boolean {
  const ts = parseInt(localStorage.getItem(AUTH_KEY) || "0", 10)
  return ts > 0 && Date.now() - ts < TTL
}

export function PasswordGate() {
  const { dispatch } = useApp()
  const [pwd, setPwd] = useState("")
  const [err, setErr] = useState(false)

  const submit = () => {
    if (pwd === PASSWORD) {
      localStorage.setItem(AUTH_KEY, String(Date.now()))
      dispatch({ type: "AUTH_OK" })
    } else {
      setErr(true)
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className={`panel panel-glow scanline relative w-full max-w-md p-8 ${err ? "shake" : ""}`}>
        <div className="mb-2 flex items-center gap-2">
          <span className="status-dot inline-block h-2 w-2 rounded-full bg-emerald-400 text-emerald-600" />
          <span className="font-mono-data text-[11px] tracking-[0.3em] text-emerald-600">RESTRICTED ACCESS</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-wide text-slate-800">
          Intelli<span className="text-emerald-600 text-glow-emerald">Press</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">数字孪生可信医疗推理 · 演示系统</p>

        <div className="mt-8 space-y-4">
          <div>
            <label className="mb-1.5 block font-mono-data text-[11px] tracking-widest text-slate-500">ACCESS CODE</label>
            <input
              type="password"
              value={pwd}
              autoFocus
              onChange={(e) => {
                setPwd(e.target.value)
                setErr(false)
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="请输入访问密码"
              className="w-full rounded-md border border-emerald-200 bg-white px-4 py-2.5 font-mono-data text-sm text-emerald-700 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
            />
          </div>
          {err && <p className="font-mono-data text-xs text-red-600 text-glow-red">✕ 密码错误，请重试</p>}
          <button
            onClick={submit}
            className="w-full rounded-md border border-emerald-300 bg-emerald-50 py-2.5 font-mono-data text-sm tracking-widest text-emerald-600 transition hover:bg-emerald-100 hover:text-glow-emerald"
          >
            验 证 进 入 →
          </button>
          <p className="text-center text-xs text-slate-500">本演示仅对受邀人员开放</p>
        </div>
      </div>
    </div>
  )
}
