-- ============================================================
-- Phase 6 Pose Engine v1 Schema
-- ============================================================

create table if not exists public.pose_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_entry_id uuid references public.workout_entries (id) on delete set null,
  canonical_exercise_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  device_info jsonb,
  created_at timestamptz not null default now()
);

alter table public.pose_sessions enable row level security;

drop policy if exists "pose_sessions_select_own" on public.pose_sessions;
create policy "pose_sessions_select_own"
  on public.pose_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "pose_sessions_modify_own" on public.pose_sessions;
create policy "pose_sessions_modify_own"
  on public.pose_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.pose_frames (
  id uuid primary key default gen_random_uuid(),
  pose_session_id uuid not null references public.pose_sessions (id) on delete cascade,
  frame_index integer not null,
  ts timestamptz not null,
  quality_score numeric(6,2),
  created_at timestamptz not null default now()
);

alter table public.pose_frames enable row level security;

drop policy if exists "pose_frames_select_own" on public.pose_frames;
create policy "pose_frames_select_own"
  on public.pose_frames
  for select
  using (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_frames.pose_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_frames_modify_own" on public.pose_frames;
create policy "pose_frames_modify_own"
  on public.pose_frames
  for all
  using (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_frames.pose_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_frames.pose_session_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_joints (
  id uuid primary key default gen_random_uuid(),
  pose_frame_id uuid not null references public.pose_frames (id) on delete cascade,
  joint_name text not null,
  x numeric(10,6),
  y numeric(10,6),
  z numeric(10,6),
  confidence numeric(5,2),
  created_at timestamptz not null default now()
);

alter table public.pose_joints enable row level security;

drop policy if exists "pose_joints_select_own" on public.pose_joints;
create policy "pose_joints_select_own"
  on public.pose_joints
  for select
  using (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_joints.pose_frame_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_joints_modify_own" on public.pose_joints;
create policy "pose_joints_modify_own"
  on public.pose_joints
  for all
  using (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_joints.pose_frame_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_joints.pose_frame_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_angles (
  id uuid primary key default gen_random_uuid(),
  pose_frame_id uuid not null references public.pose_frames (id) on delete cascade,
  angles jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pose_angles enable row level security;

drop policy if exists "pose_angles_select_own" on public.pose_angles;
create policy "pose_angles_select_own"
  on public.pose_angles
  for select
  using (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_angles.pose_frame_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_angles_modify_own" on public.pose_angles;
create policy "pose_angles_modify_own"
  on public.pose_angles
  for all
  using (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_angles.pose_frame_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_angles.pose_frame_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_quality_scores (
  id uuid primary key default gen_random_uuid(),
  pose_session_id uuid not null references public.pose_sessions (id) on delete cascade,
  pose_quality_score numeric(6,2) not null,
  stability_score numeric(6,2),
  symmetry_score numeric(6,2),
  tempo_score numeric(6,2),
  created_at timestamptz not null default now()
);

alter table public.pose_quality_scores enable row level security;

drop policy if exists "pose_quality_scores_select_own" on public.pose_quality_scores;
create policy "pose_quality_scores_select_own"
  on public.pose_quality_scores
  for select
  using (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_quality_scores.pose_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_quality_scores_modify_own" on public.pose_quality_scores;
create policy "pose_quality_scores_modify_own"
  on public.pose_quality_scores
  for all
  using (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_quality_scores.pose_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_quality_scores.pose_session_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_guard_flags (
  id uuid primary key default gen_random_uuid(),
  pose_session_id uuid not null references public.pose_sessions (id) on delete cascade,
  flag_type text not null,
  severity text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.pose_guard_flags enable row level security;

drop policy if exists "pose_guard_flags_select_own" on public.pose_guard_flags;
create policy "pose_guard_flags_select_own"
  on public.pose_guard_flags
  for select
  using (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_guard_flags.pose_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_guard_flags_modify_own" on public.pose_guard_flags;
create policy "pose_guard_flags_modify_own"
  on public.pose_guard_flags
  for all
  using (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_guard_flags.pose_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_guard_flags.pose_session_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_deviations (
  id uuid primary key default gen_random_uuid(),
  pose_frame_id uuid not null references public.pose_frames (id) on delete cascade,
  joint text not null,
  observed numeric(6,2) not null,
  expected_min numeric(6,2) not null,
  expected_max numeric(6,2) not null,
  severity text not null,
  created_at timestamptz not null default now()
);

alter table public.pose_deviations enable row level security;

drop policy if exists "pose_deviations_select_own" on public.pose_deviations;
create policy "pose_deviations_select_own"
  on public.pose_deviations
  for select
  using (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_deviations.pose_frame_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_deviations_modify_own" on public.pose_deviations;
create policy "pose_deviations_modify_own"
  on public.pose_deviations
  for all
  using (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_deviations.pose_frame_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.pose_frames f
      join public.pose_sessions s on s.id = f.pose_session_id
      where f.id = pose_deviations.pose_frame_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_feedback_events (
  id uuid primary key default gen_random_uuid(),
  pose_session_id uuid not null references public.pose_sessions (id) on delete cascade,
  event_type text not null,
  message text not null,
  confidence numeric(5,2),
  created_at timestamptz not null default now()
);

alter table public.pose_feedback_events enable row level security;

drop policy if exists "pose_feedback_events_select_own" on public.pose_feedback_events;
create policy "pose_feedback_events_select_own"
  on public.pose_feedback_events
  for select
  using (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_feedback_events.pose_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_feedback_events_modify_own" on public.pose_feedback_events;
create policy "pose_feedback_events_modify_own"
  on public.pose_feedback_events
  for all
  using (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_feedback_events.pose_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_sessions s
      where s.id = pose_feedback_events.pose_session_id
        and s.user_id = auth.uid()
    )
  );

create index if not exists pose_sessions_user_idx
  on public.pose_sessions (user_id, started_at desc);

create index if not exists pose_frames_session_idx
  on public.pose_frames (pose_session_id, frame_index);

create index if not exists pose_joints_frame_idx
  on public.pose_joints (pose_frame_id);

-- ============================================================
-- Phase 6.2 Pose Engine v2 (3D Core)
-- ============================================================

create table if not exists public.pose_3d_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pose_session_id uuid references public.pose_sessions (id) on delete set null,
  workout_entry_id uuid references public.workout_entries (id) on delete set null,
  canonical_exercise_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  device_info jsonb,
  created_at timestamptz not null default now()
);

alter table public.pose_3d_sessions enable row level security;

drop policy if exists "pose_3d_sessions_select_own" on public.pose_3d_sessions;
create policy "pose_3d_sessions_select_own"
  on public.pose_3d_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "pose_3d_sessions_modify_own" on public.pose_3d_sessions;
create policy "pose_3d_sessions_modify_own"
  on public.pose_3d_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.pose_3d_joints (
  id uuid primary key default gen_random_uuid(),
  pose_3d_session_id uuid not null references public.pose_3d_sessions (id) on delete cascade,
  frame_index integer not null,
  ts timestamptz not null,
  joint_name text not null,
  x numeric(10,6),
  y numeric(10,6),
  z numeric(10,6),
  confidence numeric(5,2),
  created_at timestamptz not null default now()
);

alter table public.pose_3d_joints enable row level security;

drop policy if exists "pose_3d_joints_select_own" on public.pose_3d_joints;
create policy "pose_3d_joints_select_own"
  on public.pose_3d_joints
  for select
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_joints.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_3d_joints_modify_own" on public.pose_3d_joints;
create policy "pose_3d_joints_modify_own"
  on public.pose_3d_joints
  for all
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_joints.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_joints.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_3d_angles (
  id uuid primary key default gen_random_uuid(),
  pose_3d_session_id uuid not null references public.pose_3d_sessions (id) on delete cascade,
  frame_index integer not null,
  ts timestamptz not null,
  angles jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pose_3d_angles enable row level security;

drop policy if exists "pose_3d_angles_select_own" on public.pose_3d_angles;
create policy "pose_3d_angles_select_own"
  on public.pose_3d_angles
  for select
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_angles.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_3d_angles_modify_own" on public.pose_3d_angles;
create policy "pose_3d_angles_modify_own"
  on public.pose_3d_angles
  for all
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_angles.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_angles.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

create index if not exists pose_3d_sessions_user_idx
  on public.pose_3d_sessions (user_id, started_at desc);

create index if not exists pose_3d_joints_session_idx
  on public.pose_3d_joints (pose_3d_session_id, frame_index);

create index if not exists pose_3d_angles_session_idx
  on public.pose_3d_angles (pose_3d_session_id, frame_index);

-- ============================================================
-- Phase 6.2 Biomechanics + Risk Guard v2
-- ============================================================

create table if not exists public.pose_biomechanics (
  id uuid primary key default gen_random_uuid(),
  pose_3d_session_id uuid not null references public.pose_3d_sessions (id) on delete cascade,
  frame_index integer not null,
  ts timestamptz not null,
  metrics jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pose_biomechanics enable row level security;

drop policy if exists "pose_biomechanics_select_own" on public.pose_biomechanics;
create policy "pose_biomechanics_select_own"
  on public.pose_biomechanics
  for select
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_biomechanics.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_biomechanics_modify_own" on public.pose_biomechanics;
create policy "pose_biomechanics_modify_own"
  on public.pose_biomechanics
  for all
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_biomechanics.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_biomechanics.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  pose_3d_session_id uuid not null references public.pose_3d_sessions (id) on delete cascade,
  frame_index integer not null,
  ts timestamptz not null,
  risk_level text not null check (risk_level in ('safe','caution','danger')),
  guard_flags text[] not null default '{}',
  guard_reason text,
  created_at timestamptz not null default now()
);

alter table public.pose_risk_assessments enable row level security;

drop policy if exists "pose_risk_assessments_select_own" on public.pose_risk_assessments;
create policy "pose_risk_assessments_select_own"
  on public.pose_risk_assessments
  for select
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_risk_assessments.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_risk_assessments_modify_own" on public.pose_risk_assessments;
create policy "pose_risk_assessments_modify_own"
  on public.pose_risk_assessments
  for all
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_risk_assessments.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_risk_assessments.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

create index if not exists pose_biomechanics_session_idx
  on public.pose_biomechanics (pose_3d_session_id, frame_index);

create index if not exists pose_risk_assessments_session_idx
  on public.pose_risk_assessments (pose_3d_session_id, frame_index);

-- ============================================================
-- Phase 6.2 Kinematics + Load Estimation
-- ============================================================

create table if not exists public.pose_3d_metrics (
  id uuid primary key default gen_random_uuid(),
  pose_3d_session_id uuid not null references public.pose_3d_sessions (id) on delete cascade,
  frame_index integer not null,
  ts timestamptz not null,
  metrics jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pose_3d_metrics enable row level security;

drop policy if exists "pose_3d_metrics_select_own" on public.pose_3d_metrics;
create policy "pose_3d_metrics_select_own"
  on public.pose_3d_metrics
  for select
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_metrics.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_3d_metrics_modify_own" on public.pose_3d_metrics;
create policy "pose_3d_metrics_modify_own"
  on public.pose_3d_metrics
  for all
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_metrics.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_3d_metrics.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

create table if not exists public.pose_load_estimates (
  id uuid primary key default gen_random_uuid(),
  pose_3d_session_id uuid not null references public.pose_3d_sessions (id) on delete cascade,
  frame_index integer not null,
  ts timestamptz not null,
  estimates jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pose_load_estimates enable row level security;

drop policy if exists "pose_load_estimates_select_own" on public.pose_load_estimates;
create policy "pose_load_estimates_select_own"
  on public.pose_load_estimates
  for select
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_load_estimates.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_load_estimates_modify_own" on public.pose_load_estimates;
create policy "pose_load_estimates_modify_own"
  on public.pose_load_estimates
  for all
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_load_estimates.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_load_estimates.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

create index if not exists pose_3d_metrics_session_idx
  on public.pose_3d_metrics (pose_3d_session_id, frame_index);

create index if not exists pose_load_estimates_session_idx
  on public.pose_load_estimates (pose_3d_session_id, frame_index);

-- ============================================================
-- Phase 6.2 Real-time Voice Cues Telemetry
-- ============================================================

create table if not exists public.pose_voice_cues (
  id uuid primary key default gen_random_uuid(),
  pose_3d_session_id uuid not null references public.pose_3d_sessions (id) on delete cascade,
  cue_type text not null,
  priority text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.pose_voice_cues enable row level security;

drop policy if exists "pose_voice_cues_select_own" on public.pose_voice_cues;
create policy "pose_voice_cues_select_own"
  on public.pose_voice_cues
  for select
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_voice_cues.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "pose_voice_cues_modify_own" on public.pose_voice_cues;
create policy "pose_voice_cues_modify_own"
  on public.pose_voice_cues
  for all
  using (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_voice_cues.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pose_3d_sessions s
      where s.id = pose_voice_cues.pose_3d_session_id
        and s.user_id = auth.uid()
    )
  );
