-- ClutchVault: Step 2 database (tier reward claims + private screenshot storage)
-- Run once in Supabase: SQL Editor > New query > paste all > Run.
-- Requires step1_database.sql to have been run first.

-- ============ Claims ============
create table if not exists public.tier_claims (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  season      text not null check (char_length(season) between 1 and 20),
  tier        text not null check (char_length(tier) between 1 and 40),
  points      integer check (points is null or (points >= 0 and points <= 100000)),
  proof_path  text not null check (char_length(proof_path) <= 200),
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected', 'paid')),
  admin_note  text check (admin_note is null or char_length(admin_note) <= 300),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- One live claim per player per tier per season (a rejected claim can be re-submitted)
create unique index if not exists tier_claims_one_live_claim
  on public.tier_claims (user_id, season, tier) where status <> 'rejected';

create index if not exists tier_claims_status_idx on public.tier_claims (status, created_at desc);

alter table public.tier_claims enable row level security;

-- Block spam: at most 5 pending claims per player at a time
create or replace function public.limit_pending_claims()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.tier_claims
      where user_id = new.user_id and status = 'pending') >= 5 then
    raise exception 'Too many pending claims. Wait for review before sending more.';
  end if;
  return new;
end;
$$;

drop trigger if exists tier_claims_limit on public.tier_claims;
create trigger tier_claims_limit
  before insert on public.tier_claims
  for each row execute function public.limit_pending_claims();

-- Players can create their OWN pending claim, only after saving a BGMI ID,
-- and only pointing at a screenshot inside their own folder.
drop policy if exists "players create own claim" on public.tier_claims;
create policy "players create own claim" on public.tier_claims
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and admin_note is null
    and reviewed_by is null
    and reviewed_at is null
    and proof_path like auth.uid()::text || '/%'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.bgmi_id is not null)
  );

drop policy if exists "read own claims or admin" on public.tier_claims;
create policy "read own claims or admin" on public.tier_claims
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Only admins can review (approve / reject / mark paid) or remove claims
drop policy if exists "admin review claims" on public.tier_claims;
create policy "admin review claims" on public.tier_claims
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete claims" on public.tier_claims;
create policy "admin delete claims" on public.tier_claims
  for delete to authenticated using (public.is_admin());

revoke all on public.tier_claims from anon;

-- ============ Private storage for rank screenshots ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rank-proofs', 'rank-proofs', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 3145728,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "players upload own proofs" on storage.objects;
create policy "players upload own proofs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rank-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "read own proofs or admin" on storage.objects;
create policy "read own proofs or admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'rank-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
