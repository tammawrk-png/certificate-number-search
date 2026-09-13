-- Public registration boundary. The window is closed by default and must be
-- opened by an authenticated operator after the official school schedule is set.
create table if not exists registration_windows (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null unique references academic_years(id) on delete cascade,
  is_open boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  note text,
  updated_at timestamptz not null default now()
);

alter table registration_windows enable row level security;

insert into registration_windows (academic_year_id, is_open, note)
select id, false, 'ยังไม่เปิดรับสมัครจนกว่าเจ้าหน้าที่จะประกาศช่วงรับสมัคร'
from academic_years
where year_be = '2569'
on conflict (academic_year_id) do nothing;

create or replace function public.submit_public_registration(
  requested_year text,
  requested_student_number text,
  requested_full_name text,
  requested_band text,
  requested_level text
)
returns table (accepted boolean, result_code text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  year_row academic_years%rowtype;
  student_row students%rowtype;
  classroom_band text;
  rule_exists boolean;
begin
  select * into year_row from academic_years where year_be = trim(requested_year) limit 1;
  if year_row.id is null then
    return query select false, 'YEAR_NOT_FOUND', 'ไม่พบปีการศึกษาในระบบ'; return;
  end if;

  if not exists (
    select 1 from registration_windows w
    where w.academic_year_id = year_row.id
      and w.is_open
      and (w.opens_at is null or now() >= w.opens_at)
      and (w.closes_at is null or now() <= w.closes_at)
  ) then
    return query select false, 'REGISTRATION_CLOSED', 'ขณะนี้ยังไม่เปิดรับสมัคร'; return;
  end if;

  if requested_band not in ('lower_secondary', 'upper_secondary', 'higher_education')
     or requested_level not in ('ตรี', 'โท', 'เอก') then
    return query select false, 'INVALID_SELECTION', 'สายการศึกษาหรือระดับธรรมศึกษาไม่ถูกต้อง'; return;
  end if;

  select s.* into student_row
  from students s
  join classrooms c on c.id = s.classroom_id and c.academic_year_id = year_row.id and c.active
  where s.student_number = trim(requested_student_number)
    and s.status = 'active'
    and public.dharma_normalize_name(s.full_name) = public.dharma_normalize_name(requested_full_name)
  limit 1;
  if student_row.id is null then
    return query select false, 'STUDENT_NOT_VERIFIED', 'ตรวจสอบเลขประจำตัวและชื่อ-นามสกุลไม่ผ่าน'; return;
  end if;

  select c.education_band into classroom_band from classrooms c where c.id = student_row.classroom_id;
  if classroom_band <> requested_band then
    return query select false, 'BAND_MISMATCH', 'สายการศึกษาไม่ตรงกับรายชื่อปัจจุบัน'; return;
  end if;

  select exists (
    select 1 from registration_rules rr
    where rr.academic_year_id = year_row.id
      and rr.education_band = requested_band
      and rr.dhamma_level = requested_level
      and rr.enabled
      and (rr.grade_level is null or rr.grade_level = (select grade_level from classrooms where id = student_row.classroom_id))
  ) into rule_exists;
  if not rule_exists then
    return query select false, 'RULE_NOT_FOUND', 'ยังไม่มีกติกาการสมัครสำหรับรายการนี้'; return;
  end if;

  insert into exam_registrations (academic_year_id, student_id, education_band, dhamma_level, application_status, submitted_at)
  values (year_row.id, student_row.id, requested_band, requested_level, 'submitted', now())
  on conflict (academic_year_id, student_id, education_band, dhamma_level)
  do update set application_status = 'submitted', submitted_at = now();

  return query select true, 'SUBMITTED', 'บันทึกใบสมัครแล้ว';
end;
$$;

revoke all on function public.submit_public_registration(text, text, text, text, text) from public;
grant execute on function public.submit_public_registration(text, text, text, text, text) to anon, authenticated;

comment on function public.submit_public_registration(text, text, text, text, text) is
  'Validated public registration boundary; returns status only and never exposes student PII.';
