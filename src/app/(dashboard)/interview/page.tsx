"use client";

import { useState, useRef, useEffect } from "react";
import { sampleJobs } from "@/lib/sampleJobs";
import type { ChatMessage } from "@/types/database";

interface InterviewQuestion {
  question: string;
  category: string;
  tips: string;
}

export default function InterviewPage() {
  const [selectedJob, setSelectedJob] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [mode, setMode] = useState<"questions" | "roleplay">("questions");

  // Roleplay state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchQuestions = async () => {
    if (!selectedJob) return;
    setLoadingQuestions(true);
    setQuestions([]);

    try {
      const res = await fetch("/api/interview/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJob }),
      });

      if (!res.ok) throw new Error("取得失敗");
      const data: { questions: InterviewQuestion[] } = await res.json();
      setQuestions(data.questions);
    } catch {
      alert("質問の生成に失敗しました");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const startRoleplay = () => {
    const job = sampleJobs.find((j) => j.id === selectedJob);
    if (!job) return;

    setMode("roleplay");
    setMessages([
      {
        role: "assistant",
        content: `こんにちは。${job.company}の面接担当です。本日は${job.title}のポジションにご応募いただきありがとうございます。\n\nそれでは面接を始めさせていただきます。まず、簡単に自己紹介をお願いできますか？`,
      },
    ]);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loadingChat) return;

    const job = sampleJobs.find((j) => j.id === selectedJob);
    if (!job) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoadingChat(true);

    try {
      const res = await fetch("/api/interview/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          jobTitle: job.title,
        }),
      });

      if (!res.ok) throw new Error("APIエラー");
      const data: { reply: string } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "エラーが発生しました。もう一度お試しください。" },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">面接対策</h1>

      {/* Job Selection */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              求人を選択
            </label>
            <select
              value={selectedJob}
              onChange={(e) => {
                setSelectedJob(e.target.value);
                setQuestions([]);
                setMode("questions");
                setMessages([]);
              }}
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
          <button
            onClick={fetchQuestions}
            disabled={!selectedJob || loadingQuestions}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingQuestions ? "生成中..." : "想定質問を生成"}
          </button>
          <button
            onClick={startRoleplay}
            disabled={!selectedJob}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            模擬面接を開始
          </button>
        </div>
      </div>

      {/* Questions List */}
      {mode === "questions" && questions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            想定質問一覧
          </h2>
          <div className="space-y-4">
            {questions.map((q, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {q.category}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    Q{i + 1}.
                  </span>
                </div>
                <p className="text-gray-800 mb-2">{q.question}</p>
                <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  回答のポイント: {q.tips}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roleplay Chat */}
      {mode === "roleplay" && (
        <div>
          <div className="bg-white rounded-xl shadow-sm border min-h-[400px] max-h-[500px] overflow-y-auto p-4 mb-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loadingChat && (
              <div className="flex justify-start mb-4">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl text-sm text-gray-500">
                  面接官が考え中...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="回答を入力..."
              disabled={loadingChat}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loadingChat || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              送信
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
