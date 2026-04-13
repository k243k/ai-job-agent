import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { sampleJobs } from "@/lib/sampleJobs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body: { jobId: string } = await request.json();
    const job = sampleJobs.find((j) => j.id === body.jobId);

    if (!job) {
      return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const profileInfo = profile
      ? `スキル: ${(profile.skills ?? []).join(", ")}, 経験年数: ${profile.experience_years}年, 希望職種: ${profile.desired_role}`
      : "プロフィール未登録";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `以下の求人に対する面接で聞かれそうな質問を10個、日本語で生成してください。

求人情報:
- 職種: ${job.title}
- 企業: ${job.company}
- 詳細: ${job.description}

求職者情報: ${profileInfo}

以下のJSON配列形式で出力（他のテキスト不要）:
[{"question":"質問文","category":"カテゴリ（自己紹介/志望動機/技術/行動/逆質問）","tips":"回答のポイント"}]`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";

    let questions: Array<{
      question: string;
      category: string;
      tips: string;
    }> = [];

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]) as typeof questions;
      }
    } catch {
      // パース失敗
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Interview questions error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
