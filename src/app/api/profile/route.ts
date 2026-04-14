import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * プロフィール取得 API
 * 認証ユーザーのプロフィールを返す
 */
export async function GET() {
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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = not found (OK, just means no profile yet)
      console.error("Profile fetch error:", error);
      return NextResponse.json(
        { error: "プロフィールの取得に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile: profile ?? null });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

/** フォームから送信されるプロフィールデータの型 */
interface ProfileFormData {
  // 基本情報（姓名分割）
  lastName?: string;
  firstName?: string;
  lastNameKana?: string;
  firstNameKana?: string;
  /** 後方互換: フロントが結合済みで送る */
  fullName?: string;
  furigana?: string;
  age?: number | null;
  gender?: string;
  email?: string;
  phone?: string;
  // 住所
  postalCode?: string;
  address?: string;
  nearestStation?: string;
  // 学歴
  education?: Array<{ period: string; school: string }>;
  // 職歴
  workHistory?: Array<{
    period: string;
    company: string;
    department: string;
    description: string;
  }>;
  // スキル・資格
  skills?: string[];
  // 希望条件
  desired_salary?: string;
  desired_location?: string;
  desired_role?: string;
  // 経験年数
  experience_years?: number | null;
  // 価値観
  values?: string;
}

/**
 * プロフィール更新 API
 * フォームデータを profiles テーブルに upsert
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

    const body: ProfileFormData = await request.json();

    // profiles テーブルに存在するカラムにマッピング
    // 基本情報（氏名、フリガナ等）は raw_conversation に JSON として格納
    const extendedData: Record<string, unknown> = {
      lastName: body.lastName ?? "",
      firstName: body.firstName ?? "",
      lastNameKana: body.lastNameKana ?? "",
      firstNameKana: body.firstNameKana ?? "",
      fullName: body.fullName ?? `${body.lastName ?? ""} ${body.firstName ?? ""}`.trim(),
      furigana: body.furigana ?? `${body.lastNameKana ?? ""} ${body.firstNameKana ?? ""}`.trim(),
      gender: body.gender ?? "",
      email: body.email ?? "",
      phone: body.phone ?? "",
      postalCode: body.postalCode ?? "",
      address: body.address ?? "",
      nearestStation: body.nearestStation ?? "",
      education: body.education ?? [],
      workHistory: body.workHistory ?? [],
      source: "form",
    };

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      age: body.age ?? null,
      skills: body.skills ?? [],
      experience_years: body.experience_years ?? null,
      desired_salary: body.desired_salary ?? null,
      desired_location: body.desired_location ?? null,
      desired_role: body.desired_role ?? null,
      values: body.values ?? null,
      raw_conversation: extendedData as unknown as Json,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Profile upsert error:", error);
      return NextResponse.json(
        { error: "プロフィールの保存に失敗しました" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
