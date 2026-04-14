"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/** 学歴の1行 */
interface EducationEntry {
  period: string;
  school: string;
}

/** 職歴の1行 */
interface WorkHistoryEntry {
  period: string;
  company: string;
  department: string;
  description: string;
}

/** raw_conversation に格納される拡張データ */
interface ExtendedProfileData {
  lastName?: string;
  firstName?: string;
  lastNameKana?: string;
  firstNameKana?: string;
  /** 後方互換: 旧データ */
  fullName?: string;
  furigana?: string;
  gender?: string;
  email?: string;
  phone?: string;
  postalCode?: string;
  address?: string;
  nearestStation?: string;
  education?: EducationEntry[];
  workHistory?: WorkHistoryEntry[];
  source?: string;
}

/** フォームの状態 */
interface FormState {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  age: string;
  gender: string;
  email: string;
  phone: string;
  postalCode: string;
  address: string;
  nearestStation: string;
  education: EducationEntry[];
  workHistory: WorkHistoryEntry[];
  skills: string;
  desiredSalary: string;
  desiredLocation: string;
  desiredRole: string;
  experienceYears: string;
  values: string;
}

/** AIチャットのメッセージ */
interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** AIが返すプロフィールデータ */
interface AiProfileData {
  lastName: string | null;
  firstName: string | null;
  lastNameKana: string | null;
  firstNameKana: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  nearestStation: string | null;
  education: Array<{ yearMonth: string; content: string }> | null;
  workHistory: Array<{
    period: string;
    company: string;
    department: string;
    duties: string;
  }> | null;
  skills: string | null;
  experienceYears: number | null;
  desiredSalary: string | null;
  desiredLocation: string | null;
  desiredRole: string | null;
  values: string | null;
}

const initialForm: FormState = {
  lastName: "",
  firstName: "",
  lastNameKana: "",
  firstNameKana: "",
  age: "",
  gender: "",
  email: "",
  phone: "",
  postalCode: "",
  address: "",
  nearestStation: "",
  education: [{ period: "", school: "" }],
  workHistory: [{ period: "", company: "", department: "", description: "" }],
  skills: "",
  desiredSalary: "",
  desiredLocation: "",
  desiredRole: "",
  experienceYears: "",
  values: "",
};

/** 性別テキストをselect valueにマッピング */
function mapGenderToValue(gender: string | null): string {
  if (!gender) return "";
  const g = gender.trim();
  if (g === "男性" || g === "male") return "male";
  if (g === "女性" || g === "female") return "female";
  if (g === "その他" || g === "other") return "other";
  if (g === "回答しない" || g === "prefer_not_to_say") return "prefer_not_to_say";
  return "";
}

