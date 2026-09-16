// DeepSeek 对话客户端 —— 密钥仅存于 .env.local（绝不入库），经 vite dev proxy /api/deepseek 注入转发。
// 架构约束：大模型只做"解释"，分级/分层结论由指南规则引擎与知识图谱给出，prompt 中明确禁止其更改结论。
import type { Assessment } from "./guidelines";
import { engineSummary } from "./guidelines";

const PROXY_URL = "/api/deepseek/chat/completions";
const DIRECT_URL = "https://api.deepseek.com/chat/completions";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export type LlmMode = "live" | "replay";

export interface CaseLike {
  id: string;
  sex: string;
  age: number;
  subtype: string;
  comorbidity: string;
  adherence: string;
  baseSbp: number;
  baseDbp: number;
  summary: string;
}

/** 通用多轮对话（咨询台用），流式输出 */
export async function chatDeepSeek(
  messages: ChatMsg[],
  onDelta: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  return callDeepSeekRaw(messages, onDelta, signal);
}

/**
 * 阶段 2 的 AI 解读：输入规则引擎判定轨迹 Assessment，模型仅输出"解释"。
 * 禁止输出分层结论本身；以引擎结论为唯一事实来源。
 */
export async function callDeepSeek(
  c: CaseLike,
  assessment: Assessment,
  onDelta: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const sys = [
    "你是高血压慢病管理演示系统中的【解释模块】。",
    "重要约束：血压分级与心血管风险分层已经由内置的指南规则引擎（对照《中国高血压防治指南(2024年修订版)》条款）与医学知识图谱判定完成，判定结果是唯一事实来源。",
    "你的任务仅仅是【解释】这些已作出的判定：说明指标含义、分级与分层依据、各危险因素为何计入、干预条目对应的指南推荐。",
    "严禁输出与引擎结论不一致的分级/分层判断，严禁给出新的风险等级，不要下诊断结论，不要给出具体药名剂量调整医嘱；结尾提示需临床医生结合面诊确认。",
    "用中文、分小节、简明回答，约 260 字。",
  ].join("\n");
  const user = [
    `【病例】${c.id} · ${c.sex} · ${c.age} 岁 · ${c.subtype} · ${c.comorbidity}`,
    `基线血压 ${c.baseSbp}/${c.baseDbp} mmHg · 依从性：${c.adherence}`,
    `阶段一提取摘要：${c.summary}`,
    "",
    "【规则引擎判定轨迹（事实来源，不得更改）】",
    engineSummary(assessment),
    "",
    "请输出你对上述判定的解释。",
  ].join("\n");
  return callDeepSeekRaw(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    onDelta,
    signal,
  );
}

async function callDeepSeekRaw(
  messages: ChatMsg[],
  onDelta: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const body = JSON.stringify({ model: "deepseek-chat", messages, stream: true, temperature: 0.3 });
  let resp = await fetch(PROXY_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal });
  if (!resp.ok) {
    // dev 环境之外（如纯静态预览）无代理时回退直连，期望页面注入 VITE_DEEPSEEK_KEY
    const key = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_DEEPSEEK_KEY;
    if (!key) throw new Error(`proxy ${resp.status}`);
    resp = await fetch(DIRECT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body,
      signal,
    });
    if (!resp.ok) throw new Error(`deepseek ${resp.status}`);
  }
  const reader = resp.body!.getReader();
  const dec = new TextDecoder();
  let full = "";
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const ln of lines) {
      const t = ln.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const d = j.choices?.[0]?.delta?.content ?? "";
        if (d) {
          full += d;
          onDelta(full);
        }
      } catch {
        /* partial json */
      }
    }
  }
  return full;
}

/** 回放文案（网络不可用时的兜底演示）：解释口吻，结论与规则引擎一致 */
export const REPLAY_TEXTS: Record<string, string> = {
  "P-001": [
    "【指标含义】",
    "动态血压晨峰峰值 186/112 mmHg，反映清晨交感激活显著；尿微量白蛋白 86 mg/L 升高，提示早期靶器官损害。",
    "",
    "【分级与分层依据】",
    "依据指南 3.4 表 2，按最高测值定级：峰值 186/112 落在 3 级区间（≥180/110）；存在 5 个危险因素（年龄男>55、吸烟、糖尿病、肥胖、缺乏运动）并伴微量白蛋白尿，按 4.2 表 5 分层矩阵（≥3 个危险因素/糖尿病 × 3 级）落入【很高危】。",
    "",
    "【干预建议的出处】",
    "知识图谱显示：很高危应按 5.3.1 立即启动药物治疗，氨氯地平为一线 CCB（5.3.2）；非药物对应 6.2.1 限盐 <5g/日、6.2.4 戒烟；晨峰型与脑卒中风险关联，需重点管控（3.4.2）。具体用药方案需临床医生面诊确认。",
  ].join("\n"),
  "D-01": [
    "【指标含义】",
    "诊室 156/94 mmHg，动态最高 168/102 mmHg，属隐匿性高血压；夜间血压下降 <10% 呈非杓型节律。",
    "",
    "【分级与分层依据】",
    "按指南 3.2.3，隐匿性高血压以诊室外最高测值 168/102 定级，落 3.4 表 2 的 2 级区间；存在靶器官损害等危征（非杓型节律，3.2.4），叠加年龄因素，按 4.2 表 5 分层矩阵落入【高危】。",
    "",
    "【干预建议的出处】",
    "图谱显示：非杓型节律与脑卒中风险关联（3.2.4），建议家庭血压自测随访（3.5.1）；2 级首选氨氯地平（5.3.2）；规律作息有助于改善夜间下降率（6.2.3）。具体用药需临床医生确认。",
  ].join("\n"),
  "D-02": [
    "【指标含义】",
    "诊室复测最高 151/95 mmHg，家庭自测 132/84 mmHg，符合白大衣高血压特征；BMI 29.4 为肥胖。",
    "",
    "【分级与分层依据】",
    "按 3.4 表 2 血压定 1 级；危险因素为肥胖与缺乏运动共 2 个、无靶器官损害，按 4.2 表 5 分层矩阵（1–2 个危险因素 × 1 级）落入【中危】；3.3.1 提示应结合诊室外血压综合判断，避免过度治疗。",
    "",
    "【干预建议的出处】",
    "按 6.1.2，中危先行生活方式干预 1–3 个月再复评：图谱对应 6.2.2 减重（每减 10kg 降 SBP 5–20 mmHg）、6.2.3 快走 30min/日、家庭自测监测（3.5.1）。具体用药需临床医生确认。",
  ].join("\n"),
};
