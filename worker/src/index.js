// IntelliPress LLM 安全代理（Cloudflare Worker，无依赖）
// 功能：接收 OpenAI 兼容 chat completions POST，注入密钥转发 DeepSeek，SSE 流式透传。
// 安全：Origin 白名单 / 仅 POST /chat/completions / 请求体消毒封顶 / 密钥仅存 Workers secret。
// 纯函数（isAllowedOrigin / sanitizeChatBody）导出供本地单测，不影响 Workers 运行时。

const UPSTREAM = "https://api.deepseek.com/chat/completions";

const MAX_TOKENS_CAP = 800;
const MAX_MESSAGES_CHARS = 4000;

// 生产仅允许 GitHub Pages 站点；localhost/127.0.0.1 任意端口视为开发源
const PROD_ORIGIN = "https://kldxg123.github.io";
const DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === PROD_ORIGIN) return true;
  return DEV_ORIGIN_RE.test(origin);
}

// 请求体消毒：强制模型与流式，max_tokens 封顶，messages 总字符封顶
export function sanitizeChatBody(raw) {
  if (!raw || typeof raw !== "object") return { error: "请求体必须是 JSON 对象", status: 400 };
  if (!Array.isArray(raw.messages) || raw.messages.length === 0) {
    return { error: "messages 必须为非空数组", status: 400 };
  }
  let total = 0;
  const messages = [];
  for (const m of raw.messages) {
    if (!m || typeof m.content !== "string" || typeof m.role !== "string") {
      return { error: "messages 元素须含 role/content 字符串", status: 400 };
    }
    total += m.content.length;
    messages.push({ role: m.role, content: m.content });
  }
  if (total > MAX_MESSAGES_CHARS) {
    return { error: `messages 总字符数 ${total} 超过上限 ${MAX_MESSAGES_CHARS}`, status: 413 };
  }
  const maxTokens =
    typeof raw.max_tokens === "number" && Number.isFinite(raw.max_tokens)
      ? Math.min(Math.max(1, Math.floor(raw.max_tokens)), MAX_TOKENS_CAP)
      : MAX_TOKENS_CAP;
  const body = {
    model: "deepseek-chat", // 强制
    messages,
    max_tokens: maxTokens, // 封顶 800
    stream: true, // 强制流式
  };
  if (typeof raw.temperature === "number" && Number.isFinite(raw.temperature)) {
    body.temperature = Math.min(Math.max(raw.temperature, 0), 2);
  }
  return { body };
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonError(status, message, origin) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(origin ? corsHeaders(origin) : {}) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Origin 判定：优先 Origin，其次 Referer（取源），两者皆无 → 403
    const originHeader = request.headers.get("Origin");
    let origin = originHeader;
    if (!origin) {
      const referer = request.headers.get("Referer");
      if (referer) {
        try { origin = new URL(referer).origin; } catch { origin = null; }
      }
    }
    if (!origin || !isAllowedOrigin(origin)) {
      return jsonError(403, "Origin 不在白名单");
    }

    // CORS 预检
    if (request.method === "OPTIONS") {
      if (url.pathname !== "/chat/completions") return jsonError(404, "Not Found", origin);
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // 仅接受 POST /chat/completions
    if (url.pathname !== "/chat/completions" || request.method !== "POST") {
      return jsonError(404, "Not Found", origin);
    }

    if (!env.DEEPSEEK_API_KEY) {
      return jsonError(500, "服务端未配置 DEEPSEEK_API_KEY", origin);
    }

    let raw;
    try {
      raw = await request.json();
    } catch {
      return jsonError(400, "请求体不是合法 JSON", origin);
    }

    const { body, error, status } = sanitizeChatBody(raw);
    if (error) return jsonError(status, error, origin);

    // 注入密钥转发，SSE 流式透传
    const upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const headers = new Headers(corsHeaders(origin));
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "text/event-stream");
    headers.set("Cache-Control", "no-cache");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
