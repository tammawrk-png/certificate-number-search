-- Central, atomic roster editing for the administrator only.
-- No delete is exposed. A failed identity/form validation rolls back the
-- roster change so active student submissions cannot be partially overwritten.
create or replace function public.admin_upsert_activity_roster_v1(
  requested_year text,
  current_student_number text,
  requested_student_number text,
  requested_full_name text,
  requested_grade text,
  requested_room text,
  requested_citizen_id text default null,
  requested_birth_iso text default null,
  requested_application_level text default 'ตรี',
  requested_previous_year text default null,
  requested_previous_no text default null,
  requested_exam_status text default '',
  requested_special_needs boolean default false,
  requested_advisor_1 text default null,
  requested_advisor_2 text default null
)
returns table (saved boolean, result_code text, message text)
language plpgsql security definer set search_path = public
as $$
declare
  year_id uuid;
  target students%rowtype;
  target_classroom_id uuid;
  advisor_one_id uuid;
  advisor_two_id uuid;
  save_result record;
  grade_value smallint;
  room_value smallint;
  education_value text;
  clean_number text := trim(coalesce(requested_student_number, ''));
  clean_name text := regexp_replace(trim(coalesce(requested_full_name, '')), '\s+', ' ', 'g');
  name_body text;
  name_title text;
  first_value text;
  last_value text;
begin
  if not public.is_staff() then
    return query select false, 'STAFF_ROLE_REQUIRED', 'ไม่มีสิทธิ์ผู้ดูแลระบบ';
    return;
  end if;
  if clean_number = '' or clean_name = '' then
    return query select false, 'IDENTITY_REQUIRED', 'กรุณากรอกเลขประจำตัวและชื่อ - สกุล';
    return;
  end if;
  select id into year_id from public.academic_years where year_be = trim(requested_year) limit 1;
  if year_id is null then
    return query select false, 'YEAR_NOT_FOUND', 'ไม่พบปีการศึกษา';
    return;
  end if;

  if lower(trim(requested_grade)) = 'higher' then
    select c.id into target_classroom_id
    from public.classrooms c
    where c.academic_year_id = year_id and c.education_band = 'higher_education' and c.active
      and (lower(trim(requested_room)) = 'higher' or (requested_room ~ '^\d+$' and c.room_no = requested_room::smallint))
    order by c.room_no limit 1;
  elsif requested_grade ~ '^[1-6]$' and requested_room ~ '^(?:[1-9]|1[0-5])$' then
    grade_value := requested_grade::smallint;
    room_value := requested_room::smallint;
    education_value := case when grade_value <= 3 then 'lower_secondary' else 'upper_secondary' end;
    select c.id into target_classroom_id from public.classrooms c
    where c.academic_year_id = year_id and c.education_band = education_value
      and c.grade_level = grade_value and c.room_no = room_value and c.active limit 1;
  end if;
  if target_classroom_id is null then
    return query select false, 'CLASSROOM_NOT_FOUND', 'ไม่พบห้องเรียนปลายทางในฐานข้อมูล';
    return;
  end if;

  select s.* into target
  from public.students s join public.classrooms c on c.id = s.classroom_id
  where c.academic_year_id = year_id and s.status = 'active'
    and nullif(trim(coalesce(current_student_number, '')), '') is not null
    and s.student_number = trim(current_student_number)
  for update;
  if nullif(trim(coalesce(current_student_number, '')), '') is not null and target.id is null then
    return query select false, 'STUDENT_NOT_FOUND', 'ไม่พบรายชื่อนักเรียนเดิมในฐานข้อมูล';
    return;
  end if;
  if exists (select 1 from public.students s join public.classrooms c on c.id = s.classroom_id
             where c.academic_year_id = year_id and s.status = 'active'
               and s.student_number = clean_number and (target.id is null or s.id <> target.id)) then
    return query select false, 'STUDENT_NUMBER_EXISTS', 'เลขประจำตัวนี้มีอยู่แล้ว ไม่ได้เขียนทับข้อมูลเดิม';
    return;
  end if;

  name_title := substring(clean_name from '^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|พระ|สามเณร)');
  name_body := regexp_replace(clean_name, '^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|พระ|สามเณร)\s*', '');
  first_value := split_part(name_body, ' ', 1);
  last_value := nullif(trim(substr(name_body, length(first_value) + 1)), '');
  if first_value = '' or last_value is null then
    return query select false, 'NAME_REQUIRED', 'กรุณากรอกทั้งชื่อและนามสกุล';
    return;
  end if;

  if nullif(trim(coalesce(requested_advisor_1, '')), '') is not null and trim(requested_advisor_1) <> '—' then
    select id into advisor_one_id from public.teachers where active and normalized_name = public.dharma_normalize_name(trim(requested_advisor_1)) limit 1;
    if advisor_one_id is null then
      insert into public.teachers(display_name, normalized_name) values (trim(requested_advisor_1), public.dharma_normalize_name(trim(requested_advisor_1))) returning id into advisor_one_id;
    end if;
  end if;
  if nullif(trim(coalesce(requested_advisor_2, '')), '') is not null and trim(requested_advisor_2) <> '—' then
    select id into advisor_two_id from public.teachers where active and normalized_name = public.dharma_normalize_name(trim(requested_advisor_2)) limit 1;
    if advisor_two_id is null then
      insert into public.teachers(display_name, normalized_name) values (trim(requested_advisor_2), public.dharma_normalize_name(trim(requested_advisor_2))) returning id into advisor_two_id;
    end if;
  end if;
  update public.classrooms set advisor_1_id = advisor_one_id, advisor_2_id = advisor_two_id where id = target_classroom_id;

  if target.id is null then
    insert into public.students(student_number, title, first_name, last_name, full_name, normalized_name, citizen_id, birth_date, classroom_id, status, updated_at)
    values (clean_number, nullif(name_title, ''), first_value, last_value, clean_name, public.dharma_normalize_name(clean_name), null, null, target_classroom_id, 'active', now())
    returning * into target;
  else
    update public.students set student_number = clean_number, title = nullif(name_title, ''), first_name = first_value,
      last_name = last_value, full_name = clean_name, normalized_name = public.dharma_normalize_name(clean_name),
      classroom_id = target_classroom_id, updated_at = now()
    where id = target.id;
    update public.certificate_matches set status = 'review', matching_basis = matching_basis || jsonb_build_object('needs_recheck', true)
    where student_id = target.id and status in ('auto_matched', 'confirmed');
  end if;

  begin
    select * into save_result from public.save_activity_form_row_v2(
      requested_year, 'admin', 'admin', clean_number, requested_application_level,
      requested_citizen_id, requested_birth_iso, requested_previous_year, requested_previous_no,
      requested_exam_status, requested_special_needs, null, null, null, null, null
    );
    if not coalesce(save_result.saved, false) then
      raise exception '%', save_result.message;
    end if;
  exception when others then
    raise exception '%', sqlerrm;
  end;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'admin_upsert_activity_roster_v1', 'student', target.id,
      jsonb_build_object('academic_year', requested_year, 'student_number', clean_number, 'current_student_number', current_student_number));
  return query select true, 'SAVED', 'บันทึกทะเบียนรายชื่อและข้อมูลสมัครเข้าฐานกลางแล้ว';
exception when others then
  return query select false, 'ROSTER_SAVE_FAILED', sqlerrm;
end;
$$;

revoke all on function public.admin_upsert_activity_roster_v1(text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text) from public;
grant execute on function public.admin_upsert_activity_roster_v1(text,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text) to authenticated;
