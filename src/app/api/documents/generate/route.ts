import { NextResponse } from "next/server";
import { chatLlm } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import type { DocType } from "@/types/database";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  resume: "履歴書",
  cv: "職務経歴書",
  motivation_letter: "志望動機書",
};

const RESUME_PROMPT = `以下のプロフィール情報を元に、日本式履歴書の各セクションを生成してください。

出力形式はMarkdownで、以下のセクションを含めてください:
## 基本情報
## 学歴
## 職歴
## 資格
## 志望動機
## 自己PR
## 本人希望

要件:
- 日本の転職市場の慣例に従った形式で作成
- プロフィールの情報から推測して具体的で説得力のある内容にする
- 情報が不足しているセクションは「（要記入）」と記載する
- 汎用的な内容にする（特定の企業向けにしない）`;

const CV_PROMPT = `以下のプロフィール情報を元に、日本式職務経歴書を生成してください。

出力形式はMarkdownで、以下のセクションを含めてください:
## 職務要約
## 職務経歴
### 会社名（期間）
## スキル
## 資格
## 自己PR

要件:
- 日本の転職市場の慣例に従った形式で作成
- プロフィールの情報から推測して具体的で説得力のある内容にする
- 情報が不足しているセクションは「（要記入）」と記載する
- 汎用的な内容にする（特定の企業向けにしない）`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body: { docType: DocType } = await request.json();
    const { docType } = body;

    if (!docType || !DOC_TYPE_LABELS[docType]) {
      return NextResponse.json(
        { error: "書類タイプが必要です" },
        { status: 400 },
      );
    }

    // 履歴書と職務経歴書のみ対応
    if (docType === "motivation_letter") {
      return NextResponse.json(
        { error: "志望動機書は求人ページから生成してください" },
        { status: 400 },
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
        { status: 400 },
      );
    }

    const docLabel = DOC_TYPE_LABELS[docType];

    const profileSummary = [
      `年齢: ${profile.age ?? "不明"}`,
      `スキル: ${(profile.skills ?? []).join(", ") || "不明"}`,
      `経験年数: ${profile.experience_years ?? "不明"}年`,
      `希望年収: ${profile.desired_salary ?? "不明"}`,
      `希望勤務地: ${profile.desired_location ?? "不明"}`,
      `希望職種: ${profile.desired_role ?? "不明"}`,
      `価値観: ${profile.values ?? "不明"}`,
    ].join("\n");

    const systemPrompt =
      docType === "resume" ? RESUME_PROMPT : CV_PROMPT;

    const content = await chatLlm(
      [
        {
          role: "user",
          content: `${systemPrompt}

プロフィール情報:
${profileSummary}

${docLabel}をMarkdownフォーマットで出力してください。`,
        },
      ],
      4096,
    );

    // DBに保存（job_id は NULL）
    const { data: doc, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        job_id: null,
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
      { status: 500 },
    );
  }
}
