-- Staff-only activity roster for the full administrator view.
create or replace function public.staff_activity_roster(requested_year text)
returns table (
  student_id uuid, student_number text, full_name text, education_band text,
  grade_level smallint, room_no smallint, advisor_1 text, advisor_2 text,
  certificate_no text, certificate_year text, legacy_level text, match_status text
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.student_number, s.full_name, c.education_band, c.grade_level, c.room_no,
    t1.display_name, t2.display_name, prior.certificate_no, prior.exam_year_be,
    prior.level, prior.match_status
  from academic_years y
  join classrooms c on c.academic_year_id = y.id and c.active
  join students s on s.classroom_id = c.id and s.status = 'active'
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  left join lateral (
    select lc.certificate_no, lc.exam_year_be, lc.level, cm.status as match_status
    from certificate_matches cm join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = s.id and cm.status in ('auto_matched', 'confirmed')
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end desc, lc.exam_year_be desc nulls last
    limit 1
  ) prior on true
  where public.is_staff() and y.year_be = trim(requested_year)
  order by c.education_band, c.grade_level, c.room_no, s.student_number;
$$;

revoke all on function public.staff_activity_roster(text) from public;
grant execute on function public.staff_activity_roster(text) to authenticated;