export default function ProfilePage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // AI自動入力チャット
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiSending, setAiSending] = useState(false);
  const [aiApplied, setAiApplied] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);

  /** AIプロフィールデータをフォームに反映 */
  const applyAiProfile = useCallback((data: AiProfileData) => {
    setForm((prev) => ({
      ...prev,
      lastName: data.lastName ?? prev.lastName,
      firstName: data.firstName ?? prev.firstName,
      lastNameKana: data.lastNameKana ?? prev.lastNameKana,
      firstNameKana: data.firstNameKana ?? prev.firstNameKana,
      age: data.age != null ? String(data.age) : prev.age,
      gender: mapGenderToValue(data.gender) || prev.gender,
      phone: data.phone ?? prev.phone,
      postalCode: data.postalCode ?? prev.postalCode,
      address: data.address ?? prev.address,
      nearestStation: data.nearestStation ?? prev.nearestStation,
      education:
        data.education && data.education.length > 0
          ? data.education.map((e) => ({
              period: e.yearMonth,
              school: e.content,
            }))
          : prev.education,
      workHistory:
        data.workHistory && data.workHistory.length > 0
          ? data.workHistory.map((w) => ({
              period: w.period,
              company: w.company,
              department: w.department,
              description: w.duties,
            }))
          : prev.workHistory,
      skills: data.skills ?? prev.skills,
      experienceYears:
        data.experienceYears != null
          ? String(data.experienceYears)
          : prev.experienceYears,
      desiredSalary: data.desiredSalary ?? prev.desiredSalary,
      desiredLocation: data.desiredLocation ?? prev.desiredLocation,
      desiredRole: data.desiredRole ?? prev.desiredRole,
      values: data.values ?? prev.values,
    }));
    setAiApplied(true);

    // 住所から郵便番号を取得不可のため、LLMプロンプトで対応済み
  }, []);

  /** AIチャット送信 */
  const sendAiMessage = useCallback(async () => {
    const trimmed = aiInput.trim();
    if (!trimmed || aiSending) return;

    const userMsg: AiChatMessage = { role: "user", content: trimmed };
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiInput("");
    setAiSending(true);

    try {
      const res = await fetch("/api/profile/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) {
        const err: { error?: string } = await res.json();
        throw new Error(err.error ?? "AI応答の取得に失敗しました");
      }

      const data: {
        reply: string;
        profileData: AiProfileData | null;
      } = await res.json();

      let displayText = data.reply;
      if (data.profileData) {
        applyAiProfile(data.profileData);
        // JSON部分を除いたテキストに追加質問があればそのまま表示
        displayText = displayText
          ? `フォームに反映しました!\n\n${displayText}`
          : "フォームに反映しました! 確認して保存してください。";
      }
      const assistantMsg: AiChatMessage = {
        role: "assistant",
        content: displayText,
      };
      setAiMessages([...newMessages, assistantMsg]);
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "AI応答の取得に失敗しました";
      setAiMessages([
        ...newMessages,
        { role: "assistant", content: `エラー: ${errorText}` },
      ]);
    } finally {
      setAiSending(false);
    }
  }, [aiInput, aiMessages, aiSending, applyAiProfile]);

  /** AIチャットのスクロール制御 */
  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  /** 既存プロフィールを読み込み */
  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const data: {
        profile: {
          age: number | null;
          skills: string[];
          experience_years: number | null;
          desired_salary: string | null;
          desired_location: string | null;
          desired_role: string | null;
          values: string | null;
          raw_conversation: unknown;
        } | null;
      } = await res.json();
      if (!data.profile) return;

      const p = data.profile;
      const ext = (p.raw_conversation ?? {}) as ExtendedProfileData;

      // 後方互換: 旧データの fullName/furigana からスペース区切りで姓名分割を試みる
      const fallbackLastName = ext.lastName ?? (ext.fullName ? ext.fullName.split(/\s+/)[0] : "") ?? "";
      const fallbackFirstName = ext.firstName ?? (ext.fullName ? ext.fullName.split(/\s+/).slice(1).join(" ") : "") ?? "";
      const fallbackLastNameKana = ext.lastNameKana ?? (ext.furigana ? ext.furigana.split(/\s+/)[0] : "") ?? "";
      const fallbackFirstNameKana = ext.firstNameKana ?? (ext.furigana ? ext.furigana.split(/\s+/).slice(1).join(" ") : "") ?? "";

      setForm({
        lastName: fallbackLastName,
        firstName: fallbackFirstName,
        lastNameKana: fallbackLastNameKana,
        firstNameKana: fallbackFirstNameKana,
        age: p.age != null ? String(p.age) : "",
        gender: ext.gender ?? "",
        email: ext.email ?? "",
        phone: ext.phone ?? "",
        postalCode: ext.postalCode ?? "",
        address: ext.address ?? "",
        nearestStation: ext.nearestStation ?? "",
        education:
          ext.education && ext.education.length > 0
            ? ext.education
            : [{ period: "", school: "" }],
        workHistory:
          ext.workHistory && ext.workHistory.length > 0
            ? ext.workHistory
            : [{ period: "", company: "", department: "", description: "" }],
        skills: Array.isArray(p.skills) ? p.skills.join(", ") : "",
        desiredSalary: p.desired_salary ?? "",
        desiredLocation: p.desired_location ?? "",
        desiredRole: p.desired_role ?? "",
        experienceYears:
          p.experience_years != null ? String(p.experience_years) : "",
        values: p.values ?? "",
      });
    } catch (err) {
      console.error("プロフィール読み込みエラー:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // ユーザーメールをフォームにセット
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email && !form.email) {
        setForm((prev) => ({ ...prev, email: user.email ?? "" }));
      }
    });
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfile]);

  /** テキスト入力の更新 */
  const updateField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /** 学歴の追加 */
  const addEducation = () => {
    setForm((prev) => ({
      ...prev,
      education: [...prev.education, { period: "", school: "" }],
    }));
  };

  /** 学歴の更新 */
  const updateEducation = (
    index: number,
    field: keyof EducationEntry,
    value: string
  ) => {
    setForm((prev) => {
      const updated = [...prev.education];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, education: updated };
    });
  };

  /** 学歴の削除 */
  const removeEducation = (index: number) => {
    setForm((prev) => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index),
    }));
  };

  /** 職歴の追加 */
  const addWorkHistory = () => {
    setForm((prev) => ({
      ...prev,
      workHistory: [
        ...prev.workHistory,
        { period: "", company: "", department: "", description: "" },
      ],
    }));
  };

  /** 職歴の更新 */
  const updateWorkHistory = (
    index: number,
    field: keyof WorkHistoryEntry,
    value: string
  ) => {
    setForm((prev) => {
      const updated = [...prev.workHistory];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, workHistory: updated };
    });
  };

  /** 職歴の削除 */
  const removeWorkHistory = (index: number) => {
    setForm((prev) => ({
      ...prev,
      workHistory: prev.workHistory.filter((_, i) => i !== index),
    }));
  };

  /** 保存 */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const skillsArray = form.skills
        .split(/[,、]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        lastName: form.lastName,
        firstName: form.firstName,
        lastNameKana: form.lastNameKana,
        firstNameKana: form.firstNameKana,
        fullName: `${form.lastName} ${form.firstName}`.trim(),
        furigana: `${form.lastNameKana} ${form.firstNameKana}`.trim(),
        age: form.age ? Number(form.age) : null,
        gender: form.gender,
        email: form.email,
        phone: form.phone,
        postalCode: form.postalCode,
        address: form.address,
        nearestStation: form.nearestStation,
        education: form.education.filter((e) => e.period || e.school),
        workHistory: form.workHistory.filter(
          (w) => w.period || w.company || w.department || w.description
        ),
        skills: skillsArray,
        desired_salary: form.desiredSalary,
        desired_location: form.desiredLocation,
        desired_role: form.desiredRole,
        experience_years: form.experienceYears
          ? Number(form.experienceYears)
          : null,
        values: form.values,
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err: { error?: string } = await res.json();
        throw new Error(err.error ?? "保存に失敗しました");
      }

      setMessage({ type: "success", text: "プロフィールを保存しました" });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "保存に失敗しました";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          プロフィール登録
        </h1>
        <Link
          href="/profile/upload"
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          履歴書・職務経歴書からプロフィールを作成
        </Link>
      </div>

      {/* ===== AI自動入力セクション ===== */}
      {!aiChatOpen ? (
        <button
          type="button"
          onClick={() => {
            setAiChatOpen(true);
            setAiApplied(false);
            if (aiMessages.length === 0) {
              setAiMessages([
                {
                  role: "assistant",
                  content:
                    "あなたの情報を入力欄に書いてください。1回で全部入力できます!\n\n書く内容:\n・名前、年齢、性別\n・住んでいる場所\n・学歴（学校名）\n・職歴（会社名、何をしてたか、何年）\n・持ってる資格\n・希望の年収と勤務地\n\n例: 「山田太郎 28歳男 大阪住み ○○高校卒業 ○○不動産で営業2年 宅建あり 年収400万希望 ワークライフバランス重視」",
                },
              ]);
            }
          }}
          className="mb-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors font-medium"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          AIと会話して自動入力
        </button>
      ) : (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span className="font-medium">AIアシスタント</span>
            </div>
            <button
              type="button"
              onClick={() => setAiChatOpen(false)}
              className="text-white hover:text-blue-200 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* メッセージ表示エリア */}
          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {aiMessages.map((msg, i) => (
              <div
                key={`ai-msg-${i}`}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-800 border border-gray-200"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {aiSending && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-500 border border-gray-200 rounded-lg px-4 py-2 text-sm">
                  考え中...
                </div>
              </div>
            )}
            <div ref={aiChatEndRef} />
          </div>

          {/* 反映完了メッセージ */}
          {aiApplied && (
            <div className="mx-4 mb-2 p-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 text-center">
              フォームに反映しました! 下のフォームを確認して保存してください。
            </div>
          )}

          {/* 入力欄 */}
          <div className="flex gap-2 p-4 pt-0">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendAiMessage();
                }
              }}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="例: 山田太郎 28歳 大阪 不動産営業3年 宅建あり 年収500万希望"
              disabled={aiSending}
            />
            <button
              type="button"
              onClick={sendAiMessage}
              disabled={aiSending || !aiInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              送信
            </button>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`mb-4 p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ===== 基本情報 ===== */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
            基本情報
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 姓・名 横並び */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  姓
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="山田"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="太郎"
                />
              </div>
            </div>
            {/* セイ・メイ 横並び */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  セイ
                </label>
                <input
                  type="text"
                  value={form.lastNameKana}
                  onChange={(e) => updateField("lastNameKana", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ヤマダ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メイ
                </label>
                <input
                  type="text"
                  value={form.firstNameKana}
                  onChange={(e) => updateField("firstNameKana", e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="タロウ"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年齢
              </label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => updateField("age", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="30"
                min={15}
                max={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                性別
              </label>
              <select
                value={form.gender}
                onChange={(e) => updateField("gender", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">選択してください</option>
                <option value="male">男性</option>
                <option value="female">女性</option>
                <option value="other">その他</option>
                <option value="prefer_not_to_say">回答しない</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                電話番号
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="090-1234-5678"
              />
            </div>
          </div>
        </section>

        {/* ===== 住所 ===== */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
            住所
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                郵便番号
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateField("postalCode", v);
                    // 7桁（ハイフンあり/なし）入力されたら自動で住所検索
                    const digits = v.replace("-", "");
                    if (digits.length === 7 && /^\d{7}$/.test(digits)) {
                      fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`)
                        .then((r) => r.json())
                        .then((data: { results: Array<{ address1: string; address2: string; address3: string }> | null }) => {
                          if (data.results && data.results.length > 0) {
                            const a = data.results[0];
                            updateField("address", `${a.address1}${a.address2}${a.address3}`);
                          }
                        })
                        .catch(() => {});
                    }
                  }}
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123-4567"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最寄り駅
              </label>
              <input
                type="text"
                value={form.nearestStation}
                onChange={(e) => updateField("nearestStation", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="JR東京駅"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              住所
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="東京都千代田区..."
            />
          </div>
        </section>

        {/* ===== 学歴 ===== */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
            学歴
          </h2>
          {form.education.map((edu, i) => (
            <div
              key={`edu-${i}`}
              className="flex items-start gap-3 mb-3"
            >
              <input
                type="text"
                value={edu.period}
                onChange={(e) => updateEducation(i, "period", e.target.value)}
                className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="2020/03"
              />
              <input
                type="text"
                value={edu.school}
                onChange={(e) => updateEducation(i, "school", e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="○○大学 工学部 卒業"
              />
              {form.education.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEducation(i)}
                  className="text-red-500 hover:text-red-700 text-sm px-2 py-2"
                >
                  削除
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addEducation}
            className="text-sm text-blue-600 hover:text-blue-800 mt-1"
          >
            + 学歴を追加
          </button>
        </section>

        {/* ===== 職歴 ===== */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
            職歴
          </h2>
          {form.workHistory.map((work, i) => (
            <div
              key={`work-${i}`}
              className="border border-gray-200 rounded-md p-4 mb-3 bg-white"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">
                  職歴 {i + 1}
                </span>
                {form.workHistory.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWorkHistory(i)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    削除
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={work.period}
                  onChange={(e) =>
                    updateWorkHistory(i, "period", e.target.value)
                  }
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2020/04 - 2023/03"
                />
                <input
                  type="text"
                  value={work.company}
                  onChange={(e) =>
                    updateWorkHistory(i, "company", e.target.value)
                  }
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="株式会社○○"
                />
                <input
                  type="text"
                  value={work.department}
                  onChange={(e) =>
                    updateWorkHistory(i, "department", e.target.value)
                  }
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="開発部"
                />
              </div>
              <textarea
                value={work.description}
                onChange={(e) =>
                  updateWorkHistory(i, "description", e.target.value)
                }
                className="mt-3 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="業務内容を記入してください"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addWorkHistory}
            className="text-sm text-blue-600 hover:text-blue-800 mt-1"
          >
            + 職歴を追加
          </button>
        </section>

        {/* ===== スキル・資格 ===== */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
            スキル・資格
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              スキル・資格（カンマ区切り）
            </label>
            <input
              type="text"
              value={form.skills}
              onChange={(e) => updateField("skills", e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="JavaScript, Python, AWS, 基本情報技術者"
            />
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              経験年数
            </label>
            <input
              type="number"
              value={form.experienceYears}
              onChange={(e) => updateField("experienceYears", e.target.value)}
              className="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="5"
              min={0}
              max={50}
            />
          </div>
        </section>

        {/* ===== 希望条件 ===== */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
            希望条件
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                希望年収
              </label>
              <input
                type="text"
                value={form.desiredSalary}
                onChange={(e) => updateField("desiredSalary", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="600万円"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                希望勤務地
              </label>
              <input
                type="text"
                value={form.desiredLocation}
                onChange={(e) =>
                  updateField("desiredLocation", e.target.value)
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="東京都、リモート可"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                希望職種
              </label>
              <input
                type="text"
                value={form.desiredRole}
                onChange={(e) => updateField("desiredRole", e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="バックエンドエンジニア"
              />
            </div>
          </div>
        </section>

        {/* ===== 価値観 ===== */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
            価値観・その他
          </h2>
          <textarea
            value={form.values}
            onChange={(e) => updateField("values", e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder="ワークライフバランス重視、技術的なチャレンジがしたい、チームで働きたい..."
          />
        </section>

        {/* ===== 保存ボタン ===== */}
        <div className="flex justify-end pb-8">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </div>
  );
}
