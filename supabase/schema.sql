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
