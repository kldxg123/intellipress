import { AppProvider, useApp } from "@/state/store"
import { TwinBackground } from "@/components/TwinBackground"
import { PasswordGate, isAuthed } from "@/components/PasswordGate"
import { MissionSetup } from "@/components/MissionSetup"
import { DemoShell } from "@/components/DemoShell"
import { useEffect } from "react"

function Root() {
  const { state, dispatch } = useApp()

  // 30 天免密：已验证则直接进配置台
  useEffect(() => {
    if (state.phase === "gate" && isAuthed()) dispatch({ type: "AUTH_OK" })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <TwinBackground />
      {state.phase === "gate" && <PasswordGate />}
      {state.phase === "setup" && <MissionSetup />}
      {state.phase === "demo" && <DemoShell />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  )
}
