-- Public aggregate API and deterministic matching helpers.
-- Personal records remain protected by RLS. Firebase remains read-only.

create or replace function public.dharma_normalize_name(input_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    lower(translate(coalesce(input_text, ''), '๐๑๒๓๔๕๖๗๘๙', '0123456789')),
    '[[:space:]\\-_/\\.]+',
    '',
    'g'
  );
$$;

create or replace function public.public_dashboard_metrics()
returns table (
  academic_year text,
  current_students bigint,
  submitted_registrations bigint,
  verified_registrations bigint,
  pending_official_eligibility bigint,
  imported_eligibility bigint,
  imported_seats bigint,
  imported_results bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    y.year_be,
    count(distinct s.id) filter (where s.status = 'active'),
    count(distinct r.id) filter (where r.application_status = 'submitted'),
    count(distinct r.id) filter (where r.application_status = 'verified'),
    count(distinct r.id) filter (where e.id is null),
    count(distinct e.id),
    count(distinct seat.id),
    count(distinct result.id)
  from academic_years y
  left join classrooms c on c.academic_year_id = y.id and c.active
  left join students s on s.classroom_id = c.id
  left join exam_registrations r on r.academic_year_id = y.id
  left join exam_eligibility e on e.registration_id = r.id
  left join exam_seats seat on seat.registration_id = r.id
  left join exam_results result on result.registration_id = r.id
  group by y.id, y.year_be
  order by y.year_be desc;
$$;

revoke all on function public.public_dashboard_metrics() from public;
grant execute on function public.public_dashboard_metrics() to anon, authenticated;

comment on function public.public_dashboard_metrics() is
  'Aggregate-only public dashboard data. Never returns student names, IDs, or certificate numbers.';
