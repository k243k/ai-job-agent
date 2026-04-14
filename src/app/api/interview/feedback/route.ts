import { NextResponse } from "next/server";
import { chatLlm } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/types/database";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body: { messages: ChatMessage[]; jobTitle: string } =
      await request.json();

    const reply = await chatLlm(
      [
        {
          role: "system",
          content: `あなたは面接官ロールプレイのAIです。「${body.jobTitle}」の面接官として振る舞ってください。
ルール:
1. 候補者の回答に対して具体的なフィードバックを提供する
2. 良い点と改善点を明確に分ける
3. より良い回答例があれば提案する
4. 次の質問に自然に移る
5. 日本語で会話する`,
        },
        ...body.messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      1024,
    );

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Interview feedback error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
