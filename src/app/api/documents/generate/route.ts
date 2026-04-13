import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { sampleJobs } from "@/lib/sampleJobs";
import type { DocType } from "@/types/database";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  resume: "履歴書",
  cv: "職務経歴書",
  motivation_letter: "志望動機書",
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body: { jobId: string; docType: DocType } = await request.json();
    const { jobId, docType } = body;

    if (!jobId || !docType) {
      return NextResponse.json(
        { error: "求人IDと書類タイプが必要です" },
        { status: 400 }
      );
    }

    // プロフィール取得
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "先にヒアリングを完了してください" },
        { status: 400 }
      );
    }

    // 求人情報取得（MVPではサンプルから）
    const job = sampleJobs.find((j) => j.id === jobId);
    if (!job) {
      return NextResponse.json({ error: "求人が見つかりません" }, { status: 404 });
    }

    const docLabel = DOC_TYPE_LABELS[docType];

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const profileSummary = `年齢: ${profile.age ?? "不明"}, スキル: ${(profile.skills ?? []).join(", ") || "不明"}, 経験年数: ${profile.experience_years ?? "不明"}年, 希望年収: ${profile.desired_salary ?? "不明"}, 希望勤務地: ${profile.desired_location ?? "不明"}, 希望職種: ${profile.desired_role ?? "不明"}, 価値観: ${profile.values ?? "不明"}`;

    const jobSummary = `求人名: ${job.title}, 企業: ${job.company}, 勤務地: ${job.location}, 年収: ${job.salary}, 詳細: ${job.description}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `以下の求職者情報と求人情報を元に、${docLabel}を日本語で作成してください。

求職者情報:
${profileSummary}

求人情報:
${jobSummary}

要件:
- 日本の転職市場の慣例に従った形式で作成
- 具体的で説得力のある内容にする
- ${docType === "resume" ? "学歴・職歴・資格・自己PRを含める" : ""}
- ${docType === "cv" ? "職務要約・職務経歴（プロジェクト詳細含む）・技術スキル・自己PRを含める" : ""}
- ${docType === "motivation_letter" ? "志望動機・自身の強み・入社後の貢献を明確に記載する" : ""}
- Markdownフォーマットで出力`,
        },
      ],
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    // DBに保存
    const { data: doc, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        job_id: jobId,
        doc_type: docType,
        content,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Document save error:", dbError);
    }

    return NextResponse.json({ document: doc, content });
  } catch (error) {
    console.error("Document generate error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
