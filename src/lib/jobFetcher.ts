/**
 * Green (green-japan.com) から求人情報を取得するモジュール。
 *
 * GreenはNext.jsで構築されており、__NEXT_DATA__に求人JSONが含まれる。
 * サーバーサイドfetch + JSONパースで取得可能（Playwright不要）。
 *
 * 取得失敗時はsampleJobsにフォールバックする。
 */
import type { Job } from "@/types/database";

const FETCH_TIMEOUT_MS = 15_000;
const GREEN_BASE = "https://www.green-japan.com";

interface GreenCompany {
  id: number;
  name: string;
  title?: string;
}

interface GreenJobOffer {
  id: number;
  name: string;
  company: GreenCompany;
  salary: string;
  areaName: string;
  skillNames: string[];
  jobOfferUrl: string;
  employeesNumber?: number;
  establishedYear?: string;
}

interface GreenNextData {
  props: {
    pageProps: {
      defaultSearchJobOfferData: {
        jobOffers: GreenJobOffer[];
        totalJobOfferCount?: number;
      };
    };
  };
}

export interface FetchAllResult {
  jobs: Job[];
  sources: {
    green: { count: number; error?: string };
  };
  usedFallback: boolean;
}

/**
 * GreenのHTML内の __NEXT_DATA__ からJSONを抽出する
 */
function extractNextData(html: string): GreenNextData | null {
  const match = html.match(/__NEXT_DATA__[^{]*([\s\S]*?)<\/script>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as GreenNextData;
  } catch {
    return null;
  }
}

/**
 * Green (green-japan.com) から求人を取得する。
 */
export const fetchAllJobs = async (
  keyword: string,
  location: string = "東京都"
): Promise<FetchAllResult> => {
  const params = new URLSearchParams({ keyword });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`${GREEN_BASE}/search?${params}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AIJobAgent/1.0)",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const nextData = extractNextData(html);

    if (!nextData) {
      throw new Error("__NEXT_DATA__ が見つかりません");
    }

    const greenJobs =
      nextData.props.pageProps.defaultSearchJobOfferData.jobOffers;

    const jobs: Job[] = greenJobs.map((gj) => ({
      id: `green-${gj.id}`,
      title: gj.name,
      company: gj.company.name,
      description: [
        gj.skillNames.length > 0
          ? `スキル: ${gj.skillNames.join(", ")}`
          : "",
        gj.employeesNumber
          ? `従業員数: ${gj.employeesNumber}名`
          : "",
        gj.establishedYear ? `設立: ${gj.establishedYear}` : "",
        gj.company.title ?? "",
      ]
        .filter(Boolean)
        .join(" / "),
      location: gj.areaName || location,
      salary: gj.salary || null,
      url: `${GREEN_BASE}${gj.jobOfferUrl}`,
      source: "green",
      created_at: new Date().toISOString(),
    }));

    return {
      jobs,
      sources: {
        green: { count: jobs.length },
      },
      usedFallback: false,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[jobFetcher] Green取得エラー: ${message}`);
    return {
      jobs: [],
      sources: {
        green: { count: 0, error: message },
      },
      usedFallback: true,
    };
  }
};
