import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage, ProfileData, Json } from "@/types/database";

const SYSTEM_PROMPT = `あなたは転職カウンセラーです。以下の情報を自然な会話を通じて収集してください:
- 年齢
- 職歴・現在の仕事
- スキル（プログラミング言語、ツール、資格など）
- 経験年数
- 希望年収
- 希望勤務地
- 希望職種
- 仕事に対する価値観（ワークライフバランス、成長性、安定性など）

聞き方のルール:
1. 一度に複数の質問をしない。1つずつ自然に聞く。
2. 相手の回答に共感を示してから次の質問に移る。
3. 全ての情報が十分に集まったと判断したら、「ありがとうございます！お話を整理しますね。」と伝えた上で、会話の最後に以下のJSON形式で構造化データを出力してください:

\`\`\`json
{"profile":{"age":数値,"skills":["スキル1","スキル2"],"experience_years":数値,"desired_salary":"希望年収","desired_location":"希望勤務地","desired_role":"希望職種","values":"価値観の要約"}}
\`\`\`

まだ情報が不十分な場合はJSONを出力せず、会話を続けてください。`;

function extractProfile(text: string): ProfileData | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed: unknown = JSON.parse(jsonMatch[1]);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "profile" in parsed
    ) {
      return (parsed as { profile: ProfileData }).profile;
    }
  } catch {
    // JSON解析失敗
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body: { messages: ChatMessage[] } = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "メッセージが必要です" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const reply =
      response.content[0].type === "text" ? response.content[0].text : "";

    // プロフィール抽出を試みる
    const profile = extractProfile(reply);
    let profileExtracted = false;

    if (profile) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // JSON部分を除いた応答テキスト
        const cleanReply = reply.replace(/```json[\s\S]*?```/, "").trim();

        const { error: upsertError } = await supabase.from("profiles").upsert({
          id: user.id,
          age: profile.age ?? null,
          skills: profile.skills ?? [],
          experience_years: profile.experience_years ?? null,
          desired_salary: profile.desired_salary ?? null,
          desired_location: profile.desired_location ?? null,
          desired_role: profile.desired_role ?? null,
          values: profile.values ?? null,
          raw_conversation: JSON.parse(JSON.stringify(messages)) as Json,
          updated_at: new Date().toISOString(),
        });

        if (upsertError) {
          console.error("Profile upsert error:", upsertError);
          return NextResponse.json({
            reply: cleanReply + "\n\n（※プロフィールの保存に失敗しました。もう一度お試しください。）",
            profileExtracted: false,
          });
        }

        profileExtracted = true;

        return NextResponse.json({
          reply: cleanReply || "プロフィールを保存しました！「求人一覧」から求人を探してみましょう。",
          profileExtracted,
        });
      }
    }

    return NextResponse.json({ reply, profileExtracted });
  } catch (error) {
    console.error("Hearing API error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
