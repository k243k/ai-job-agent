import type { Job } from "@/types/database";

// 固定UUIDでサンプル求人を定義（DBシードと一致させる）
export const sampleJobs: Job[] = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    title: "シニアフロントエンドエンジニア",
    company: "テックスタートアップ株式会社",
    description:
      "React/Next.jsを使ったWebアプリケーション開発。チームリーダーとして3名のメンバーを率いていただきます。リモートワーク可。",
    location: "東京都渋谷区（リモート可）",
    salary: "600万〜900万円",
    url: "https://example.com/jobs/001",
    source: "sample",
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    title: "バックエンドエンジニア",
    company: "フィンテック合同会社",
    description:
      "Go/Pythonを使った金融系APIの設計・開発。マイクロサービスアーキテクチャ。AWS環境。",
    location: "東京都千代田区",
    salary: "500万〜800万円",
    url: "https://example.com/jobs/002",
    source: "sample",
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    title: "フルスタックエンジニア",
    company: "SaaS株式会社",
    description:
      "TypeScript/React/Node.jsでのBtoB SaaS開発。少数精鋭チームで裁量大。フレックス制度あり。",
    location: "大阪府大阪市（フルリモート可）",
    salary: "450万〜700万円",
    url: "https://example.com/jobs/003",
    source: "sample",
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-a000-000000000004",
    title: "データエンジニア",
    company: "AI研究所株式会社",
    description:
      "大規模データパイプラインの構築・運用。Python/Spark/BigQuery。機械学習エンジニアとの連携。",
    location: "東京都港区",
    salary: "550万〜850万円",
    url: "https://example.com/jobs/004",
    source: "sample",
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-a000-000000000005",
    title: "プロジェクトマネージャー",
    company: "ITコンサルティング株式会社",
    description:
      "大手企業のDX推進プロジェクトのPM。アジャイル開発経験者優遇。チームマネジメント経験必須。",
    location: "名古屋市（週2出社）",
    salary: "700万〜1000万円",
    url: "https://example.com/jobs/005",
    source: "sample",
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-a000-000000000006",
    title: "インフラエンジニア",
    company: "クラウドソリューションズ株式会社",
    description:
      "AWS/GCPのクラウドインフラ設計・構築・運用。IaC（Terraform）経験者歓迎。SRE的な役割。",
    location: "福岡市（フルリモート可）",
    salary: "500万〜750万円",
    url: "https://example.com/jobs/006",
    source: "sample",
    created_at: new Date().toISOString(),
  },
];
