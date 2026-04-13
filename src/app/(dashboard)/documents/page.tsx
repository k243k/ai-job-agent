"use client";

import { useState } from "react";
import { sampleJobs } from "@/lib/sampleJobs";
import type { DocType } from "@/types/database";

const docTypes: Array<{ value: DocType; label: string }> = [
  { value: "resume", label: "履歴書" },
  { value: "cv", label: "職務経歴書" },
  { value: "motivation_letter", label: "志望動機書" },
];

export default function DocumentsPage() {
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedDocType, setSelectedDocType] = useState<DocType>("resume");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!selectedJob) {
      alert("求人を選択してください");
      return;
    }

    setLoading(true);
    setContent("");
    setGenerated(false);

    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJob,
          docType: selectedDocType,
        }),
      });

      if (!res.ok) {
        const err: { error: string } = await res.json();
        alert(err.error || "生成に失敗しました");
        return;
      }

      const data: { content: string } = await res.json();
      setContent(data.content);
      setGenerated(true);
    } catch {
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">書類作成</h1>

      {/* Selection */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              求人を選択
            </label>
            <select
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {sampleJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title} - {job.company}
                </option>
              ))}
            </select>
          </div>
          <div>
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
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading || !selectedJob}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "生成中..." : "書類を生成"}
        </button>
      </div>

      {/* Preview */}
      {generated && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">プレビュー</h2>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-96 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>
      )}
    </div>
  );
}
