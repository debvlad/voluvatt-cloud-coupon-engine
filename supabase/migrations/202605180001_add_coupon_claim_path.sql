-- Store the public claim path for newly generated coupons.
-- Existing coupons keep NULL because the raw token was intentionally not stored.

alter table public.coupons
  add column if not exists claim_path text unique;

create index if not exists coupons_claim_path_idx on public.coupons(claim_path);
