import { NextResponse } from "next/server";
import { chatLlm } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import type { ProfileData, Json } from "@/types/database";

/** ファイルサイズ上限: 10MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 許可する MIME タイプ */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const PARSE_PROMPT = `以下は履歴書または職務経歴書のテキストです。この内容からプロフィール情報を抽出してJSON形式で出力してください。

出力形式:
{"profile":{
  "lastName":"姓",
  "firstName":"名",
  "lastNameKana":"姓フリガナ",
  "firstNameKana":"名フリガナ",
  "age":数値またはnull,
  "gender":"性別またはnull",
  "email":"メールアドレスまたはnull",
  "phone":"電話番号またはnull",
  "postalCode":"郵便番号またはnull",
  "address":"住所またはnull",
  "nearestStation":"最寄り駅またはnull",
  "education":[{"period":"卒業年月","school":"学校名 学部 卒業/入学"}],
  "workHistory":[{"period":"入社〜退社","company":"会社名","department":"部署またはnull","description":"業務内容"}],
  "skills":["スキル1","スキル2"],
  "experience_years":数値,
  "desired_salary":"希望年収またはnull",
  "desired_location":"勤務地またはnull",
  "desired_role":"職種またはnull",
  "values":"志望動機・価値観またはnull"
}}

重要:
- JSONのみを出力してください。説明文は不要です。
- 情報が見つからない項目はnullにしてください。
- skillsは必ず配列にしてください。プログラミング言語や資格を含めてください。
- educationとworkHistoryは必ず配列にしてください。
- 志望動機や自己PRの内容はvaluesに入れてください。

テキスト:
`;

/**
 * PDF からテキストを抽出する
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v1 は CommonJS default export
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * .docx からテキストを抽出する
 */
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * LLM応答からプロフィールJSONを抽出する
 */
function parseProfileFromLlmResponse(text: string): ProfileData | null {
  // まず ```json ... ``` ブロックを探す
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonBlockMatch ? jsonBlockMatch[1] : text;

  try {
    const parsed: unknown = JSON.parse(jsonStr.trim());
    if (typeof parsed === "object" && parsed !== null && "profile" in parsed) {
      return (parsed as { profile: ProfileData }).profile;
    }
    // profile キーなしでも直接 ProfileData 形状ならOK
    if (typeof parsed === "object" && parsed !== null && "skills" in parsed) {
      return parsed as ProfileData;
    }
  } catch {
    // JSON解析失敗 — もう一度 { ... } を探す
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        const parsed: unknown = JSON.parse(braceMatch[0]);
        if (typeof parsed === "object" && parsed !== null && "profile" in parsed) {
          return (parsed as { profile: ProfileData }).profile;
        }
      } catch {
        // 最終的に解析不可
      }
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    // 認証チェック
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    // multipart/form-data からファイルを取得
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "ファイルが必要です" },
        { status: 400 }
      );
    }

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは10MB以下にしてください" },
        { status: 400 }
      );
    }

    // MIMEタイプチェック
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "PDF または .docx ファイルのみ対応しています" },
        { status: 400 }
      );
    }

    // ファイルをバッファに読み込み
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // magic bytes検証（MIME偽装防止）
    if (file.type === "application/pdf") {
      const header = buffer.subarray(0, 5).toString("ascii");
      if (header !== "%PDF-") {
        return NextResponse.json(
          { error: "有効なPDFファイルではありません" },
          { status: 400 }
        );
      }
    } else {
      // docxはZIP形式（PK header）
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        return NextResponse.json(
          { error: "有効なdocxファイルではありません" },
          { status: 400 }
        );
      }
    }

    // テキスト抽出
    let extractedText: string;
    try {
      if (file.type === "application/pdf") {
        extractedText = await extractTextFromPdf(buffer);
      } else {
        extractedText = await extractTextFromDocx(buffer);
      }
    } catch (extractError) {
      console.error("テキスト抽出エラー:", extractError);
      return NextResponse.json(
        { error: "ファイルからテキストを抽出できませんでした。ファイルが破損していないか確認してください。" },
        { status: 422 }
      );
    }

    if (!extractedText.trim()) {
      return NextResponse.json(
        { error: "ファイルからテキストが見つかりませんでした。スキャン画像のみのPDFは対応していません。" },
        { status: 422 }
      );
    }

    // LLMでプロフィール構造に変換
    const llmResponse = await chatLlm(
      [
        {
          role: "user",
          content: PARSE_PROMPT + extractedText.slice(0, 8000),
        },
      ],
      2048
    );

    const profile = parseProfileFromLlmResponse(llmResponse);

    if (!profile) {
      return NextResponse.json(
        { error: "履歴書の解析に失敗しました。再度お試しください。" },
        { status: 422 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Profile upload API error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

/**
 * 解析結果をプロフィールとして保存するAPI
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      );
    }

    const body: { profile: ProfileData } = await request.json();
    const { profile } = body;

    if (!profile) {
      return NextResponse.json(
        { error: "プロフィールデータが必要です" },
        { status: 400 }
      );
    }

    // 拡張データ（氏名/住所/学歴/職歴）をraw_conversationに格納
    const extendedData: Record<string, unknown> = {
      lastName: (profile as Record<string, unknown>).lastName ?? "",
      firstName: (profile as Record<string, unknown>).firstName ?? "",
      lastNameKana: (profile as Record<string, unknown>).lastNameKana ?? "",
      firstNameKana: (profile as Record<string, unknown>).firstNameKana ?? "",
      fullName: `${(profile as Record<string, unknown>).lastName ?? ""} ${(profile as Record<string, unknown>).firstName ?? ""}`.trim(),
      furigana: `${(profile as Record<string, unknown>).lastNameKana ?? ""} ${(profile as Record<string, unknown>).firstNameKana ?? ""}`.trim(),
      gender: (profile as Record<string, unknown>).gender ?? "",
      email: (profile as Record<string, unknown>).email ?? "",
      phone: (profile as Record<string, unknown>).phone ?? "",
      postalCode: (profile as Record<string, unknown>).postalCode ?? "",
      address: (profile as Record<string, unknown>).address ?? "",
      nearestStation: (profile as Record<string, unknown>).nearestStation ?? "",
      education: (profile as Record<string, unknown>).education ?? [],
      workHistory: (profile as Record<string, unknown>).workHistory ?? [],
      source: "resume_upload",
    };

    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: user.id,
      age: profile.age ?? null,
      skills: profile.skills ?? [],
      experience_years: profile.experience_years ?? null,
      desired_salary: profile.desired_salary ?? null,
      desired_location: profile.desired_location ?? null,
      desired_role: profile.desired_role ?? null,
      values: profile.values ?? null,
      raw_conversation: extendedData as unknown as Json,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      console.error("Profile upsert error:", upsertError);
      return NextResponse.json(
        { error: "プロフィールの保存に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile save API error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
