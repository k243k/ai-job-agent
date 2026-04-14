import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/documents
 * 認証済みユーザーの保存済み書類一覧を返す。
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data: documents, error } = await supabase
      .from("documents")
      .select("id, doc_type, content, created_at")
      .eq("user_id", user.id)
      .is("job_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Documents fetch error:", error);
      return NextResponse.json(
        { error: "書類の取得に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ documents: documents ?? [] });
  } catch (error) {
    console.error("Documents API error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 },
    );
  }
}
