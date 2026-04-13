-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age integer,
  skills text[] default '{}',
  experience_years integer,
  desired_salary text,
  desired_location text,
  desired_role text,
  values text,
  raw_conversation jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- jobs
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text,
  description text,
  location text,
  salary text,
  url text,
  source text default 'manual',
  created_at timestamptz default now()
);

alter table public.jobs enable row level security;
create policy "Jobs are viewable by authenticated users" on public.jobs for select using (auth.role() = 'authenticated');

-- applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  status text default 'interested' check (status in ('interested','applied','interviewing','offered','rejected','withdrawn')),
  applied_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.applications enable row level security;
create policy "Users can manage own applications" on public.applications for all using (auth.uid() = user_id);

-- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade,
  doc_type text not null check (doc_type in ('resume','cv','motivation_letter')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.documents enable row level security;
create policy "Users can manage own documents" on public.documents for all using (auth.uid() = user_id);

-- seed: サンプル求人データ（アプリ内のsampleJobsと一致するUUID）
insert into public.jobs (id, title, company, description, location, salary, url, source) values
  ('00000000-0000-4000-a000-000000000001', 'シニアフロントエンドエンジニア', 'テックスタートアップ株式会社', 'React/Next.jsを使ったWebアプリケーション開発。チームリーダーとして3名のメンバーを率いていただきます。リモートワーク可。', '東京都渋谷区（リモート可）', '600万〜900万円', 'https://example.com/jobs/001', 'sample'),
  ('00000000-0000-4000-a000-000000000002', 'バックエンドエンジニア', 'フィンテック合同会社', 'Go/Pythonを使った金融系APIの設計・開発。マイクロサービスアーキテクチャ。AWS環境。', '東京都千代田区', '500万〜800万円', 'https://example.com/jobs/002', 'sample'),
  ('00000000-0000-4000-a000-000000000003', 'フルスタックエンジニア', 'SaaS株式会社', 'TypeScript/React/Node.jsでのBtoB SaaS開発。少数精鋭チームで裁量大。フレックス制度あり。', '大阪府大阪市（フルリモート可）', '450万〜700万円', 'https://example.com/jobs/003', 'sample'),
  ('00000000-0000-4000-a000-000000000004', 'データエンジニア', 'AI研究所株式会社', '大規模データパイプラインの構築・運用。Python/Spark/BigQuery。機械学習エンジニアとの連携。', '東京都港区', '550万〜850万円', 'https://example.com/jobs/004', 'sample'),
  ('00000000-0000-4000-a000-000000000005', 'プロジェクトマネージャー', 'ITコンサルティング株式会社', '大手企業のDX推進プロジェクトのPM。アジャイル開発経験者優遇。チームマネジメント経験必須。', '名古屋市（週2出社）', '700万〜1000万円', 'https://example.com/jobs/005', 'sample'),
  ('00000000-0000-4000-a000-000000000006', 'インフラエンジニア', 'クラウドソリューションズ株式会社', 'AWS/GCPのクラウドインフラ設計・構築・運用。IaC（Terraform）経験者歓迎。SRE的な役割。', '福岡市（フルリモート可）', '500万〜750万円', 'https://example.com/jobs/006', 'sample');
