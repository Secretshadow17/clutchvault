-- ClutchVault: Step 2b (anti-fraud verification codes)
-- Run once in Supabase: SQL Editor > New query > paste all > Run.
-- Requires step1_database.sql and step2_database.sql to have been run first.

-- ============ One-time verification codes ============
create table if not exists public.claim_codes (
  code       text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  used       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.claim_codes enable row level security;

-- Players can only READ their own codes. Nobody can insert or edit from the website;
-- codes are created only by the function below.
drop policy if exists "read own codes or admin" on public.claim_codes;
create policy "read own codes or admin" on public.claim_codes
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.claim_codes from anon;

create or replace function public.new_claim_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  c text;
  tries int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;
  if (select count(*) from public.claim_codes
      where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many codes requested. Try again later.';
  end if;
  loop
    c := 'CV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    begin
      insert into public.claim_codes (code, user_id) values (c, auth.uid());
      return c;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 5 then raise; end if;
    end;
  end loop;
end;
$$;

revoke all on function public.new_claim_code() from public, anon;
grant execute on function public.new_claim_code() to authenticated;

-- ============ Claims must carry a fresh, unused code that belongs to the player ============
alter table public.tier_claims add column if not exists verify_code text;

create unique index if not exists tier_claims_verify_code_once
  on public.tier_claims (verify_code) where verify_code is not null;

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
    and exists (
      select 1 from public.claim_codes cc
      where cc.code = verify_code
        and cc.user_id = auth.uid()
        and cc.used = false
        and cc.created_at > now() - interval '30 minutes'
    )
  );

-- Mark the code as used the moment the claim is saved
create or replace function public.mark_code_used()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.claim_codes set used = true
  where code = new.verify_code and user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists tier_claims_mark_code on public.tier_claims;
create trigger tier_claims_mark_code
  after insert on public.tier_claims
  for each row execute function public.mark_code_used();
