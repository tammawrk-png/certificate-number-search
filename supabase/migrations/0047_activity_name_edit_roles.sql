-- Role-scoped name correction for the live activity roster.
-- Students can edit only themselves, teachers only their classroom, and
-- staff can edit any active 2569 student. Other roster fields remain guarded.
create or replace function public.activity_update_student_name_v1(
  requested_year text,
  requested_role text,
  requested_access_code text,
  requested_student_number text,
  current_full_name text,
  requested_full_name text
)
returns table (saved boolean, result_code text, message text)
language plpgsql security definer set search_path = public
as $$
declare
  target students%rowtype;
  clean_name text := regexp_replace(trim(coalesce(requested_full_name, '')), '\s+', ' ', 'g');
  current_name text := regexp_replace(trim(coalesce(current_full_name, '')), '\s+', ' ', 'g');
  name_body text;
  name_title text;
  first_value text;
  last_value text;
  classroom_grade text;
  classroom_room text;
begin
  select s.* into target
  from public.students s
  join public.classrooms c on c.id = s.classroom_id and c.active
  join public.academic_years y on y.id = c.academic_year_id and y.year_be = trim(requested_year)
  where s.status = 'active' and s.student_number = trim(requested_student_number)
  for update;
  if target.id is null then
    return query select false, 'STUDENT_NOT_FOUND', 'ไม่พบข้อมูลนักเรียนในทะเบียนปีนี้';
    return;
  end if;

  select c.grade_level::text, c.room_no::text into classroom_grade, classroom_room
  from public.classrooms c where c.id = target.classroom_id;
  if lower(trim(requested_role)) = 'student' then
    if trim(requested_access_code) <> target.student_number
       or public.dharma_normalize_name(target.full_name) <> public.dharma_normalize_name(current_name) then
      return query select false, 'STUDENT_ACCESS_DENIED', 'ยืนยันข้อมูลนักเรียนไม่ผ่าน';
      return;
    end if;
  elsif lower(trim(requested_role)) = 'teacher' then
    if lower(trim(requested_access_code)) <> lower('wrk' || classroom_grade || classroom_room) then
      return query select false, 'ROOM_ACCESS_DENIED', 'รหัสห้องเรียนไม่ตรงกับรายชื่อนักเรียน';
      return;
    end if;
  elsif lower(trim(requested_role)) = 'admin' then
    if not public.is_staff() then
      return query select false, 'STAFF_ROLE_REQUIRED', 'ไม่มีสิทธิ์ผู้ดูแลระบบ';
      return;
    end if;
  else
    return query select false, 'INVALID_ROLE', 'ประเภทผู้ใช้ไม่ถูกต้อง';
    return;
  end if;

  if clean_name = '' then
    return query select false, 'NAME_REQUIRED', 'กรุณากรอกชื่อและนามสกุล';
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

  update public.students
  set title = nullif(name_title, ''), first_name = first_value, last_name = last_value,
      full_name = clean_name, normalized_name = public.dharma_normalize_name(clean_name), updated_at = now()
  where id = target.id;
  update public.certificate_matches
  set status = 'review', matching_basis = matching_basis || jsonb_build_object('needs_recheck', true)
  where student_id = target.id and status in ('auto_matched', 'confirmed');
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'activity_update_student_name', 'student', target.id,
      jsonb_build_object('academic_year', requested_year, 'student_number', target.student_number, 'role', requested_role));
  return query select true, 'SAVED', 'แก้ไขชื่อ–สกุลเข้าฐานกลางแล้ว';
exception when others then
  return query select false, 'NAME_UPDATE_FAILED', sqlerrm;
end;
$$;

revoke all on function public.activity_update_student_name_v1(text, text, text, text, text, text) from public;
grant execute on function public.activity_update_student_name_v1(text, text, text, text, text, text) to anon, authenticated;
