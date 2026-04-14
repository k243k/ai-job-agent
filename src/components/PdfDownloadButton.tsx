"use client";

import { useState, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import PdfDocument from "./PdfDocument";
import type { DocType } from "@/types/database";
import type { ResumeData } from "@/lib/resumeGenerator";
import type { CvData } from "@/lib/cvGenerator";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  resume: "履歴書",
  cv: "職務経歴書",
  motivation_letter: "志望動機書",
};

interface PdfDownloadButtonProps {
  content: string;
  docType: DocType;
  disabled?: boolean;
  /** doc_type='resume' の場合、構造化済みデータを渡す */
  resumeData?: ResumeData;
  /** doc_type='cv' の場合、構造化済みデータを渡す */
  cvData?: CvData;
}

/**
 * PDFを生成してダウンロードするボタン。
 * - resume: サーバーサイド (API Route + PDFKit) で JIS規格履歴書を生成
 * - cv: サーバーサイド (API Route + PDFKit) で日本式職務経歴書を生成
 * - motivation_letter: クライアントサイド (@react-pdf/renderer) で生成
 */
const PdfDownloadButton: React.FC<PdfDownloadButtonProps> = ({
  content,
  docType,
  disabled = false,
  resumeData,
  cvData,
}) => {
  const [generating, setGenerating] = useState(false);

  /** サーバーサイドAPI経由でPDFを取得しダウンロードする */
  const downloadFromApi = useCallback(
    async (
      requestBody: Record<string, unknown>,
      filename: string,
    ): Promise<void> => {
      const response = await fetch("/api/documents/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ error: "不明なエラー" }));
        throw new Error(
          (errorBody as { error: string }).error || `HTTP ${response.status}`,
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },
    [],
  );

  const handleDownload = useCallback(async () => {
    if (!content.trim()) return;

    setGenerating(true);
    try {
      const title = DOC_TYPE_LABELS[docType];
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const filename = `${title}_${dateStr}.pdf`;

      // 履歴書: サーバーサイドAPI経由
      if (docType === "resume" && resumeData) {
        await downloadFromApi(resumeData as unknown as Record<string, unknown>, filename);
        return;
      }

      // 職務経歴書: サーバーサイドAPI経由
      if (docType === "cv" && cvData) {
        await downloadFromApi({ docType: "cv", data: cvData }, filename);
        return;
      }

      // motivation_letter / フォールバック: クライアントサイドで生成
      const docElement = (
        <PdfDocument title={title} content={content} date={dateStr} />
      );

      const blob = await pdf(docElement).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF生成エラー:", err);
      alert("PDF生成に失敗しました。もう一度お試しください。");
    } finally {
      setGenerating(false);
    }
  }, [content, docType, resumeData, cvData, downloadFromApi]);

  return (
    <button
      onClick={handleDownload}
      disabled={disabled || generating || !content.trim()}
      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium"
      type="button"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {generating ? "PDF生成中..." : "PDFダウンロード"}
    </button>
  );
};

export default PdfDownloadButton;
