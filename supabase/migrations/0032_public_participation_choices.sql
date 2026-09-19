-- Stores explicit exam / not-exam decisions without changing Firebase history.
-- Apply after 0031 on the approved Supabase project.
create table if not exists public.exam_participation_choices (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  student_id uuid not null references public.students(id) on delete cascade,
  education_band text not null check (education_band in ('lower_secondary','upper_secondary','higher_education')),
  dhamma_level text not null check (dhamma_level in ('ตรี','โท','เอก')),
  choice_status text not null check (choice_status in ('exam','not_exam')),
  previous_certificate_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, student_id, education_band, dhamma_level),
  check (choice_status = 'exam' or nullif(trim(previous_certificate_no), '') is not null)
);
alter table public.exam_participation_choices enable row level security;

create or replace function public.submit_public_registration_choices_v2(
  requested_year text,
  requested_student_number text,
  requested_full_name text,
  requested_band text,
  requested_choices jsonb
)
returns table (accepted boolean, result_code text, message text, updated_count integer)
language plpgsql security definer set search_path = public
as $$
declare
  year_id uuid;
  student_row public.students%rowtype;
  choice jsonb;
  level_name text;
  choice_status text;
  certificate_no text;
  updated_rows integer := 0;
begin
  select id into year_id from public.academic_years where year_be = trim(requested_year) limit 1;
  select s.* into student_row
  from public.students s join public.classrooms c on c.id = s.classroom_id and c.active
  where c.academic_year_id = year_id and s.status = 'active'
    and s.student_number = trim(requested_student_number)
    and public.dharma_normalize_name(s.full_name) = public.dharma_normalize_name(requested_full_name)
  limit 1;
  if year_id is null or student_row.id is null then return query select false, 'STUDENT_NOT_FOUND', 'ไม่พบข้อมูลนักเรียนหรือชื่อไม่ตรงทะเบียน', 0; return; end if;
  if requested_band is null or not exists (select 1 from public.classrooms c where c.id = student_row.classroom_id and c.education_band = trim(requested_band)) then return query select false, 'BAND_MISMATCH', 'สายการศึกษาที่ส่งมาไม่ตรงกับทะเบียน', 0; return; end if;
  if not exists (select 1 from public.registration_windows where academic_year_id = year_id and is_open) then return query select false, 'REGISTRATION_CLOSED', 'ยังไม่เปิดช่วงรับสมัคร', 0; return; end if;
  if jsonb_typeof(coalesce(requested_choices, '[]'::jsonb)) <> 'array' then return query select false, 'INVALID_CHOICES', 'รูปแบบตัวเลือกไม่ถูกต้อง', 0; return; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(requested_choices, '[]'::jsonb)) item
    where item->>'dhamma_level' not in ('ตรี','โท','เอก')
      or item->>'choice_status' not in ('exam','not_exam')
      or (item->>'choice_status' = 'not_exam' and nullif(trim(item->>'previous_certificate_no'), '') is null)
  ) then return query select false, 'INVALID_CHOICES', 'กรณีไม่สอบต้องมีเลขใบประกาศยืนยัน', 0; return; end if;
  if student_row.classroom_id is not null and exists (select 1 from public.classrooms c where c.id = student_row.classroom_id and c.education_band in ('lower_secondary','upper_secondary') and c.grade_level in (1,4)) and not exists (select 1 from jsonb_array_elements(requested_choices) item where item->>'dhamma_level' = 'ตรี' and item->>'choice_status' = 'exam') then return query select false, 'REQUIRED_LEVEL_UNSELECTED', 'ชั้น ม.1 และ ม.4 ต้องสมัครธรรมศึกษาชั้นตรี', 0; return; end if;
  for choice in select * from jsonb_array_elements(coalesce(requested_choices, '[]'::jsonb)) loop
    level_name := choice->>'dhamma_level'; choice_status := choice->>'choice_status'; certificate_no := nullif(trim(choice->>'previous_certificate_no'), '');
    if choice_status = 'exam' and level_name in ('โท','เอก') and not exists (
      select 1 from public.certificate_matches cm join public.legacy_certificates lc on lc.id = cm.legacy_certificate_id
      where cm.student_id = student_row.id and cm.status in ('auto_matched','confirmed')
        and ((level_name = 'โท' and lc.level in ('ตรี','โท','เอก')) or (level_name = 'เอก' and lc.level in ('โท','เอก')))
    ) then return query select false, 'PREREQUISITE_NOT_MET', case level_name when 'โท' then 'ยังไม่พบหลักฐานชั้นตรีสำหรับสมัครชั้นโท' else 'ยังไม่พบหลักฐานชั้นโทสำหรับสมัครชั้นเอก' end, updated_rows; return; end if;
    insert into public.exam_participation_choices(academic_year_id, student_id, education_band, dhamma_level, choice_status, previous_certificate_no, updated_at)
    values (year_id, student_row.id, requested_band, level_name, choice_status, certificate_no, now())
    on conflict (academic_year_id, student_id, education_band, dhamma_level) do update set choice_status = excluded.choice_status, previous_certificate_no = excluded.previous_certificate_no, updated_at = now();
    if choice_status = 'exam' then
      insert into public.exam_registrations(academic_year_id, student_id, education_band, dhamma_level, application_status, submitted_at) values (year_id, student_row.id, requested_band, level_name, 'submitted', now()) on conflict (academic_year_id, student_id, education_band, dhamma_level) do update set application_status = 'submitted', submitted_at = now();
    else update public.exam_registrations set application_status = 'cancelled' where academic_year_id = year_id and student_id = student_row.id and education_band = requested_band and dhamma_level = level_name and application_status = 'submitted'; end if;
    updated_rows := updated_rows + 1;
  end loop;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details) values (auth.uid(), 'submit_public_registration_choices_v2', 'student', student_row.id, jsonb_build_object('academic_year', requested_year, 'choices', requested_choices));
  return query select true, 'CHOICES_SAVED', 'บันทึกสถานะการสอบแล้ว', updated_rows;
end;
$$;
revoke all on function public.submit_public_registration_choices_v2(text, text, text, text, jsonb) from public;
grant execute on function public.submit_public_registration_choices_v2(text, text, text, text, jsonb) to anon, authenticated;
