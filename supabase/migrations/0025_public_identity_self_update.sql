-- Public identity review is limited to the student reached by an exact student number.
-- Class, room, advisors and student number remain server-owned roster fields.
alter table public.students add column if not exists citizen_id text;

create or replace function public.public_student_identity(
  requested_year text,
  requested_student_number text
)
returns table (
  verified boolean,
  student_number text,
  title text,
  first_name text,
  last_name text,
  citizen_id text,
  birth_date_be text
)
language sql stable security definer set search_path = public
as $$
  select true, s.student_number, s.title, s.first_name, s.last_name, s.citizen_id,
    case when s.birth_date is null then null else to_char(s.birth_date + interval '543 years', 'DD/MM/YYYY') end
  from students s
  join classrooms c on c.id = s.classroom_id and c.active
  join academic_years y on y.id = c.academic_year_id and y.year_be = trim(requested_year)
  where s.status = 'active' and s.student_number = trim(requested_student_number)
  limit 1;
$$;

revoke all on function public.public_student_identity(text, text) from public;
grant execute on function public.public_student_identity(text, text) to anon, authenticated;

create or replace function public.public_update_student_self(
  requested_year text,
  requested_student_number text,
  current_full_name text,
  requested_title text,
  requested_first_name text,
  requested_last_name text,
  requested_citizen_id text default null,
  requested_birth_date_be text default null
)
returns table (saved boolean, result_code text, message text)
language plpgsql security definer set search_path = public
as $$
declare
  target students%rowtype;
  new_full_name text;
  clean_citizen text := nullif(regexp_replace(coalesce(requested_citizen_id, ''), '[^0-9]', '', 'g'), '');
  clean_birth text := nullif(trim(coalesce(requested_birth_date_be, '')), '');
begin
  select s.* into target
  from students s join classrooms c on c.id = s.classroom_id and c.active
    join academic_years y on y.id = c.academic_year_id and y.year_be = trim(requested_year)
  where s.status = 'active' and s.student_number = trim(requested_student_number)
  for update;
  if target.id is null then return query select false, 'STUDENT_NOT_FOUND', 'ไม่พบข้อมูลนักเรียนในทะเบียนปีนี้'; return; end if;
  if public.dharma_normalize_name(target.full_name) <> public.dharma_normalize_name(current_full_name) then
    return query select false, 'IDENTITY_CHECK_FAILED', 'ข้อมูลยืนยันตัวตนไม่ตรงกับทะเบียน กรุณาตรวจเลขประจำตัวและติดต่อเจ้าหน้าที่'; return;
  end if;
  if requested_first_name is null or trim(requested_first_name) = '' or requested_last_name is null or trim(requested_last_name) = '' then
    return query select false, 'NAME_REQUIRED', 'กรุณากรอกชื่อและนามสกุล'; return;
  end if;
  if clean_citizen is not null and clean_citizen !~ '^[0-9]{13}$' then
    return query select false, 'CITIZEN_ID_INVALID', 'เลขประจำตัวประชาชนต้องมี 13 หลัก'; return;
  end if;
  if clean_birth is not null and clean_birth !~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' then
    return query select false, 'BIRTH_DATE_INVALID', 'วันเกิดให้กรอกเป็น วว/ดด/ปปปป พ.ศ.'; return;
  end if;
  new_full_name := concat_ws(' ', nullif(trim(requested_title), ''), trim(requested_first_name), trim(requested_last_name));
  update students set title = nullif(trim(requested_title), ''), first_name = trim(requested_first_name),
    last_name = trim(requested_last_name), full_name = new_full_name,
    normalized_name = public.dharma_normalize_name(new_full_name),
    citizen_id = clean_citizen,
    birth_date = case when clean_birth is null then null else to_date(clean_birth, 'DD/MM/YYYY') - interval '543 years' end,
    updated_at = now() where id = target.id;
  update certificate_matches set status = 'review', matching_basis = matching_basis || jsonb_build_object('needs_recheck', true)
    where student_id = target.id and status in ('auto_matched', 'confirmed');
  insert into audit_logs(actor_id, action, entity_type, entity_id, details)
    values (null, 'public_student_self_update', 'student', target.id,
      jsonb_build_object('student_number', target.student_number, 'fields', jsonb_build_array('title','name','citizen_id','birth_date')));
  return query select true, 'SAVED', 'บันทึกข้อมูลของคุณแล้ว ข้อมูลประวัติใบประกาศจะถูกตรวจจับคู่ใหม่หากชื่อมีการเปลี่ยนแปลง';
end;
$$;

revoke all on function public.public_update_student_self(text, text, text, text, text, text, text, text) from public;
grant execute on function public.public_update_student_self(text, text, text, text, text, text, text, text) to anon, authenticated;
