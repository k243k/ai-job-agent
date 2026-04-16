"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import type { ProfileData } from "@/types/database";

type UploadState = "idle" | "uploading" | "parsed" | "saving" | "saved" | "error";

const FIELD_LABELS: Record<string, string> = {
  lastName: "姓",
  firstName: "名",
  lastNameKana: "セイ",
  firstNameKana: "メイ",
  age: "年齢",
  gender: "性別",
  phone: "電話番号",
  email: "メール",
  postalCode: "郵便番号",
  address: "住所",
  education: "学歴",
  workHistory: "職歴",
  skills: "スキル・資格",
  experience_years: "経験年数",
  desired_salary: "希望年収",
  desired_location: "希望勤務地",
  desired_role: "希望職種",
  values: "志望動機・価値観",
};

export default function ProfileUploadPage() {
  const [state, setState] = useState<UploadState>("idle");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    // バリデーション
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("PDF または .docx ファイルのみ対応しています");
      setState("error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("ファイルサイズは10MB以下にしてください");
      setState("error");
      return;
    }

    setFileName(file.name);
    setState("uploading");
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/upload", {
        method: "POST",
        body: formData,
      });

      const data: { profile?: ProfileData; error?: string } = await res.json();

      if (!res.ok || !data.profile) {
        setErrorMessage(data.error ?? "解析に失敗しました");
        setState("error");
        return;
      }

      setProfile(data.profile);
      setState("parsed");
    } catch {
      setErrorMessage("通信エラーが発生しました。再度お試しください。");
      setState("error");
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile]
  );

  const handleSaveProfile = async () => {
    if (!profile) return;

    setState("saving");
    setErrorMessage("");

    try {
      const res = await fetch("/api/profile/upload", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      const data: { success?: boolean; error?: string } = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error ?? "保存に失敗しました");
        setState("error");
        return;
      }

      setState("saved");
    } catch {
      setErrorMessage("通信エラーが発生しました");
      setState("error");
    }
  };

  const handleReset = () => {
    setState("idle");
    setProfile(null);
    setErrorMessage("");
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const renderProfileValue = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return "-- (未検出)";
    if (Array.isArray(value)) {
      if (value.length === 0) return "-- (未検出)";
      // education/workHistory は配列オブジェクト
      if (key === "education") {
        return value
          .map((e: Record<string, string>) => `${e.period ?? ""} ${e.school ?? ""}`.trim())
          .join(" / ");
      }
      if (key === "workHistory") {
        return value
          .map((w: Record<string, string>) =>
            `${w.period ?? ""} ${w.company ?? ""} ${w.department ?? ""}`.trim()
          )
          .join(" / ");
      }
      return value.join(", ");
    }
    if (typeof value === "number") {
      if (key === "experience_years") return `${value}年`;
      if (key === "age") return `${value}歳`;
      return String(value);
    }
    return String(value);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/hearing"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; 戻る
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          履歴書・職務経歴書からプロフィール作成
        </h1>
      </div>

      {/* ドロップエリア */}
      {(state === "idle" || state === "error") && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragOver
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:border-gray-400"
          }`}
        >
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <p className="text-gray-600 mb-2">
            ファイルをドラッグ＆ドロップ、またはクリックして選択
          </p>
          <p className="text-sm text-gray-400">
            対応形式: PDF, .docx（10MB以下）
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* エラーメッセージ */}
      {state === "error" && errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      {/* ローディング */}
      {state === "uploading" && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="animate-spin mx-auto h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4" />
          <p className="text-gray-700 font-medium mb-1">
            「{fileName}」を解析中...
          </p>
          <p className="text-sm text-gray-400">
            AIがテキストを抽出し、プロフィール情報を読み取っています
          </p>
        </div>
      )}

      {/* 解析結果プレビュー */}
      {(state === "parsed" || state === "saving") && profile && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            解析結果
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            「{fileName}」から以下の情報を抽出しました。内容を確認してください。
          </p>

          <div className="space-y-3 mb-6">
            {Object.entries(FIELD_LABELS).map(([key, label]) => (
              <div
                key={key}
                className="flex items-start border-b border-gray-100 pb-3 last:border-0"
              >
                <span className="text-sm font-medium text-gray-500 w-28 shrink-0">
                  {label}
                </span>
                <span className="text-sm text-gray-900">
                  {renderProfileValue(
                    key,
                    profile[key as keyof ProfileData]
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSaveProfile}
              disabled={state === "saving"}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {state === "saving" ? "保存中..." : "この内容でプロフィールを登録"}
            </button>
            <button
              onClick={handleReset}
              disabled={state === "saving"}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              やり直す
            </button>
          </div>
        </div>
      )}

      {/* 保存完了 */}
      {state === "saved" && (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            プロフィールを登録しました
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            求人マッチングや書類作成にこのプロフィールが使われます。
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/profile"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              プロフィールを確認
            </Link>
            <Link
              href="/jobs"
              className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
            >
              求人を探す
            </Link>
            <button
              onClick={handleReset}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              別のファイルをアップロード
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
