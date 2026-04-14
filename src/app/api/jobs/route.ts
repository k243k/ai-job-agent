import { NextResponse } from "next/server";
import { chatLlm } from "@/lib/llm";
import { createClient } from "@/lib/supabase/server";
import { sampleJobs } from "@/lib/sampleJobs";
import { fetchAllJobs } from "@/lib/jobFetcher";
import type { Job, JobWithScore } from "@/types/database";

export const dynamic = "force-dynamic";

/** 検索キーワードをプロフィールから組み立てる */
const buildSearchKeyword = (profile: {
  desired_role?: string | null;
  skills?: string[] | null;
}): string => {
  const parts: string[] = [];
  if (profile.desired_role) parts.push(profile.desired_role);
  if (profile.skills?.length) parts.push(profile.skills.slice(0, 3).join(" "));
  return parts.join(" ") || "エンジニア";
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // ユーザープロフィール取得
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    // プロフィールがない場合はサンプル求人をスコアなしで返す
    if (!profile) {
      const jobsWithScore: JobWithScore[] = sampleJobs.map((job) => ({
        ...job,
        score: 50,
        reason: "プロフィールが未登録のため、マッチングスコアを算出できません。ヒアリングを先に完了してください。",
      }));
      return NextResponse.json({ jobs: jobsWithScore, sources: null });
    }

    // Careerjet API経由でリアル求人を取得
    const keyword = buildSearchKeyword(profile);
    const location = profile.desired_location ?? "東京都";
    const fetchResult = await fetchAllJobs(keyword, location);

    // API取得失敗時はサンプルデータにフォールバック
    const jobs: Job[] = fetchResult.usedFallback ? sampleJobs : fetchResult.jobs;

    // LLMでマッチングスコアを算出
    const profileSummary = `年齢: ${profile.age ?? "不明"}, スキル: ${(profile.skills ?? []).join(", ") || "不明"}, 経験年数: ${profile.experience_years ?? "不明"}年, 希望年収: ${profile.desired_salary ?? "不明"}, 希望勤務地: ${profile.desired_location ?? "不明"}, 希望職種: ${profile.desired_role ?? "不明"}, 価値観: ${profile.values ?? "不明"}`;

    // トークン膨張防止: 最大30件、description は200文字まで
    const limitedJobs = jobs.slice(0, 30);
    const jobsList = limitedJobs
      .map(
        (j, i) => {
          const desc = (j.description ?? "").slice(0, 200);
          return `[${i}] ${j.title} / ${j.company ?? "不明"} / ${j.location ?? "不明"} / ${j.salary ?? "非公開"} / ${desc}`;
        }
      )
      .join("\n");

    const responseText = await chatLlm(
      [
        {
          role: "user",
          content: `以下の求職者プロフィールと求人リストを比較して、各求人のマッチングスコア（0-100）と理由を日本語で出力してください。

求職者プロフィール:
${profileSummary}

求人リスト:
${jobsList}

以下のJSON配列形式で出力してください（他のテキストは不要）:
[{"index":0,"score":85,"reason":"理由"},{"index":1,"score":70,"reason":"理由"},...]`,
        },
      ],
      2048,
    );

    let scores: Array<{ index: number; score: number; reason: string }> = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        scores = JSON.parse(jsonMatch[0]) as Array<{
          index: number;
          score: number;
          reason: string;
        }>;
      }
    } catch {
      // スコア解析失敗時はデフォルト値
    }

    const jobsWithScore: JobWithScore[] = limitedJobs.map((job, i) => {
      const scoreData = scores.find((s) => s.index === i);
      return {
        ...job,
        score: scoreData?.score ?? 50,
        reason: scoreData?.reason ?? "スコア算出中にエラーが発生しました。",
      };
    });

    // スコア降順でソート
    jobsWithScore.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      jobs: jobsWithScore,
      sources: fetchResult.usedFallback ? null : fetchResult.sources,
    });
  } catch (error) {
    console.error("Jobs API error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
