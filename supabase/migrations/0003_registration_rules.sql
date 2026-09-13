-- Versioned registration rules. The UI must read these rules instead of hardcoding them.
create table if not exists registration_rules (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  education_band text not null check (education_band in ('lower_secondary','upper_secondary','higher_education')),
  grade_level smallint check (grade_level between 1 and 6),
  dhamma_level text not null check (dhamma_level in ('ตรี','โท','เอก')),
  required_for_grade boolean not null default false,
  enabled boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (academic_year_id, education_band, grade_level, dhamma_level)
);

alter table registration_rules enable row level security;

create or replace function public.registration_is_required(
  requested_year uuid,
  requested_band text,
  requested_grade smallint,
  requested_level text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select required_for_grade from registration_rules
    where academic_year_id = requested_year
      and education_band = requested_band
      and grade_level = requested_grade
      and dhamma_level = requested_level
      and enabled), false);
$$;

revoke all on function public.registration_is_required(uuid, text, smallint, text) from public;
grant execute on function public.registration_is_required(uuid, text, smallint, text) to authenticated;

comment on table registration_rules is
  'Year-versioned school registration policy. Current baseline requires ตรี for M.1 and M.4 only.';
