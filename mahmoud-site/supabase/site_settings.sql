-- One-time setup for the admin "Site" tab (homepage photo, about text,
-- video, contact details). Safe to run more than once.

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
  on public.site_settings for select
  using (true);

drop policy if exists "Signed-in admin can add site settings" on public.site_settings;
create policy "Signed-in admin can add site settings"
  on public.site_settings for insert to authenticated
  with check (true);

drop policy if exists "Signed-in admin can change site settings" on public.site_settings;
create policy "Signed-in admin can change site settings"
  on public.site_settings for update to authenticated
  using (true) with check (true);
