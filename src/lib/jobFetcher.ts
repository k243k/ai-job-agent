/**
 * Careerjet API経由で日本の求人情報を取得するモジュール。
 *
 * Careerjet: 無料の求人アグリゲーターAPI。登録不要、日本語対応。
 * https://www.careerjet.net/partners/api/
 *
 * 取得失敗時はsampleJobsにフォールバックする。
 */
import type { Job } from "@/types/database";

const API_BASE = "https://public.api.careerjet.net/search";
const API_TIMEOUT_MS = 15_000;
const AFFID = process.env.CAREERJET_AFFID ?? "test";

/** HTMLタグを除去しアンエスケープする */
const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();

/** URLから安定的なIDを生成 */
const generateId = (url: string): string => {
  const hash = Array.from(url).reduce(
    (acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0,
    0
  );
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `cj-${hex}`;
};

/** 給与情報を読みやすい文字列に変換 */
const formatSalary = (job: CareerjetJob): string | null => {
  if (!job.salary) return null;
  return job.salary;
};

interface CareerjetJob {
  title: string;
  description: string;
  url: string;
  locations: string;
  company: string;
  salary: string;
  salary_min: string;
  salary_max: string;
  salary_type: string; // H=hourly, M=monthly, Y=yearly
  salary_currency_code: string;
  date: string;
  site: string;
}

interface CareerjetResponse {
  type: string;
  error?: string;
  hits: number;
  pages: number;
  response_time: number;
  jobs: CareerjetJob[];
}

export interface FetchAllResult {
  jobs: Job[];
  sources: {
    careerjet: { count: number; error?: string };
  };
  usedFallback: boolean;
}

/**
 * Careerjet APIから日本の求人を取得する。
 */
export const fetchAllJobs = async (
  keyword: string,
  location: string = "東京都"
): Promise<FetchAllResult> => {
  const params = new URLSearchParams({
    locale_code: "ja_JP",
    keywords: keyword,
    location,
    affid: AFFID,
    user_ip: "1.0.0.1", // サーバーサイド呼び出し用のダミーIP
    user_agent: "AIJobAgent/1.0",
    pagesize: "30",
    page: "1",
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(`${API_BASE}?${params}`, {
      headers: { Referer: process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as CareerjetResponse;

    if (data.type === "ERROR" || data.error) {
      throw new Error(data.error ?? "Careerjet API error");
    }

    const jobs: Job[] = (data.jobs ?? []).map((cj) => ({
      id: generateId(cj.url),
      title: stripHtml(cj.title),
      company: cj.company || "",
      description: stripHtml(cj.description).slice(0, 500),
      location: cj.locations || location,
      salary: formatSalary(cj),
      url: cj.url,
      source: "careerjet",
      created_at: cj.date || new Date().toISOString(),
    }));

    return {
      jobs,
      sources: {
        careerjet: { count: jobs.length },
      },
      usedFallback: false,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[jobFetcher] Careerjet API取得エラー: ${message}`);
    return {
      jobs: [],
      sources: {
        careerjet: { count: 0, error: message },
      },
      usedFallback: true,
    };
  }
};
