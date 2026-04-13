"use client";

import { useState, useEffect, useCallback } from "react";
import type { ApplicationStatus } from "@/types/database";

interface ApplicationWithJob {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  jobs: {
    title: string;
    company: string | null;
    location: string | null;
    salary: string | null;
  } | null;
}

const statusOptions: Array<{ value: ApplicationStatus; label: string }> = [
  { value: "interested", label: "興味あり" },
  { value: "applied", label: "応募済み" },
  { value: "interviewing", label: "面接中" },
  { value: "offered", label: "内定" },
  { value: "rejected", label: "不採用" },
  { value: "withdrawn", label: "辞退" },
];

const statusColors: Record<ApplicationStatus, string> = {
  interested: "bg-gray-100 text-gray-700",
  applied: "bg-blue-100 text-blue-700",
  interviewing: "bg-yellow-100 text-yellow-700",
  offered: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  withdrawn: "bg-gray-200 text-gray-500",
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/applications");
      if (!res.ok) throw new Error("取得失敗");
      const data: { applications: ApplicationWithJob[] } = await res.json();
      setApplications(data.applications);
    } catch {
      // エラー時は空配列
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error("更新失敗");
      setApplications((prev) =>
        prev.map((app) => (app.id === id ? { ...app, status } : app))
      );
    } catch {
      alert("ステータス更新に失敗しました");
    }
  };

  const saveNotes = async (id: string) => {
    try {
      const res = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: notesValue }),
      });
      if (!res.ok) throw new Error("更新失敗");
      setApplications((prev) =>
        prev.map((app) =>
          app.id === id ? { ...app, notes: notesValue } : app
        )
      );
      setEditingNotes(null);
    } catch {
      alert("メモの保存に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">応募情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">応募管理</h1>

      {applications.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <p className="text-gray-500">
            まだ応募はありません。「求人一覧」から求人に応募してみましょう。
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                  企業名 / 職種
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                  ステータス
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                  応募日
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                  メモ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {app.jobs?.title ?? "不明"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {app.jobs?.company ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={app.status}
                      onChange={(e) =>
                        updateStatus(app.id, e.target.value as ApplicationStatus)
                      }
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${statusColors[app.status as ApplicationStatus] ?? ""}`}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {app.applied_at
                      ? new Date(app.applied_at).toLocaleDateString("ja-JP")
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {editingNotes === app.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          className="text-sm px-2 py-1 border rounded flex-1"
                          autoFocus
                        />
                        <button
                          onClick={() => saveNotes(app.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingNotes(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingNotes(app.id);
                          setNotesValue(app.notes ?? "");
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        {app.notes || "メモを追加..."}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
