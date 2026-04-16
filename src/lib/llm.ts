/**
 * LLMクライアント共通モジュール
 *
 * 環境変数 LLM_PROVIDER で切り替え:
 * - "ollama" (デフォルト): ローカルOllama API
 * - "anthropic": Claude API (ANTHROPIC_API_KEY 必須)
 */

const LLM_PROVIDER = process.env.LLM_PROVIDER ?? "ollama";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "gemma3:4b";
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LlmResponse {
  text: string;
}

async function callOllama(messages: LlmMessage[], maxTokens: number): Promise<LlmResponse> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages,
      think: false,
      options: {
        num_predict: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: HTTP ${response.status}`);
  }

  const data = (await response.json()) as { message: { content: string } };
  // Qwen 3.5等の思考タグ <think>...</think> を除去
  const cleaned = data.message.content.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
  return { text: cleaned };
}

async function callGroq(messages: LlmMessage[], maxTokens: number): Promise<LlmResponse> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY が設定されていません");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices[0]?.message?.content ?? "";
  return { text };
}

async function callAnthropic(messages: LlmMessage[], maxTokens: number): Promise<LlmResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY が設定されていません");
  }

  // system メッセージを分離
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystemMsgs = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: "claude-sonnet-4-5-20250514",
    max_tokens: maxTokens,
    messages: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: HTTP ${response.status}`);
  }

  const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
  const firstBlock = data.content[0];
  const text = firstBlock && firstBlock.type === "text" ? firstBlock.text : "";
  return { text };
}

/**
 * LLMにメッセージを送信してテキスト応答を取得する
 */
export async function chatLlm(
  messages: LlmMessage[],
  maxTokens: number = 2048
): Promise<string> {
  let result: LlmResponse;
  switch (LLM_PROVIDER) {
    case "anthropic":
      result = await callAnthropic(messages, maxTokens);
      break;
    case "groq":
      result = await callGroq(messages, maxTokens);
      break;
    default:
      result = await callOllama(messages, maxTokens);
  }
  return result.text;
}
