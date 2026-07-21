-- ═══════════════════════════════════════════════════════════
-- 017  hero_images: admin-managed home banner slideshow
-- ═══════════════════════════════════════════════════════════
-- Lets the restaurant admin upload/remove the rotating hero images
-- from the dashboard. Image FILES live in the "hero" Storage bucket;
-- this table just holds their public URLs and display order.

create table if not exists public.hero_images (
  id          uuid primary key default gen_random_uuid(),
  image_url   text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.hero_images enable row level security;

-- Anyone can read (the public menu shows them)
drop policy if exists "hero_images_select_all" on public.hero_images;
create policy "hero_images_select_all"
  on public.hero_images for select
  using (true);

-- Only staff (restaurant/rider) can add / reorder / remove
drop policy if exists "hero_images_insert_staff" on public.hero_images;
create policy "hero_images_insert_staff"
  on public.hero_images for insert
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('restaurant', 'rider')
  ));

drop policy if exists "hero_images_update_staff" on public.hero_images;
create policy "hero_images_update_staff"
  on public.hero_images for update
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('restaurant', 'rider')
  ));

drop policy if exists "hero_images_delete_staff" on public.hero_images;
create policy "hero_images_delete_staff"
  on public.hero_images for delete
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('restaurant', 'rider')
  ));

-- ── Storage bucket for the actual image files ──────────────
insert into storage.buckets (id, name, public)
values ('hero', 'hero', true)
on conflict (id) do nothing;

-- Public can read files; only staff can upload/replace/delete
drop policy if exists "hero_bucket_public_read" on storage.objects;
create policy "hero_bucket_public_read"
  on storage.objects for select
  using (bucket_id = 'hero');

drop policy if exists "hero_bucket_staff_insert" on storage.objects;
create policy "hero_bucket_staff_insert"
  on storage.objects for insert
  with check (bucket_id = 'hero' and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('restaurant', 'rider')
  ));

drop policy if exists "hero_bucket_staff_update" on storage.objects;
create policy "hero_bucket_staff_update"
  on storage.objects for update
  using (bucket_id = 'hero' and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('restaurant', 'rider')
  ));

drop policy if exists "hero_bucket_staff_delete" on storage.objects;
create policy "hero_bucket_staff_delete"
  on storage.objects for delete
  using (bucket_id = 'hero' and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('restaurant', 'rider')
  ));
