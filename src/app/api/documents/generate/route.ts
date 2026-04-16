import { NextResponse } from "next/server";
import { chatLlm } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import type { DocType, Json } from "@/types/database";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  resume: "履歴書",
  cv: "職務経歴書",
  motivation_letter: "志望動機書",
};

/** raw_conversation から拡張プロフィールを取り出す */
interface ExtendedProfile {
  fullName: string;
  furigana: string;
  gender: string;
  email: string;
  phone: string;
  postalCode: string;
  address: string;
  nearestStation: string;
  education: Array<{ period: string; school: string }>;
  workHistory: Array<{
    period: string;
    company: string;
    department: string;
    description: string;
  }>;
}

function parseExtended(raw: Json): Partial<ExtendedProfile> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  return {
    fullName: (obj.fullName as string) || "",
    furigana: (obj.furigana as string) || "",
    gender: (obj.gender as string) || "",
    email: (obj.email as string) || "",
    phone: (obj.phone as string) || "",
    postalCode: (obj.postalCode as string) || "",
    address: (obj.address as string) || "",
    nearestStation: (obj.nearestStation as string) || "",
    education: Array.isArray(obj.education)
      ? (obj.education as ExtendedProfile["education"])
      : [],
    workHistory: Array.isArray(obj.workHistory)
      ? (obj.workHistory as ExtendedProfile["workHistory"])
      : [],
  };
}

/** 書類生成に必要な必須項目の不足チェック */
function checkMissingFields(
  ext: Partial<ExtendedProfile>,
  profile: { skills?: string[] | null; experience_years?: number | null }
): string[] {
  const missing: string[] = [];
  if (!ext.fullName) missing.push("氏名");
  if (!ext.education?.length || !ext.education[0]?.school)
    missing.push("学歴");
  if (!ext.workHistory?.length || !ext.workHistory[0]?.company)
    missing.push("職歴（会社名）");
  if (!ext.workHistory?.length || !ext.workHistory[0]?.description)
    missing.push("職歴（業務内容）");
  if (!profile.skills?.length) missing.push("スキル");
  return missing;
}

/** 拡張プロフィールを含めた詳細なプロフィールサマリー */
function buildDetailedSummary(
  profile: {
    age?: number | null;
    skills?: string[] | null;
    experience_years?: number | null;
    desired_salary?: string | null;
    desired_location?: string | null;
    desired_role?: string | null;
    values?: string | null;
  },
  ext: Partial<ExtendedProfile>
): string {
  const lines: string[] = [];

  // 基本情報
  if (ext.fullName) lines.push(`氏名: ${ext.fullName}`);
  if (ext.furigana) lines.push(`フリガナ: ${ext.furigana}`);
  if (profile.age) lines.push(`年齢: ${profile.age}歳`);
  if (ext.gender) lines.push(`性別: ${ext.gender}`);
  if (ext.email) lines.push(`メール: ${ext.email}`);
  if (ext.phone) lines.push(`電話: ${ext.phone}`);
  if (ext.address)
    lines.push(
      `住所: ${ext.postalCode ? `〒${ext.postalCode} ` : ""}${ext.address}`
    );
  if (ext.nearestStation) lines.push(`最寄り駅: ${ext.nearestStation}`);

  // 学歴
  if (ext.education?.length) {
    lines.push("");
    lines.push("【学歴】");
    for (const edu of ext.education) {
      if (edu.school) lines.push(`- ${edu.period ?? ""} ${edu.school}`);
    }
  }

  // 職歴（＝現職・過去の経歴。希望ではない）
  if (ext.workHistory?.length) {
    lines.push("");
    lines.push("【職歴（これまでの実際の経歴）】");
    for (const wh of ext.workHistory) {
      const parts = [wh.period, wh.company, wh.department]
        .filter(Boolean)
        .join(" / ");
      if (parts) lines.push(`- ${parts}`);
      if (wh.description) lines.push(`  業務内容: ${wh.description}`);
    }
  }

  // スキル
  lines.push("");
  lines.push(
    `スキル・資格: ${(profile.skills ?? []).join(", ") || "不明"}`
  );
  lines.push(`経験年数: ${profile.experience_years ?? "不明"}年`);

  // 希望条件（これは「転職先に求めるもの」）
  lines.push("");
  lines.push("【希望条件（転職先に求めるもの）】");
  lines.push(`希望年収: ${profile.desired_salary ?? "不明"}`);
  lines.push(`希望勤務地: ${profile.desired_location ?? "不明"}`);
  lines.push(`希望職種: ${profile.desired_role ?? "不明"}`);
  lines.push(`価値観: ${profile.values ?? "不明"}`);

  return lines.join("\n");
}

const RESUME_PROMPT = `以下のプロフィール情報を元に、日本式履歴書の各セクションを生成してください。

出力形式はMarkdownで、以下のセクションを含めてください:
## 基本情報
## 学歴
## 職歴
## 資格
## 志望動機
## 自己PR
## 本人希望

【重要なルール】
- 「職歴」にはプロフィールの【職歴（これまでの実際の経歴）】をそのまま記載すること。希望職種と混同しない。
  例: SES企業で客先常駐していた人は「SES企業での客先常駐開発」と書く。「自社開発」とは書かない。
- 「志望動機」は【希望条件】を参考に、なぜ転職したいかを記載する。
- 「自己PR」には年収・勤務地などの希望条件を含めない。技術力・実績・強みのみ記載する。
- 情報が不足しているセクションは「（要記入）」と記載する。
- 日本の転職市場の慣例に従った形式で作成する。`;

const CV_PROMPT = `以下のプロフィール情報を元に、日本式職務経歴書を生成してください。

出力形式はMarkdownで、以下のセクションを含めてください:
## 職務要約
## 職務経歴
### 会社名（期間）
## スキル
## 資格
## 自己PR

【重要なルール】
- 「職務経歴」にはプロフィールの【職歴（これまでの実際の経歴）】をそのまま記載すること。
  希望職種と混同しない。現職がSES・客先常駐なら、そのまま記載する。「自社開発」と勝手に変換しない。
- 「職務要約」も同様に、実際の経歴を要約する。希望を混ぜない。
- 「自己PR」には年収・勤務地などの希望条件を含めない。技術力・実績・強みのみ記載する。
  転職意欲や希望は「自己PR」ではなく志望動機に書くべき内容。
- 情報が不足しているセクションは「（要記入）」と記載する。
- 日本の転職市場の慣例に従った形式で作成する。`;

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
        { status: 400 }
      );
    }

    if (docType === "motivation_letter") {
      return NextResponse.json(
        { error: "志望動機書は求人ページから生成してください" },
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

    // raw_conversationから拡張プロフィールを取得
    const ext = parseExtended(profile.raw_conversation);

    // 不足項目チェック
    const missingFields = checkMissingFields(ext, profile);
    if (missingFields.length > 0) {
      return NextResponse.json({
        needsMoreInfo: true,
        missingFields,
        message: `書類を正確に作成するために、以下の情報が必要です:\n${missingFields.map((f) => `・${f}`).join("\n")}\n\nプロフィールページで入力してから再度お試しください。`,
      });
    }

    const docLabel = DOC_TYPE_LABELS[docType];
    const profileSummary = buildDetailedSummary(profile, ext);
    const systemPrompt = docType === "resume" ? RESUME_PROMPT : CV_PROMPT;

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
      4096
    );

    // DBに保存
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
      { status: 500 }
    );
  }
}
