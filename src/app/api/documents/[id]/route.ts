import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/documents/[id]
 * 書類の内容を更新する。
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body: { content: string } = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "書類の内容が空です" },
        { status: 400 },
      );
    }

    const { data: doc, error } = await supabase
      .from("documents")
      .update({ content })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !doc) {
      console.error("Document update error:", error);
      return NextResponse.json(
        { error: "書類の更新に失敗しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error("Document update API error:", error);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 },
    );
  }
}
