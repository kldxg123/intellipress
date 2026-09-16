import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import type { ProxyOptions } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // .env.local 中的 DEEPSEEK_API_KEY 仅在 dev/preview 代理层使用，
  // 不会进入客户端 bundle。
  const env = loadEnv(mode, __dirname, "")
  const apiKey = env.DEEPSEEK_API_KEY || ""

  const deepseekProxy: Record<string, ProxyOptions> = {
    "/api/deepseek": {
      target: "https://api.deepseek.com",
      changeOrigin: true,
      rewrite: (p) => p.replace(/^\/api\/deepseek/, ""),
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq) => {
          if (apiKey) {
            proxyReq.setHeader("Authorization", `Bearer ${apiKey}`)
          }
        })
      },
    },
  }

  return {
    base: "./",
    plugins: [inspectAttr(), react()],
    server: {
      port: 3000,
      proxy: deepseekProxy,
    },
    preview: {
      proxy: deepseekProxy,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
