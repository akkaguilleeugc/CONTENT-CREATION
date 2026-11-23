-- ════════════════════════════════════════════════════════════════════
--  Creator OS — initial schema (Supabase / Postgres 15+)
--
--  Mirrors src/lib/types.ts. Every table is owned by a user and protected
--  with Row Level Security so a creator can only ever read or write their
--  own rows. Apply with:  supabase db push   (or paste in the SQL editor)
-- ════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────
create type priority          as enum ('low', 'medium', 'high', 'urgent');
create type idea_status       as enum ('inbox', 'interesting', 'developing', 'ready', 'converted', 'archived');
create type content_stage     as enum ('idea', 'planning', 'script', 'ready', 'recording', 'editing', 'review', 'scheduled', 'published');
create type content_format    as enum ('vertical', 'horizontal', 'carousel', 'photo', 'story', 'live');
create type task_status       as enum ('todo', 'in_progress', 'done');
create type task_category     as enum ('content', 'personal', 'work', 'learning', 'business', 'other');
create type recurrence        as enum ('none', 'daily', 'weekdays', 'weekly', 'monthly');
create type habit_frequency   as enum ('daily', 'weekdays', 'custom', 'weekly');
create type goal_period       as enum ('daily', 'weekly', 'monthly', 'yearly');
create type goal_status       as enum ('active', 'achieved', 'paused', 'missed');
create type event_type        as enum ('recording', 'editing', 'meeting', 'personal', 'other');
create type asset_type        as enum ('image', 'video', 'audio', 'logo', 'thumbnail', 'cover', 'template', 'graphic', 'document', 'reference');
create type stats_source      as enum ('manual', 'tiktok_api', 'instagram_api', 'youtube_api');

-- ── Helpers ─────────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Users (profile row per auth user) ───────────────────────────────
create table profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  name           text not null default '',
  handle         text not null default '',
  role           text not null default 'Content creator',
  avatar_asset_id uuid,
  theme          text not null default 'dark' check (theme in ('dark', 'light', 'system')),
  week_starts_on smallint not null default 1 check (week_starts_on in (0, 1)),
  settings       jsonb not null default '{}'::jsonb,   -- categories, checklist templates, UI prefs
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Create a profile automatically when a user signs up.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ── Platforms (built-in + custom per user) ──────────────────────────
create table content_platforms (
  id         text not null,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null,
  short      text not null default '',
  color      text not null default '#2F5BFF' check (color ~* '^#[0-9a-f]{6}$'),
  built_in   boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ── Tags (normalised; entities also keep a text[] for fast filtering) ─
create table tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ── Ideas ───────────────────────────────────────────────────────────
create table ideas (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title        text not null check (length(title) > 0),
  description  text not null default '',
  category     text not null default 'Other',
  platform_ids text[] not null default '{}',
  format       content_format,
  reference    text not null default '',
  priority     priority not null default 'medium',
  status       idea_status not null default 'inbox',
  tags         text[] not null default '{}',
  favorite     boolean not null default false,
  project_id   uuid,  -- set when converted (FK added below)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Content projects ────────────────────────────────────────────────
create table content_projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  idea_id       uuid references ideas (id) on delete set null,
  title         text not null default '',
  description   text not null default '',
  platform_ids  text[] not null default '{}',
  format        content_format not null default 'vertical',
  category      text not null default 'Other',
  goal          text not null default '',
  stage         content_stage not null default 'idea',
  priority      priority not null default 'medium',
  publish_date  date,
  publish_time  time,
  record_date   date,
  edit_date     date,
  duration_s    integer check (duration_s is null or duration_s >= 0),
  tags          text[] not null default '{}',
  concept       jsonb not null default '{}'::jsonb,  -- originalIdea, objective, audience, message, references, inspiration
  script        jsonb not null default '{}'::jsonb,  -- hook, intro, body, keyPoints, cta, closing
  shots         jsonb not null default '[]'::jsonb,  -- [{id, description, type, location, gear, status, notes}]
  production    jsonb not null default '[]'::jsonb,  -- checklist [{id, label, done}]
  editing       jsonb not null default '[]'::jsonb,
  publication   jsonb not null default '{}'::jsonb,  -- caption, hashtags, link, coverAssetId, thumbnailAssetId
  stage_dates   jsonb not null default '{}'::jsonb,  -- first time each stage was reached
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table ideas add constraint ideas_project_fk foreign key (project_id) references content_projects (id) on delete set null;

-- One row per platform a project is published on (links + future API ids).
create table content_publications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id    uuid not null references content_projects (id) on delete cascade,
  platform_id   text not null,
  published_at  timestamptz,
  url           text not null default '',
  external_id   text,           -- post id on the platform, filled by an API integration
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, platform_id)
);

-- ── Tasks ───────────────────────────────────────────────────────────
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id   uuid references content_projects (id) on delete set null,
  title        text not null check (length(title) > 0),
  description  text not null default '',
  category     task_category not null default 'content',
  priority     priority not null default 'medium',
  status       task_status not null default 'todo',
  due_date     date,
  due_time     time,
  reminder_min integer check (reminder_min is null or reminder_min >= 0),
  recurrence   recurrence not null default 'none',
  subtasks     jsonb not null default '[]'::jsonb,
  sort_order   double precision not null default 0,
  my_day       date,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Habits ──────────────────────────────────────────────────────────
create table habits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name          text not null check (length(name) > 0),
  description   text not null default '',
  frequency     habit_frequency not null default 'daily',
  days          smallint[] not null default '{1,2,3,4,5}',
  target        smallint not null default 1 check (target between 1 and 7),
  color         text not null default '#D4F53C',
  reminder_time time,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  habit_id   uuid not null references habits (id) on delete cascade,
  date       date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

