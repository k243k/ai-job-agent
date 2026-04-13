# AI転職エージェント MVP

## 概要
求職者がAIとチャットでヒアリング→求人マッチング→書類作成→面接対策→応募管理まで自律代行するWebアプリ。

## 技術スタック
- Next.js 14 (App Router)
- Supabase (PostgreSQL + Auth)
- Claude API (claude-sonnet-4-5)
- Tailwind CSS
- react-pdf (PDF生成)
- デプロイ: Vercel

## 対象OS
- macOS (開発)
- Vercel (本番)

## フォルダ構成
```
ai-job-agent/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (auth)/       # 認証関連ページ
│   │   ├── (dashboard)/  # 認証後ページ群
│   │   ├── api/          # API Routes
│   │   └── layout.tsx
│   ├── components/       # 共通コンポーネント
│   ├── lib/              # ユーティリティ
│   │   ├── supabase/     # Supabase クライアント
│   │   └── claude/       # Claude API ラッパー
│   └── types/            # TypeScript型定義
├── supabase/
│   └── migrations/       # DBマイグレーション
├── public/
└── docs/
    └── research/
        └── failures.md   # プロジェクト固有の失敗記録
```

## 環境変数 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## 開発コマンド
- `npm run dev` - 開発サーバー起動
- `npm run build` - ビルド
- `npm run lint` - ESLint

## スクレイピングルール
求人取得時は Business/_logs/failures/2026-03-23_スクレイピング精度の根本原理.md のルールに従う。
- robots.txt確認必須
- レート制限: 最低2秒間隔
- 未ログイン・公開ページのみ
