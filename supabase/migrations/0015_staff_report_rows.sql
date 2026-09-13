-- Staff-only report row sources. These functions return PII only to an
-- authenticated user that has an active staff_roles row.
create or replace function public.school_report_rows(requested_year text)
returns table (
  academic_year text,
  education_band text,
  grade_level smallint,
  room_no smallint,
  student_number text,
  full_name text,
  advisor_1 text,
  advisor_2 text,
  match_status text,
  highest_legacy_level text,
  recommended_level text,
  required_for_grade boolean,
  dhamma_level text,
  application_status text,
  eligibility_status text,
  exam_room text,
  seat_no text,
  result_status text,
  score text,
  follow_up_status text
)
language sql
stable
security definer
set search_path = public
as $$
  with guidance as (
    select * from public.student_progress_guidance(trim(requested_year))
  )
  select
    trim(requested_year), g.education_band, g.grade_level, g.room_no,
    g.student_number, g.full_name, g.advisor_1, g.advisor_2,
    g.match_status, g.highest_legacy_level, g.recommended_level,
    g.required_for_grade, r.dhamma_level, r.application_status,
    e.eligibility_status, er.room_name, seat.seat_no,
    result.result_status, result.score,
    case
      when g.guidance_status = 'review_required' then 'ตรวจสอบประวัติ'
      when r.id is null and g.required_for_grade then 'ติดตามให้สมัคร'
      when r.id is null then 'ยังไม่สมัคร'
      when e.id is null then 'รอประกาศสิทธิ์สอบ'
      when seat.id is null then 'รอจัดห้อง/เลขที่สอบ'
      when result.id is null then 'รอผลสอบ'
      when result.result_status = 'passed' then 'เสร็จสิ้น'
      else 'ติดตามผลสอบ'
    end
  from guidance g
  left join exam_registrations r
    on r.student_id = g.student_id
   and r.academic_year_id = (select id from academic_years where year_be = trim(requested_year) limit 1)
  left join exam_eligibility e on e.registration_id = r.id
  left join exam_seats seat on seat.registration_id = r.id
  left join exam_rooms er on er.id = seat.exam_room_id
  left join exam_results result on result.registration_id = r.id
  where public.is_staff()
  order by g.education_band, g.grade_level, g.room_no, g.student_number, r.dhamma_level;
$$;

revoke all on function public.school_report_rows(text) from public;
grant execute on function public.school_report_rows(text) to authenticated;

create or replace function public.mother_sangha_report_rows(requested_year text, requested_level text)
returns table (
  academic_year text,
  dhamma_level text,
  student_number text,
  full_name text,
  education_band text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  eligibility_status text,
  exam_room text,
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
    trim(requested_year), r.dhamma_level, s.student_number, s.full_name,
    c.education_band, c.grade_level, c.room_no, t1.display_name, t2.display_name,
    e.eligibility_status, er.room_name, seat.seat_no, result.result_status, result.score
  from academic_years y
  join exam_registrations r on r.academic_year_id = y.id
  join students s on s.id = r.student_id and s.status = 'active'
  join classrooms c on c.id = s.classroom_id and c.academic_year_id = y.id and c.active
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  left join exam_eligibility e on e.registration_id = r.id
  left join exam_seats seat on seat.registration_id = r.id
  left join exam_rooms er on er.id = seat.exam_room_id
  left join exam_results result on result.registration_id = r.id
  where public.is_staff()
    and y.year_be = trim(requested_year)
    and r.dhamma_level = trim(requested_level)
    and r.application_status in ('submitted', 'verified')
  order by s.student_number;
$$;

revoke all on function public.mother_sangha_report_rows(text, text) from public;
grant execute on function public.mother_sangha_report_rows(text, text) to authenticated;

comment on function public.school_report_rows(text) is
  'Staff-only school tracking rows with class, advisors, registration and official lifecycle states.';
comment on function public.mother_sangha_report_rows(text, text) is
  'Staff-only per-level source rows for filling an unchanged Mother Sangha template copy.';
