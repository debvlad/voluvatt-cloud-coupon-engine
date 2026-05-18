-- Võluvatt Cloud Coupon Engine initial schema
-- Run this in Supabase SQL Editor or via `supabase db push`.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null check (role in ('owner','admin','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  default_expiry_days int not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  short_code text unique not null,
  claim_path text unique,
  reward_type_id uuid not null references public.reward_types(id),
  status text not null check (status in ('issued','redeemed','expired','cancelled')) default 'issued',
  issued_reason text,
  customer_label text,
  customer_contact text,
  notes text,
  expires_at timestamptz not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  redeemed_event text,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  constraint redeemed_fields_match check (
    (status = 'redeemed' and redeemed_at is not null) or status <> 'redeemed'
  ),
  constraint cancelled_fields_match check (
    (status = 'cancelled' and cancelled_at is not null) or status <> 'cancelled'
  )
);

create table if not exists public.coupon_scan_logs (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references public.coupons(id),
  token_hash text,
  scan_result text,
  scanned_by uuid references auth.users(id),
  scanned_at timestamptz not null default now(),
  device_info text,
  event_name text
);

create index if not exists coupons_token_hash_idx on public.coupons(token_hash);
create index if not exists coupons_short_code_idx on public.coupons(short_code);
create index if not exists coupons_claim_path_idx on public.coupons(claim_path);
create index if not exists coupons_status_idx on public.coupons(status);
create index if not exists coupons_expires_at_idx on public.coupons(expires_at);
create index if not exists coupons_created_at_idx on public.coupons(created_at desc);
create index if not exists coupon_scan_logs_scanned_at_idx on public.coupon_scan_logs(scanned_at desc);

insert into public.reward_types (name, description, default_expiry_days, active)
values
  ('Free Small Cloud', 'One free small Võluvatt cotton candy cloud.', 30, true),
  ('€3 Magic Wand Credit', 'A €3 credit toward a light-up Magic Wand cotton candy.', 30, true),
  ('Free Magic Swirl', 'One free Magic Swirl reward.', 30, true),
  ('Free Birthday Child Magic Wand', 'Birthday child receives a free Magic Wand reward.', 14, true),
  ('Bonus Passport Punch', 'Bonus Cloud Passport punch.', 60, true),
  ('Secret Flavor Unlock', 'Unlock the current Secret Flavor.', 14, true)
on conflict do nothing;

-- Role helpers. Security definer avoids recursive RLS when policies inspect profiles.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active = true;
$$;

create or replace function public.is_owner_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('owner','admin')
  );
$$;

create or replace function public.is_staff_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role in ('owner','admin','staff')
  );
$$;

-- Atomic redemption: one UPDATE with RETURNING. If two scans race, only one can win.
create or replace function public.redeem_coupon_atomic(
  p_token_hash text,
  p_redeemed_by uuid,
  p_event_name text default null
)
returns table (
  result text,
  coupon_id uuid,
  safe_status text,
  reward_name text,
  expires_at timestamptz,
  redeemed_at timestamptz,
  cancelled_at timestamptz,
  short_code text,
  customer_label text,
  issued_reason text,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_reward_name text;
begin
  update public.coupons c
    set status = 'redeemed',
        redeemed_by = p_redeemed_by,
        redeemed_at = now(),
        redeemed_event = p_event_name
  where c.token_hash = p_token_hash
    and c.status = 'issued'
    and c.expires_at > now()
  returning * into v_coupon;

  if found then
    select rt.name into v_reward_name from public.reward_types rt where rt.id = v_coupon.reward_type_id;
    return query select
      'success'::text,
      v_coupon.id,
      'redeemed'::text,
      v_reward_name,
      v_coupon.expires_at,
      v_coupon.redeemed_at,
      v_coupon.cancelled_at,
      v_coupon.short_code,
      v_coupon.customer_label,
      v_coupon.issued_reason,
      'Coupon redeemed successfully.'::text;
    return;
  end if;

  select * into v_coupon from public.coupons c where c.token_hash = p_token_hash;

  if not found then
    return query select
      'invalid'::text, null::uuid, 'invalid'::text, null::text, null::timestamptz,
      null::timestamptz, null::timestamptz, null::text, null::text, null::text,
      'Coupon is invalid.'::text;
    return;
  end if;

  select rt.name into v_reward_name from public.reward_types rt where rt.id = v_coupon.reward_type_id;

  if v_coupon.status = 'redeemed' then
    return query select
      'already_redeemed'::text, v_coupon.id, 'redeemed'::text, v_reward_name, v_coupon.expires_at,
      v_coupon.redeemed_at, v_coupon.cancelled_at, v_coupon.short_code, v_coupon.customer_label,
      v_coupon.issued_reason, 'Coupon was already redeemed.'::text;
    return;
  end if;

  if v_coupon.status = 'cancelled' then
    return query select
      'cancelled'::text, v_coupon.id, 'cancelled'::text, v_reward_name, v_coupon.expires_at,
      v_coupon.redeemed_at, v_coupon.cancelled_at, v_coupon.short_code, v_coupon.customer_label,
      v_coupon.issued_reason, 'Coupon was disabled.'::text;
    return;
  end if;

  if v_coupon.status = 'expired' or v_coupon.expires_at <= now() then
    return query select
      'expired'::text, v_coupon.id, 'expired'::text, v_reward_name, v_coupon.expires_at,
      v_coupon.redeemed_at, v_coupon.cancelled_at, v_coupon.short_code, v_coupon.customer_label,
      v_coupon.issued_reason, 'Coupon is expired.'::text;
    return;
  end if;

  return query select
    'not_redeemable'::text, v_coupon.id, v_coupon.status, v_reward_name, v_coupon.expires_at,
    v_coupon.redeemed_at, v_coupon.cancelled_at, v_coupon.short_code, v_coupon.customer_label,
    v_coupon.issued_reason, 'Coupon cannot be redeemed.'::text;
end;
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_owner_or_admin() to authenticated;
grant execute on function public.is_staff_or_above() to authenticated;
grant execute on function public.redeem_coupon_atomic(text, uuid, text) to service_role;

alter table public.profiles enable row level security;
alter table public.reward_types enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_scan_logs enable row level security;

-- Profiles: users can see themselves; owner/admin can see users for staff management.
drop policy if exists "Profiles select self or admin" on public.profiles;
create policy "Profiles select self or admin"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_owner_or_admin());

-- Reward types are safe for authenticated admin UI. Writes happen through SQL/admin only for MVP.
drop policy if exists "Reward types select authenticated" on public.reward_types;
create policy "Reward types select authenticated"
  on public.reward_types for select to authenticated
  using (true);

-- Coupons contain personal notes/contact, so only owner/admin can read directly.
drop policy if exists "Coupons select admin" on public.coupons;
create policy "Coupons select admin"
  on public.coupons for select to authenticated
  using (public.is_owner_or_admin());

-- Scan logs are admin-only.
drop policy if exists "Scan logs select admin" on public.coupon_scan_logs;
create policy "Scan logs select admin"
  on public.coupon_scan_logs for select to authenticated
  using (public.is_owner_or_admin());
