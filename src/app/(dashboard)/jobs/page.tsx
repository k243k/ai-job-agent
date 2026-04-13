"use client";

import { useState, useEffect, useCallback } from "react";
import type { JobWithScore } from "@/types/database";

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) throw new Error("取得失敗");
      const data: { jobs: JobWithScore[] } = await res.json();
      setJobs(data.jobs);
    } catch {
      // エラー時は空配列
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleApply = async (jobId: string) => {
    setApplying(jobId);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error("応募失敗");
      alert("応募リストに追加しました");
    } catch {
      alert("応募に失敗しました");
    } finally {
      setApplying(null);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-600 bg-green-50";
    if (score >= 60) return "text-blue-600 bg-blue-50";
    if (score >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-gray-600 bg-gray-50";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">求人を読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">求人一覧</h1>
      <div className="grid gap-4">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {job.title}
                  </h2>
                  <span
                    className={`text-sm font-bold px-2 py-1 rounded-full ${getScoreColor(job.score)}`}
                  >
                    {job.score}%
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">{job.company}</p>
                <p className="text-sm text-gray-500 mb-1">
                  {job.location} / {job.salary}
                </p>
                <p className="text-sm text-gray-700 mt-2">{job.description}</p>
                <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded">
                  マッチング理由: {job.reason}
                </p>
              </div>
              <button
                onClick={() => handleApply(job.id)}
                disabled={applying === job.id}
                className="ml-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
              >
                {applying === job.id ? "追加中..." : "応募する"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
