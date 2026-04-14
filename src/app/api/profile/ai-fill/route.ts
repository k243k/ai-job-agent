import { NextResponse } from "next/server";
import { chatLlm } from "@/lib/llm";
import type { ChatMessage } from "@/types/database";

/** AI自動入力APIのレスポンス型 */
interface AiFillResponse {
  reply: string;
  profileData: AiProfileData | null;
}

/** AIが出力するプロフィールJSON構造 */
interface AiProfileData {
  lastName: string | null;
  firstName: string | null;
  lastNameKana: string | null;
  firstNameKana: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  nearestStation: string | null;
  education: Array<{ yearMonth: string; content: string }> | null;
  workHistory: Array<{
    period: string;
    company: string;
    department: string;
    duties: string;
  }> | null;
  skills: string | null;
  experienceYears: number | null;
  desiredSalary: string | null;
  desiredLocation: string | null;
  desiredRole: string | null;
  values: string | null;
}

const SYSTEM_PROMPT = `あなたはプロフィール登録アシスタントです。
ユーザーの発言からプロフィール情報を抽出してJSON形式で出力してください。

出力形式（必ず\`\`\`json ... \`\`\`で囲むこと）:
\`\`\`json
{"lastName":"姓","firstName":"名","lastNameKana":"セイ（カタカナ）","firstNameKana":"メイ（カタカナ）","age":数値,"gender":"男性|女性|その他|回答しない","phone":"電話番号","postalCode":"郵便番号","address":"住所","nearestStation":"最寄り駅","education":[{"yearMonth":"YYYY/MM","content":"学歴内容"}],"workHistory":[{"period":"YYYY/MM - YYYY/MM","company":"会社名","department":"部署","duties":"業務内容"}],"skills":"スキル,資格","experienceYears":数値,"desiredSalary":"希望年収","desiredLocation":"勤務地","desiredRole":"希望職種","values":"価値観"}
\`\`\`

ルール:
- 不明な項目はnullにする。推測で埋めない。
- 毎回必ずJSON出力する。情報が少なくてもわかる範囲でJSONを出す。
- JSON出力した後、nullや不足している項目を確認し、以下の優先順でフレンドリーに追加質問する:
  1. 電話番号、住所（郵便番号含む）、最寄り駅
  2. 学歴の詳細（卒業年月が不明なら「○○高校は何年に卒業しましたか？」）
  3. 職歴の詳細（入社年月、部署、具体的な業務内容）
  4. 希望職種（未定なら「どんな仕事に興味ありますか？」）
- 1回の追加質問で2〜3項目まとめて聞いてOK。
- 住所がわかっている場合、郵便番号も推測して埋める。
- 追加質問は「もしよかったら教えてください」程度の軽いトーンで。
- ユーザーが訂正や追加情報を送ってきたら、訂正を反映した完全なJSONを再出力すること。
- フリガナは必ずカタカナで出力。難読姓（東海林→ショウジ等）に注意。
- 最大3往復。`;

/** ひらがなをカタカナに変換 */
function toKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

/**
 * レスポンステキストからJSON部分を抽出する
 */
function extractProfileData(text: string): AiProfileData | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return null;

  try {
    const parsed: unknown = JSON.parse(jsonMatch[1]);
    if (typeof parsed !== "object" || parsed === null) return null;
    const data = parsed as AiProfileData;
    // フリガナをカタカナに正規化
    if (data.lastNameKana) {
      data.lastNameKana = toKatakana(data.lastNameKana);
    }
    if (data.firstNameKana) {
      data.firstNameKana = toKatakana(data.firstNameKana);
    }
    return data;
  } catch {
    // JSON解析失敗
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse<AiFillResponse | { error: string }>> {
  try {
    const body: { messages: ChatMessage[] } = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "メッセージが必要です" },
        { status: 400 },
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
      1024,
    );

    const profileData = extractProfileData(reply);

    // JSONブロックを除いたテキスト部分を返す
    const cleanReply = reply.replace(/```json[\s\S]*?```/, "").trim();

    return NextResponse.json({
      reply: cleanReply || "プロフィール情報を整理しました。",
      profileData,
    });
  } catch (error) {
    console.error("AI Fill API error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 },
    );
  }
}
