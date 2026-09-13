-- Certificate pickup tracking for historical records. Firebase remains read-only.
alter table public.legacy_certificates
  add column if not exists pickup_status text not null default 'pending'
    check (pickup_status in ('pending', 'notified', 'claimed', 'not_applicable'));
alter table public.legacy_certificates
  add column if not exists pickup_note text;
alter table public.legacy_certificates
  add column if not exists pickup_claimed_at timestamptz;
alter table public.legacy_certificates
  add column if not exists pickup_updated_by uuid references auth.users(id);

create index if not exists legacy_certificates_pickup_status_idx
  on public.legacy_certificates(pickup_status, level, exam_year_be);

create or replace function public.public_student_certificate_alerts(
  requested_year text,
  requested_student_number text
)
returns table (
  student_number text,
  current_full_name text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  certificate_no text,
  legacy_full_name text,
  dhamma_level text,
  exam_year_be text,
  pickup_status text,
  match_status text,
  pickup_message text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.student_number, s.full_name, c.grade_level, c.room_no,
    t1.display_name, t2.display_name, lc.certificate_no, lc.full_name,
    lc.level, lc.exam_year_be, lc.pickup_status, cm.status,
    case
      when cm.status = 'confirmed' and lc.pickup_status = 'pending' then 'พบใบประกาศเดิม กรุณาติดต่อครูที่ปรึกษาเพื่อรับใบประกาศ'
      when cm.status = 'confirmed' and lc.pickup_status = 'notified' then 'แจ้งห้องเรียนแล้ว กรุณาติดต่อครูที่ปรึกษาเพื่อรับใบประกาศ'
      when cm.status = 'confirmed' and lc.pickup_status = 'claimed' then 'รับใบประกาศแล้ว'
      when cm.status = 'auto_matched' then 'พบประวัติที่ระบบจับคู่ได้ แต่รอเจ้าหน้าที่ตรวจสอบก่อนแจ้งรับใบประกาศ'
      else 'อยู่ระหว่างตรวจสอบการจับคู่'
    end
  from students s
  join classrooms c on c.id = s.classroom_id and c.active
  join academic_years y on y.id = c.academic_year_id and y.year_be = trim(requested_year)
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  join certificate_matches cm on cm.student_id = s.id
  join legacy_certificates lc on lc.id = cm.legacy_certificate_id
  where s.status = 'active' and s.student_number = trim(requested_student_number)
    and cm.status in ('auto_matched', 'confirmed')
  order by case lc.level when 'เอก' then 1 when 'โท' then 2 when 'ตรี' then 3 else 4 end,
    lc.exam_year_be desc nulls last, lc.certificate_no;
$$;

revoke all on function public.public_student_certificate_alerts(text, text) from public;
grant execute on function public.public_student_certificate_alerts(text, text) to anon, authenticated;

create or replace function public.certificate_pickup_report_rows(requested_year text)
returns table (
  academic_year text,
  student_number text,
  current_full_name text,
  education_band text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  certificate_no text,
  legacy_full_name text,
  dhamma_level text,
  exam_year_be text,
  pickup_status text,
  match_status text,
  pickup_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select y.year_be, s.student_number, s.full_name, c.education_band, c.grade_level, c.room_no,
    t1.display_name, t2.display_name, lc.certificate_no, lc.full_name, lc.level, lc.exam_year_be,
    lc.pickup_status, cm.status, lc.pickup_note
  from academic_years y
  join classrooms c on c.academic_year_id = y.id and c.active
  join students s on s.classroom_id = c.id and s.status = 'active'
  join certificate_matches cm on cm.student_id = s.id and cm.status in ('auto_matched', 'confirmed')
  join legacy_certificates lc on lc.id = cm.legacy_certificate_id
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  where public.is_staff() and y.year_be = trim(requested_year)
    and lc.pickup_status in ('pending', 'notified')
  order by c.education_band, c.grade_level, c.room_no, s.student_number,
    lc.level, lc.exam_year_be;
$$;

revoke all on function public.certificate_pickup_report_rows(text) from public;
grant execute on function public.certificate_pickup_report_rows(text) to authenticated;

comment on function public.public_student_certificate_alerts(text, text) is
  'Public self-service view of matched historical certificates and current classroom routing; raw Firebase remains untouched.';
comment on function public.certificate_pickup_report_rows(text) is
  'Staff-only report of historical certificates still pending pickup, routed to the current grade, room, and advisors.';
