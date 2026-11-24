-- ════════════════════════════════════════════════════════════════
-- KROOPY · account sync between devices
--
-- Every record the app keeps (ideas, videos, tasks, habits, goals, events,
-- files metadata, brand kit, settings…) is stored as one JSON document per
-- (user, collection, id). The server clock orders changes, so the latest
-- write wins and every device can ask "what changed since T?". Deletions
-- are soft (deleted = true) so they reach devices that were offline.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Self-contained:
-- it does not depend on 0001/0002.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.sync_records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  device     text,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, collection, id)
);

create index if not exists sync_records_user_updated on public.sync_records (user_id, updated_at);

-- The server decides the order of changes (devices' clocks can't be trusted).
create or replace function public.sync_records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  new.user_id := auth.uid();
  return new;
end $$;

drop trigger if exists sync_records_touch on public.sync_records;
create trigger sync_records_touch before insert or update on public.sync_records
  for each row execute function public.sync_records_touch();

-- Row Level Security: each person only ever sees and writes their own rows.
alter table public.sync_records enable row level security;
drop policy if exists "sync: own rows" on public.sync_records;
create policy "sync: own rows" on public.sync_records
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Live updates to the other devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_records'
  ) then
    alter publication supabase_realtime add table public.sync_records;
  end if;
end $$;

-- Files (uploaded assets) live in a private bucket, one folder per user.
insert into storage.buckets (id, name, public) values ('assets', 'assets', false) on conflict (id) do nothing;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assets: read own') then
    create policy "assets: read own"   on storage.objects for select to authenticated using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assets: upload own') then
    create policy "assets: upload own" on storage.objects for insert to authenticated with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assets: update own') then
    create policy "assets: update own" on storage.objects for update to authenticated using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'assets: delete own') then
    create policy "assets: delete own" on storage.objects for delete to authenticated using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

-- In-app account deletion (required by the App Store, guideline 5.1.1(v)).
-- The app removes the person's files from Storage first, then calls this.
-- Deleting the auth user cascades to sync_records.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from public.sync_records where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
