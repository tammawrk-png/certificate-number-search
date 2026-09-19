-- Public read-only roster for the activity page.
-- This exposes only the fields needed to let each class fill the 2569 form.
-- Historical certificate data is returned only when the match was accepted.
drop function if exists public.public_activity_roster(text, smallint, smallint);

create or replace function public.public_activity_roster(
  requested_year text,
  requested_grade smallint default null,
  requested_room smallint default null
)
returns table (
  student_id uuid,
  student_number text,
  full_name text,
  education_band text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  legacy_level text,
  match_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id,
    s.student_number,
    s.full_name,
    c.education_band,
    c.grade_level,
    c.room_no,
    t1.display_name,
    t2.display_name,
    prior.level,
    prior.match_status
  from academic_years y
  join classrooms c on c.academic_year_id = y.id and c.active
  join students s on s.classroom_id = c.id and s.status = 'active'
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  left join lateral (
    select lc.certificate_no, lc.level, cm.status as match_status
    from certificate_matches cm
    join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = s.id
      and cm.status in ('auto_matched', 'confirmed')
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end desc,
      lc.exam_year_be desc nulls last
    limit 1
  ) prior on true
  where y.year_be = trim(requested_year)
    and (requested_grade is null or c.grade_level = requested_grade)
    and (requested_room is null or c.room_no = requested_room)
  order by c.education_band, c.grade_level, c.room_no, s.student_number;
$$;

revoke all on function public.public_activity_roster(text, smallint, smallint) from public;
grant execute on function public.public_activity_roster(text, smallint, smallint) to anon, authenticated;

comment on function public.public_activity_roster(text, smallint, smallint) is
  'Read-only 2569 activity roster. Personal identity fields are intentionally excluded from the bulk response.';
