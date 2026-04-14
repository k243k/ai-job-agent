import { NextResponse } from "next/server";
import { chatLlm } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage, ProfileData, Json } from "@/types/database";

const SYSTEM_PROMPT = `あなたは転職カウンセラーです。ユーザーから以下の情報を集めてください:
1. 現在の仕事（職種・業界・経験年数）
2. スキルや資格
3. 希望年収
4. 希望勤務地
5. 仕事の価値観

【最重要ルール】
- ユーザーの最初のメッセージで上記5項目のうち4つ以上わかれば、追加質問せず即座にJSON出力すること。
- 不足項目は「不明」「未定」で埋めてよい。完璧を求めない。
- 年齢は聞かない（常にnull）。希望職種が不明なら「未定」。

【会話ルール】
- 不足が2つ以上ある場合のみ質問する。質問は1回にまとめる。
- 最大3往復で必ず終了。3往復を超えたら未回答項目は推測か「不明」で埋めてJSON出力。
- 完了時は「お話を整理しますね。」と一言添えてJSON出力:

\`\`\`json
{"profile":{"age":null,"skills":["スキル1"],"experience_years":数値,"desired_salary":"希望年収","desired_location":"勤務地","desired_role":"希望職種","values":"価値観"}}
\`\`\`

繰り返す: 情報が十分ならば1往復目でJSON出力して終了。余計な質問は禁止。`;

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

    const reply = await chatLlm(
      [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      512,
    );

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
