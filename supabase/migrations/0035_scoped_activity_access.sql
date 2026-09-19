-- Scoped public access for the activity page.
-- Teachers receive one classroom through wrk<grade><room>; students receive only their own row.
drop function if exists public.public_activity_access(text, text, text, smallint, smallint);

create or replace function public.public_activity_access(
  requested_year text,
  requested_role text,
  requested_code text,
  requested_grade smallint default null,
  requested_room smallint default null
)
returns table (
  student_id uuid, student_number text, full_name text, education_band text,
  grade_level smallint, room_no smallint, advisor_1 text, advisor_2 text,
  certificate_no text, certificate_year text, legacy_level text, match_status text
)
language sql stable security definer set search_path = public
as $$
  with permitted as (
    select case
      when lower(trim(requested_role)) = 'teacher'
        and lower(trim(requested_code)) = 'wrk' || c.grade_level::text || c.room_no::text
        and requested_grade = c.grade_level and requested_room = c.room_no then true
      when lower(trim(requested_role)) = 'student'
        and trim(requested_code) = s.student_number then true
      else false
    end as allowed, s.id as student_id
    from academic_years y
    join classrooms c on c.academic_year_id = y.id and c.active
    join students s on s.classroom_id = c.id and s.status = 'active'
    where y.year_be = trim(requested_year)
  )
  select s.id, s.student_number, s.full_name, c.education_band, c.grade_level, c.room_no,
    t1.display_name, t2.display_name, prior.certificate_no, prior.exam_year_be,
    prior.level, prior.match_status
  from permitted p
  join students s on s.id = p.student_id
  join classrooms c on c.id = s.classroom_id
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  left join lateral (
    select lc.certificate_no, lc.exam_year_be, lc.level, cm.status as match_status
    from certificate_matches cm join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = s.id and cm.status in ('auto_matched', 'confirmed')
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end desc, lc.exam_year_be desc nulls last
    limit 1
  ) prior on true
  where p.allowed
  order by c.education_band, c.grade_level, c.room_no, s.student_number;
$$;

revoke all on function public.public_activity_access(text, text, text, smallint, smallint) from public;
grant execute on function public.public_activity_access(text, text, text, smallint, smallint) to anon, authenticated;

-- Prevent bypassing the page gate through the old unrestricted bulk RPC.
revoke all on function public.public_activity_roster(text, smallint, smallint) from anon, authenticated;
