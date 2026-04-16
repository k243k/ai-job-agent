"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import type { DocType } from "@/types/database";

const PdfDownloadButton = dynamic(
  () => import("@/components/PdfDownloadButton"),
  {
    ssr: false,
    loading: () => (
      <span className="text-sm text-gray-400">PDF機能読み込み中...</span>
    ),
  },
);

interface SavedDocument {
  id: string;
  doc_type: string;
  content: string;
  created_at: string;
}

const docTypes: Array<{ value: DocType; label: string }> = [
  { value: "resume", label: "履歴書" },
  { value: "cv", label: "職務経歴書" },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  resume: "履歴書",
  cv: "職務経歴書",
  motivation_letter: "志望動機書",
};

export default function DocumentsPage() {
  const [selectedDocType, setSelectedDocType] = useState<DocType>("resume");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("preview");

  /** 保存済み書類一覧を取得 */
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data: { documents: SavedDocument[] } = await res.json();
        setSavedDocuments(data.documents);
      }
    } catch {
      console.error("書類一覧の取得に失敗しました");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const [missingInfo, setMissingInfo] = useState<{
    fields: string[];
    message: string;
  } | null>(null);

  /** AIで下書きを生成 */
  const handleGenerate = async () => {
    setLoading(true);
    setContent("");
    setGenerated(false);
    setEditingDocId(null);
    setMissingInfo(null);

    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docType: selectedDocType }),
      });

      const data = await res.json() as {
        content?: string;
        document?: { id: string };
        needsMoreInfo?: boolean;
        missingFields?: string[];
        message?: string;
        error?: string;
      };

      // 不足情報がある場合
      if (data.needsMoreInfo) {
        setMissingInfo({
          fields: data.missingFields ?? [],
          message: data.message ?? "追加情報が必要です",
        });
        return;
      }

      if (!res.ok) {
        alert(data.error || "生成に失敗しました");
        return;
      }

      setContent(data.content ?? "");
      setGenerated(true);
      if (data.document?.id) {
        setEditingDocId(data.document.id);
      }
      // 一覧を更新
      void fetchDocuments();
    } catch {
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  /** 内容を保存（更新） */
  const handleSave = async () => {
    if (!content.trim() || !editingDocId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${editingDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const err: { error: string } = await res.json();
        alert(err.error || "保存に失敗しました");
        return;
      }

      alert("保存しました");
      void fetchDocuments();
    } catch {
      alert("保存中にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  /** 保存済み書類を編集モードで開く */
  const handleEdit = (doc: SavedDocument) => {
    setContent(doc.content);
    setSelectedDocType(doc.doc_type as DocType);
    setGenerated(true);
    setEditingDocId(doc.id);
    // エディタ部分にスクロール
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">書類作成</h1>

      {/* 保存済み書類一覧 */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          保存済みの書類一覧
        </h2>
        {loadingDocs ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : savedDocuments.length === 0 ? (
          <p className="text-sm text-gray-500">
            まだ書類がありません。下の「AIで下書きを生成」から作成してください。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">
                    書類タイプ
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">
                    作成日
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {savedDocuments.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-2 px-3 text-gray-900">
                      {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                    </td>
                    <td className="py-2 px-3 text-gray-600">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(doc)}
                          className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          type="button"
                        >
                          編集
                        </button>
                        <PdfDownloadButton
                          content={doc.content}
                          docType={doc.doc_type as DocType}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 新規作成 */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">新規作成</h2>
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              書類タイプ
            </label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as DocType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {docTypes.map((dt) => (
                <option key={dt.value} value={dt.value}>
                  {dt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            type="button"
          >
            {loading ? "生成中..." : "AIで下書きを生成"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          ヒアリングで取得済みのプロフィール情報を元にAIが下書きを生成します。
        </p>
      </div>

      {/* 不足情報の案内 */}
      {missingInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            追加情報が必要です
          </h2>
          <p className="text-sm text-amber-700 mb-3">
            書類を正確に作成するために、以下の情報をプロフィールに入力してください:
          </p>
          <ul className="list-disc list-inside text-sm text-amber-700 mb-4 space-y-1">
            {missingInfo.fields.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <a
            href="/profile"
            className="inline-block px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
          >
            プロフィールを入力する
          </a>
        </div>
      )}

      {/* プレビュー・編集エリア */}
      {generated && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                書類
              </h2>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("preview")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === "preview"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  type="button"
                >
                  プレビュー
                </button>
                <button
                  onClick={() => setViewMode("edit")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    viewMode === "edit"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                  type="button"
                >
                  編集
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !content.trim() || !editingDocId}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 transition-colors text-sm font-medium"
                type="button"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <PdfDownloadButton content={content} docType={selectedDocType} />
            </div>
          </div>
          {viewMode === "edit" ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          ) : (
            <div className="w-full min-h-96 px-6 py-4 border border-gray-300 rounded-lg bg-white overflow-y-auto prose prose-sm max-w-none prose-headings:text-gray-900 prose-h2:text-lg prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-h2:mb-3 prose-h3:text-base prose-ul:my-1 prose-li:my-0.5">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
