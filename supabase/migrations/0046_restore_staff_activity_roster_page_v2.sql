-- Restore the staff roster RPC used by the administrator activity view.
-- This is a read-only, staff-gated, paged query; it does not modify roster data.
create or replace function public.staff_activity_roster_page_v2(
  requested_year text,
  _page_offset integer,
  _page_limit integer
)
returns table (
  student_id uuid, student_number text, full_name text, education_band text,
  grade_level smallint, room_no smallint, advisor_1 text, advisor_2 text,
  certificate_no text, certificate_year text, legacy_level text, match_status text,
  citizen_id text, birth_iso text, application_level text, previous_certificate_year text,
  exam_status text, special_needs boolean, organization_name text, organization_location text,
  temple_affiliation text, school_council text, notes text
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.student_number, s.full_name, c.education_band, c.grade_level, c.room_no,
    t1.display_name, t2.display_name, coalesce(a.previous_certificate_no, prior.certificate_no),
    coalesce(a.previous_certificate_year, prior.exam_year_be), prior.level, prior.match_status,
    s.citizen_id, case when s.birth_date is null then null else to_char(s.birth_date, 'YYYY-MM-DD') end,
    a.application_level, a.previous_certificate_year, a.exam_status, coalesce(a.special_needs, false),
    a.organization_name, a.organization_location, a.temple_affiliation, a.school_council, a.notes
  from academic_years y
  join classrooms c on c.academic_year_id = y.id and c.active
  join students s on s.classroom_id = c.id and s.status = 'active'
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  left join lateral (
    select afs.*
    from activity_form_submissions afs
    where afs.student_id = s.id and afs.academic_year_id = y.id
    order by afs.updated_at desc
    limit 1
  ) a on true
  left join lateral (
    select lc.certificate_no, lc.exam_year_be, lc.level, cm.status as match_status
    from certificate_matches cm
    join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = s.id and cm.status in ('auto_matched', 'confirmed')
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end desc,
      lc.exam_year_be desc nulls last
    limit 1
  ) prior on true
  where public.is_staff() and y.year_be = trim(requested_year)
  order by c.education_band, c.grade_level, c.room_no, s.student_number
  offset _page_offset
  limit _page_limit;
$$;

revoke all on function public.staff_activity_roster_page_v2(text, integer, integer) from public;
grant execute on function public.staff_activity_roster_page_v2(text, integer, integer) to authenticated;
