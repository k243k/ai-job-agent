/**
 * POST /api/documents/pdf
 *
 * docType に応じて履歴書または職務経歴書のPDFバイナリを返す。
 * - docType: 'resume' (default) → JIS規格履歴書 (PDFKit)
 * - docType: 'cv' → 日本式職務経歴書 (PDFKit)
 */
import { NextRequest, NextResponse } from "next/server";
import { generateResumePdf, type ResumeData } from "@/lib/resumeGenerator";
import { generateCvPdf, type CvData } from "@/lib/cvGenerator";

// ── バリデーション ──

interface ResumeRequestBody {
  docType?: "resume";
  data?: ResumeData;
  // 後方互換: docType省略時はbody全体がResumeData
  personal?: ResumeData["personal"];
}

interface CvRequestBody {
  docType: "cv";
  data: CvData;
}

type RequestBody = ResumeRequestBody | CvRequestBody;

function validateResumeData(body: unknown): body is ResumeData {
  if (typeof body !== "object" || body === null) return false;

  const data = body as Record<string, unknown>;
  if (typeof data.personal !== "object" || data.personal === null) return false;

  const personal = data.personal as Record<string, unknown>;
  if (typeof personal.name !== "string") return false;
  if (typeof personal.birthDay !== "string") return false;

  if (!Array.isArray(data.education)) return false;
  if (!Array.isArray(data.experience)) return false;
  if (!Array.isArray(data.licences)) return false;

  return true;
}

function validateCvData(body: unknown): body is CvData {
  if (typeof body !== "object" || body === null) return false;

  const data = body as Record<string, unknown>;
  if (typeof data.name !== "string") return false;
  if (typeof data.date !== "string") return false;
  if (typeof data.summary !== "string") return false;
  if (!Array.isArray(data.companies)) return false;
  if (!Array.isArray(data.skills)) return false;
  if (!Array.isArray(data.qualifications)) return false;
  if (typeof data.selfPr !== "string") return false;

  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "リクエストボディが不正です。" },
        { status: 400 },
      );
    }

    const parsed = body as Record<string, unknown>;
    const docType = parsed.docType as string | undefined;

    // ── 職務経歴書 ──
    if (docType === "cv") {
      const cvData = parsed.data as unknown;
      if (!validateCvData(cvData)) {
        return NextResponse.json(
          {
            error:
              "不正なリクエストデータです。data に name, date, summary, companies, skills, qualifications, selfPr が必要です。",
          },
          { status: 400 },
        );
      }

      const pdfBuffer = await generateCvPdf(cvData);
      const pdfBytes = new Uint8Array(pdfBuffer);

      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="cv_${new Date().toISOString().slice(0, 10)}.pdf"`,
          "Content-Length": pdfBytes.length.toString(),
        },
      });
    }

    // ── 履歴書（デフォルト / 後方互換）──
    // docType='resume' の場合: data フィールドから取得
    // docType 省略の場合: body 全体が ResumeData（後方互換）
    const resumeData = (docType === "resume" && parsed.data != null)
      ? (parsed.data as unknown)
      : body;

    if (!validateResumeData(resumeData)) {
      return NextResponse.json(
        {
          error:
            "不正なリクエストデータです。personal, education, experience, licences が必要です。",
        },
        { status: 400 },
      );
    }

    const pdfBuffer = await generateResumePdf(resumeData);
    const pdfBytes = new Uint8Array(pdfBuffer);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resume_${new Date().toISOString().slice(0, 10)}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "PDF生成中に不明なエラーが発生しました";
    console.error("PDF生成エラー:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
