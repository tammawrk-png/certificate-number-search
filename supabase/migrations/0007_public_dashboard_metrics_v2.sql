-- Non-destructive successor to public_dashboard_metrics().
-- The original RPC remains available for compatibility; this version adds
-- an aggregate count of current students with reviewed historical matches.
create or replace function public.public_dashboard_metrics_v2()
returns table (
  academic_year text,
  current_students bigint,
  matched_students bigint,
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
    (select count(*) from students s where s.status = 'active'),
    (select count(distinct cm.student_id)
       from certificate_matches cm
       join students ms on ms.id = cm.student_id
      where ms.status = 'active'
        and cm.status in ('auto_matched', 'confirmed')),
    (select count(*) from exam_registrations r
      where r.academic_year_id = y.id and r.application_status = 'submitted'),
    (select count(*) from exam_registrations r
      where r.academic_year_id = y.id and r.application_status = 'verified'),
    (select count(*) from exam_registrations r
      left join exam_eligibility e on e.registration_id = r.id
      where r.academic_year_id = y.id and e.id is null),
    (select count(*) from exam_eligibility e
      join exam_registrations r on r.id = e.registration_id
      where r.academic_year_id = y.id),
    (select count(*) from exam_seats seat
      join exam_registrations r on r.id = seat.registration_id
      where r.academic_year_id = y.id),
    (select count(*) from exam_results result
      join exam_registrations r on r.id = result.registration_id
      where r.academic_year_id = y.id)
  from academic_years y
  order by y.year_be desc;
$$;

revoke all on function public.public_dashboard_metrics_v2() from public;
grant execute on function public.public_dashboard_metrics_v2() to anon, authenticated;

comment on function public.public_dashboard_metrics_v2() is
  'Aggregate-only public dashboard data including reviewed historical match count.';
