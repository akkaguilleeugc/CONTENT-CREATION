-- ════════════════════════════════════════════════════════════════════
--  Creator OS — v2: the Brand Kit belongs to the user's own brand.
--  Adds the brand profile (name, story, logos, rules) and brand fonts,
--  and lets fonts be stored as assets.
-- ════════════════════════════════════════════════════════════════════

alter type asset_type add value if not exists 'font';

create type font_role as enum ('display', 'text', 'accent', 'other');

create table brand_profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  name             text not null default '',
  tagline          text not null default '',
  description      text not null default '',
  voice            text[] not null default '{}',
  logo_asset_id    uuid references brand_assets (id) on delete set null,
  symbol_asset_id  uuid references brand_assets (id) on delete set null,
  logo_background  text not null default '#FFFFFF' check (logo_background ~* '^#[0-9a-f]{6}$'),
  do_list          text[] not null default '{}',
  dont_list        text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table brand_fonts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name        text not null check (length(name) > 0),
  family      text not null,                 -- CSS family the file is registered under
  role        font_role not null default 'display',
  usage       text not null default '',
  sample      text not null default '',
  asset_id    uuid references brand_assets (id) on delete set null,  -- the uploaded .otf/.ttf/.woff(2)
  sort_order  double precision not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on brand_fonts (user_id);

create trigger brand_profiles_updated before update on brand_profiles for each row execute function set_updated_at();
create trigger brand_fonts_updated before update on brand_fonts for each row execute function set_updated_at();

alter table brand_profiles enable row level security;
create policy "own brand: select" on brand_profiles for select using (user_id = auth.uid());
create policy "own brand: insert" on brand_profiles for insert with check (user_id = auth.uid());
create policy "own brand: update" on brand_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own brand: delete" on brand_profiles for delete using (user_id = auth.uid());

alter table brand_fonts enable row level security;
create policy "own rows: select" on brand_fonts for select using (user_id = auth.uid());
create policy "own rows: insert" on brand_fonts for insert with check (user_id = auth.uid());
create policy "own rows: update" on brand_fonts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows: delete" on brand_fonts for delete using (user_id = auth.uid());
