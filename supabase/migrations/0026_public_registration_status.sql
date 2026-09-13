-- Let the public flow distinguish a first application from an update.
create or replace function public.public_student_registration_status(
  requested_year text,
  requested_student_number text
)
returns table (
  dhamma_level text,
  application_status text,
  submitted_at timestamptz,
  reference_code text
)
language sql stable security definer set search_path = public
as $$
  select r.dhamma_level, r.application_status, r.submitted_at,
    concat(trim(requested_year), '-', upper(substr(replace(r.id::text, '-', ''), 1, 8)))
  from exam_registrations r
  join students s on s.id = r.student_id and s.status = 'active'
  join academic_years y on y.id = r.academic_year_id and y.year_be = trim(requested_year)
  where s.student_number = trim(requested_student_number)
    and r.application_status <> 'cancelled'
  order by r.dhamma_level;
$$;

revoke all on function public.public_student_registration_status(text, text) from public;
grant execute on function public.public_student_registration_status(text, text) to anon, authenticated;
