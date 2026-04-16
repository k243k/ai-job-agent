/**
 * API Route共通認証ヘルパー
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface AuthResult {
  user: { id: string; email?: string };
}

/**
 * 認証チェック。未認証なら401レスポンスを返す。
 * 使い方:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  return { user: { id: user.id, email: user.email ?? undefined } };
}
