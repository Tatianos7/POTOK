-- ============================================================
-- Phase 7.3.2 Monetization & Subscription Layer (v1)
-- ============================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free','pro','vision_pro')),
  status text not null check (status in ('active','canceled','past_due','trial')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tier text not null check (tier in ('free','pro','vision_pro','coach')),
  flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('app_store','play_store','vision_pro')),
  event_type text not null,
  idempotency_key text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  enabled boolean not null default false,
  audience jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_idx
  on public.subscriptions (user_id);
create unique index if not exists entitlements_user_idx
  on public.entitlements (user_id);
create unique index if not exists billing_events_idempotency_idx
  on public.billing_events (idempotency_key);

alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.billing_events enable row level security;
alter table public.feature_flags enable row level security;

create policy "subscriptions_owner"
  on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "entitlements_owner"
  on public.entitlements
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "billing_events_owner"
  on public.billing_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "feature_flags_read"
  on public.feature_flags
  for select
  using (true);

create or replace function public.get_entitlements(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  resolved_user uuid;
  row_ent public.entitlements;
begin
  resolved_user := coalesce(p_user_id, auth.uid());
  if resolved_user is null then
    return jsonb_build_object('tier','free','flags',jsonb_build_object());
  end if;

  select * into row_ent from public.entitlements where user_id = resolved_user;
  if row_ent.id is null then
    return jsonb_build_object('tier','free','flags',jsonb_build_object(
      'can_view_plan', true,
      'can_adapt', false,
      'can_explain', false,
      'can_voice', false,
      'can_spatial', false
    ));
  end if;

  return jsonb_build_object('tier', row_ent.tier, 'flags', row_ent.flags);
end;
$$;

create or replace function public.get_paywall_state(p_feature text, p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  ent jsonb;
  tier text;
  flags jsonb;
begin
  ent := public.get_entitlements(p_user_id);
  tier := ent->>'tier';
  flags := ent->'flags';

  if (p_feature = 'adaptation' and coalesce((flags->>'can_adapt')::boolean, false) = false) then
    return jsonb_build_object('locked', true, 'required_tier', 'pro', 'reason', 'adaptation_locked');
  end if;
  if (p_feature = 'explainability' and coalesce((flags->>'can_explain')::boolean, false) = false) then
    return jsonb_build_object('locked', true, 'required_tier', 'pro', 'reason', 'explainability_locked');
  end if;
  if (p_feature = 'spatial' and coalesce((flags->>'can_spatial')::boolean, false) = false) then
    return jsonb_build_object('locked', true, 'required_tier', 'vision_pro', 'reason', 'spatial_locked');
  end if;

  return jsonb_build_object('locked', false, 'tier', tier);
end;
$$;

create or replace function public.start_purchase(p_user_id uuid, p_provider text, p_plan text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
as $$
begin
  insert into public.billing_events (user_id, provider, event_type, idempotency_key, payload)
  values (p_user_id, p_provider, 'purchase_started', p_idempotency_key, jsonb_build_object('plan', p_plan))
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('status','started','plan',p_plan);
end;
$$;

create or replace function public.restore_purchase(p_user_id uuid, p_provider text, p_receipt text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
as $$
begin
  insert into public.billing_events (user_id, provider, event_type, idempotency_key, payload)
  values (p_user_id, p_provider, 'restore', p_idempotency_key, jsonb_build_object('receipt', p_receipt))
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object('status','restored');
end;
$$;
