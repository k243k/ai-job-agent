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
  const result =
    LLM_PROVIDER === "anthropic"
      ? await callAnthropic(messages, maxTokens)
      : await callOllama(messages, maxTokens);
  return result.text;
}
