import { NextResponse } from "next/server";
import { chatLlm } from "@/lib/llm";
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

    const body: {
      jobId?: string;
      jobTitle?: string;
      jobCompany?: string;
      jobDescription?: string;
    } = await request.json();

    // フロントから求人データが直接渡された場合はそれを使う
    let jobTitle = body.jobTitle ?? "";
    let jobCompany = body.jobCompany ?? "";
    let jobDescription = body.jobDescription ?? "";

    // jobIdのみの場合はsampleJobsから検索（後方互換）
    if (!jobTitle && body.jobId) {
      const job = sampleJobs.find((j) => j.id === body.jobId);
      if (job) {
        jobTitle = job.title;
        jobCompany = job.company ?? "";
        jobDescription = job.description ?? "";
      }
    }

    if (!jobTitle) {
      return NextResponse.json(
        { error: "求人情報が必要です" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profileInfo = profile
      ? `スキル: ${(profile.skills ?? []).join(", ")}, 経験年数: ${profile.experience_years}年, 希望職種: ${profile.desired_role}`
      : "プロフィール未登録";

    const text = await chatLlm(
      [
        {
          role: "user",
          content: `以下の求人に対する面接で聞かれそうな質問を10個、日本語で生成してください。

求人情報:
- 職種: ${jobTitle}
- 企業: ${jobCompany}
- 詳細: ${jobDescription}

求職者情報: ${profileInfo}

以下のJSON配列形式で出力（他のテキスト不要）:
[{"question":"質問文","category":"カテゴリ（自己紹介/志望動機/技術/行動/逆質問）","tips":"回答のポイント"}]`,
        },
      ],
      2048,
    );

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
