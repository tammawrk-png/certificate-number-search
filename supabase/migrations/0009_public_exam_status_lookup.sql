-- Public lookup boundary for official eligibility, seat and result data.
-- No row is returned until at least one official record has been imported.
create or replace function public.lookup_public_exam_status(
  requested_year text,
  requested_query text
)
returns table (
  student_number text,
  full_name text,
  dhamma_level text,
  eligibility_status text,
  room_name text,
  seat_no text,
  result_status text,
  score text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.student_number,
    s.full_name,
    r.dhamma_level,
    e.eligibility_status,
    er.room_name,
    seat.seat_no,
    result.result_status,
    result.score
  from academic_years y
  join exam_registrations r on r.academic_year_id = y.id
  join students s on s.id = r.student_id and s.status = 'active'
  left join exam_eligibility e on e.registration_id = r.id
  left join exam_seats seat on seat.registration_id = r.id
  left join exam_rooms er on er.id = seat.exam_room_id
  left join exam_results result on result.registration_id = r.id
  where y.year_be = trim(requested_year)
    and nullif(trim(requested_query), '') is not null
    and (
      s.student_number = trim(requested_query)
      or public.dharma_normalize_name(s.full_name) = public.dharma_normalize_name(requested_query)
    )
    and (e.id is not null or seat.id is not null or result.id is not null)
  order by s.full_name, r.dhamma_level;
$$;

revoke all on function public.lookup_public_exam_status(text, text) from public;
grant execute on function public.lookup_public_exam_status(text, text) to anon, authenticated;

comment on function public.lookup_public_exam_status(text, text) is
  'Exact public exam lookup. Returns only records with imported official eligibility, seat, or result data.';
