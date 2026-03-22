create extension if not exists pgcrypto;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  affiliation text,
  email text not null,
  phone text,
  attendance_type text not null,
  dietary_restrictions text,
  message text,
  consent boolean not null default true
);

alter table public.registrations enable row level security;

drop policy if exists "allow public insert" on public.registrations;
create policy "allow public insert"
  on public.registrations
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "allow admin select" on public.registrations;
create policy "allow admin select"
  on public.registrations
  for select
  to authenticated
  using (
    auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

create index if not exists registrations_created_at_idx on public.registrations (created_at desc);

create table if not exists public.uploaded_assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  path text not null unique,
  folder_path text not null default '',
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by text
);

alter table public.uploaded_assets enable row level security;

drop policy if exists "allow admin asset select" on public.uploaded_assets;
create policy "allow admin asset select"
  on public.uploaded_assets
  for select
  to authenticated
  using (
    auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

drop policy if exists "allow anon asset select" on public.uploaded_assets;
create policy "allow anon asset select"
  on public.uploaded_assets
  for select
  to anon
  using (true);

drop policy if exists "allow admin asset insert" on public.uploaded_assets;
create policy "allow admin asset insert"
  on public.uploaded_assets
  for insert
  to authenticated
  with check (
    auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

drop policy if exists "allow anon asset insert" on public.uploaded_assets;
create policy "allow anon asset insert"
  on public.uploaded_assets
  for insert
  to anon
  with check (true);

create table if not exists public.page_change_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  page_name text not null default 'index',
  request_title text not null,
  request_body text not null,
  requested_by text,
  status text not null default 'open',
  updated_at timestamptz not null default now()
);

alter table public.page_change_requests enable row level security;

drop policy if exists "allow admin request select" on public.page_change_requests;
create policy "allow admin request select"
  on public.page_change_requests
  for select
  to authenticated
  using (
    auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

drop policy if exists "allow anon request select" on public.page_change_requests;
create policy "allow anon request select"
  on public.page_change_requests
  for select
  to anon
  using (true);

drop policy if exists "allow admin request insert" on public.page_change_requests;
create policy "allow admin request insert"
  on public.page_change_requests
  for insert
  to authenticated
  with check (
    auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

drop policy if exists "allow anon request insert" on public.page_change_requests;
create policy "allow anon request insert"
  on public.page_change_requests
  for insert
  to anon
  with check (true);

drop policy if exists "allow admin request update" on public.page_change_requests;
create policy "allow admin request update"
  on public.page_change_requests
  for update
  to authenticated
  using (
    auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  )
  with check (
    auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

drop policy if exists "allow anon request update" on public.page_change_requests;
create policy "allow anon request update"
  on public.page_change_requests
  for update
  to anon
  using (true)
  with check (true);

insert into storage.buckets (id, name, public)
values ('ritsrobo-assets', 'ritsrobo-assets', false)
on conflict (id) do nothing;

drop policy if exists "allow admin storage select" on storage.objects;
create policy "allow admin storage select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ritsrobo-assets'
    and auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

drop policy if exists "allow anon storage select" on storage.objects;
create policy "allow anon storage select"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'ritsrobo-assets');

drop policy if exists "allow admin storage insert" on storage.objects;
create policy "allow admin storage insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'ritsrobo-assets'
    and auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

drop policy if exists "allow anon storage insert" on storage.objects;
create policy "allow anon storage insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'ritsrobo-assets');

drop policy if exists "allow admin storage update" on storage.objects;
create policy "allow admin storage update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'ritsrobo-assets'
    and auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  )
  with check (
    bucket_id = 'ritsrobo-assets'
    and auth.jwt() ->> 'email' = any (array['YOUR_ADMIN_EMAIL@example.com'])
  );

drop policy if exists "allow anon storage update" on storage.objects;
create policy "allow anon storage update"
  on storage.objects
  for update
  to anon
  using (bucket_id = 'ritsrobo-assets')
  with check (bucket_id = 'ritsrobo-assets');