-- ── Goals ───────────────────────────────────────────────────────────
create table goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title       text not null check (length(title) > 0),
  description text not null default '',
  period      goal_period not null default 'monthly',
  metric      text not null default 'manual',   -- manual | videos_published | videos_produced | tasks_completed | …
  platform_id text,
  target      numeric not null check (target > 0),
  unit        text not null default '',
  start_date  date not null,
  due_date    date not null,
  status      goal_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (due_date >= start_date)
);

create table goal_progress (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  goal_id    uuid not null references goals (id) on delete cascade,
  date       date not null default current_date,
  value      numeric not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);

-- Time spent creating (productivity tracker).
create table time_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id uuid references content_projects (id) on delete set null,
  date       date not null,
  minutes    integer not null check (minutes > 0),
  activity   text not null,
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Calendar ────────────────────────────────────────────────────────
create table calendar_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id   uuid references content_projects (id) on delete set null,
  title        text not null check (length(title) > 0),
  type         event_type not null default 'personal',
  date         date not null,
  start_time   time,
  end_time     time,
  notes        text not null default '',
  reminder_min integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time)
);

-- ── Analytics ───────────────────────────────────────────────────────
create table analytics_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade default auth.uid(),
  project_id       uuid references content_projects (id) on delete set null,
  publication_id   uuid references content_publications (id) on delete set null,
  title            text not null,
  platform_id      text not null,
  category         text not null default 'Other',
  format           content_format,
  published_date   date not null,
  views            bigint not null default 0 check (views >= 0),
  likes            bigint not null default 0 check (likes >= 0),
  comments         bigint not null default 0 check (comments >= 0),
  shares           bigint not null default 0 check (shares >= 0),
  saves            bigint not null default 0 check (saves >= 0),
  reach            bigint not null default 0 check (reach >= 0),
  followers_gained bigint not null default 0,
  source           stats_source not null default 'manual',
  captured_at      timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Engagement is derived, never stored.
create view analytics_with_engagement with (security_invoker = true) as
  select *, case when greatest(reach, views) > 0
    then (likes + comments + shares + saves)::numeric / nullif(case when reach > 0 then reach else views end, 0) * 100
    else 0 end as engagement_rate
  from analytics_records;

-- ── Brand & assets ──────────────────────────────────────────────────
create table asset_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null,
  color      text not null default '#D4F53C',
  created_at timestamptz not null default now()
);

create table brand_assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  folder_id    uuid references asset_folders (id) on delete set null,
  name         text not null,
  type         asset_type not null default 'image',
  mime         text not null default '',
  size_bytes   bigint not null default 0,
  storage_path text,              -- object path in the private "assets" bucket
  width        integer,
  height       integer,
  tags         text[] not null default '{}',
  is_brand     boolean not null default false,
  note         text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table profiles add constraint profiles_avatar_fk foreign key (avatar_asset_id) references brand_assets (id) on delete set null;

-- Many-to-many: files linked to content projects.
create table project_assets (
  project_id uuid not null references content_projects (id) on delete cascade,
  asset_id   uuid not null references brand_assets (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (project_id, asset_id)
);

create table brand_palettes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null,
  description text not null default '',
  sort_order  double precision not null default 0
);

create table brand_colors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  palette_id uuid not null references brand_palettes (id) on delete cascade,
  name       text not null,
  hex        text not null check (hex ~* '^#[0-9a-f]{6}$'),
  role       text not null default '',
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table color_combos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null,
  background text not null,
  foreground text not null,
  accent     text,
  note       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table visual_references (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  asset_id   uuid references brand_assets (id) on delete set null,
  title      text not null,
  kind       text not null default 'inspiration',
  url        text not null default '',
  notes      text not null default '',
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────
create index on ideas (user_id, status);
create index on content_projects (user_id, stage);
create index on content_projects (user_id, publish_date);
create index on tasks (user_id, status, due_date);
create index on tasks (project_id);
create index on habit_logs (user_id, date);
create index on calendar_events (user_id, date);
create index on analytics_records (user_id, published_date);
create index on analytics_records (project_id);
create index on brand_assets (user_id, folder_id);
create index on time_logs (user_id, date);

-- ── updated_at triggers ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles','ideas','content_projects','content_publications','tasks','habits','goals','time_logs',
                           'calendar_events','analytics_records','brand_assets','brand_colors','color_combos','visual_references']
  loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ── Row Level Security: every row belongs to exactly one user ───────
do $$
declare t text;
begin
  foreach t in array array['content_platforms','tags','ideas','content_projects','content_publications','tasks','habits','habit_logs',
                           'goals','goal_progress','time_logs','calendar_events','analytics_records','asset_folders','brand_assets',
                           'project_assets','brand_palettes','brand_colors','color_combos','visual_references']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows: select" on %I for select using (user_id = auth.uid())', t);
    execute format('create policy "own rows: insert" on %I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "own rows: update" on %I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own rows: delete" on %I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy "own profile: select" on profiles for select using (id = auth.uid());
create policy "own profile: update" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ── Storage: private bucket, one folder per user ────────────────────
insert into storage.buckets (id, name, public) values ('assets', 'assets', false) on conflict (id) do nothing;

create policy "assets: read own"   on storage.objects for select using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets: upload own" on storage.objects for insert with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets: update own" on storage.objects for update using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "assets: delete own" on storage.objects for delete using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
