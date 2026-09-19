-- Central save for the activity form. Supabase is the source of truth;
-- Google Sheets is refreshed by the protected report worker.
create table if not exists public.activity_form_submissions (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  education_band text not null check (education_band in ('lower_secondary','upper_secondary','higher_education')),
  application_level text not null check (application_level in ('ตรี','โท','เอก')),
  exam_status text not null default '' check (exam_status in ('','exam','not_exam')),
  special_needs boolean not null default false,
  previous_certificate_year text,
  previous_certificate_no text,
  organization_name text,
  organization_location text,
  temple_affiliation text,
  school_council text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year_id, student_id, application_level)
);
alter table public.activity_form_submissions enable row level security;
create index if not exists activity_form_submissions_year_student_idx
  on public.activity_form_submissions(academic_year_id, student_id);

create table if not exists public.google_sheet_sync_queue (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null unique references public.academic_years(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','running','complete','failed')),
  attempts integer not null default 0,
  last_error text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.google_sheet_sync_queue enable row level security;

create or replace function public.save_activity_form_row(
  requested_year text,
  requested_role text,
  requested_access_code text,
  requested_student_number text,
  requested_application_level text,
  requested_citizen_id text default null,
  requested_birth_iso text default null,
  requested_previous_year text default null,
  requested_previous_no text default null,
  requested_exam_status text default '',
  requested_special_needs boolean default false,
  requested_organization_name text default null,
  requested_organization_location text default null,
  requested_temple_affiliation text default null,
  requested_school_council text default null,
  requested_notes text default null
)
returns table (saved boolean, result_code text, message text)
language plpgsql security definer set search_path = public
as $$
declare
  year_id uuid;
  target students%rowtype;
  classroom classrooms%rowtype;
  clean_citizen text := nullif(regexp_replace(coalesce(requested_citizen_id, ''), '[^0-9]', '', 'g'), '');
  birth_value date;
  checksum integer := 0;
  check_digit integer;
  i integer;
  effective_exam text := case when coalesce(requested_special_needs, false) then 'not_exam' else coalesce(requested_exam_status, '') end;
begin
  select id into year_id from public.academic_years where year_be = trim(requested_year) limit 1;
  if year_id is null then return query select false, 'YEAR_NOT_FOUND', 'ไม่พบปีการศึกษา'; return; end if;
  select s.* into target
  from public.students s
  join public.classrooms c on c.id = s.classroom_id and c.academic_year_id = year_id and c.active
  where s.student_number = trim(requested_student_number) and s.status = 'active'
  limit 1;
  if target.id is null then return query select false, 'STUDENT_NOT_FOUND', 'ไม่พบเลขประจำตัวนักเรียน'; return; end if;
  select c.* into classroom from public.classrooms c where c.id = target.classroom_id;

  if lower(trim(requested_role)) = 'teacher' then
    if lower(trim(requested_access_code)) <> lower('wrk' || classroom.grade_level::text || classroom.room_no::text) then
      return query select false, 'ROOM_ACCESS_DENIED', 'รหัสห้องเรียนไม่ตรงกับรายชื่อนักเรียน'; return;
    end if;
  elsif lower(trim(requested_role)) = 'student' then
    if trim(requested_access_code) <> target.student_number then
      return query select false, 'STUDENT_ACCESS_DENIED', 'ยืนยันเลขประจำตัวนักเรียนไม่ผ่าน'; return;
    end if;
  elsif lower(trim(requested_role)) = 'admin' then
    if not public.is_staff() then return query select false, 'STAFF_ROLE_REQUIRED', 'ไม่มีสิทธิ์ผู้ดูแลระบบ'; return; end if;
  else
    return query select false, 'INVALID_ROLE', 'ประเภทผู้ใช้ไม่ถูกต้อง'; return;
  end if;
  if requested_application_level not in ('ตรี','โท','เอก') then
    return query select false, 'INVALID_LEVEL', 'ระดับธรรมศึกษาไม่ถูกต้อง'; return;
  end if;
  if effective_exam not in ('','exam','not_exam') then
    return query select false, 'INVALID_EXAM_STATUS', 'สถานะสอบไม่ถูกต้อง'; return;
  end if;
  if clean_citizen is not null then
    if clean_citizen !~ '^[0-9]{13}$' or clean_citizen ~ '^([0-9])\1{12}$' then
      return query select false, 'CITIZEN_ID_INVALID', 'เลขประชาชนต้องมี 13 หลัก'; return;
    end if;
    for i in 1..12 loop checksum := checksum + substring(clean_citizen from i for 1)::integer * (14 - i); end loop;
    check_digit := (11 - (checksum % 11)) % 10;
    if check_digit <> substring(clean_citizen from 13 for 1)::integer then
      return query select false, 'CITIZEN_ID_INVALID', 'เลขประชาชนไม่ผ่านการตรวจสอบ'; return;
    end if;
  end if;
  if nullif(trim(coalesce(requested_birth_iso,'')), '') is not null then
    if requested_birth_iso !~ '^\d{4}-\d{2}-\d{2}$' then return query select false, 'BIRTH_DATE_INVALID', 'วันเกิดไม่ถูกต้อง'; return; end if;
    birth_value := to_date(requested_birth_iso, 'YYYY-MM-DD');
  end if;
  if effective_exam = 'not_exam' and not coalesce(requested_special_needs, false)
     and nullif(trim(coalesce(requested_previous_no,'')), '') is null then
    return query select false, 'PREVIOUS_CERTIFICATE_REQUIRED', 'กรณีไม่สอบต้องมีเลขใบประกาศเดิม'; return;
  end if;
  if requested_application_level in ('โท','เอก')
     and nullif(trim(coalesce(requested_previous_no,'')), '') is not null
     and coalesce(trim(requested_previous_year), '') !~ '^25\d{2}$' then
    return query select false, 'PREVIOUS_YEAR_REQUIRED', 'ศ.6 ต้องระบุ พ.ศ. ที่จบประโยคเดิม'; return;
  end if;
  if effective_exam = 'exam' and requested_application_level in ('โท','เอก') and not exists (
    select 1 from public.certificate_matches cm
    join public.legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = target.id and cm.status in ('auto_matched','confirmed')
      and ((requested_application_level = 'โท' and lc.level in ('ตรี','โท','เอก'))
        or (requested_application_level = 'เอก' and lc.level in ('โท','เอก')))
  ) then
    return query select false, 'PREREQUISITE_NOT_MET', 'ยังไม่พบใบประกาศเดิมตามเงื่อนไขระดับนี้'; return;
  end if;

  update public.students set citizen_id = coalesce(clean_citizen, citizen_id), birth_date = coalesce(birth_value, birth_date), updated_at = now() where id = target.id;
  insert into public.activity_form_submissions(
    academic_year_id, student_id, education_band, application_level, exam_status, special_needs,
    previous_certificate_year, previous_certificate_no,
    organization_name, organization_location, temple_affiliation, school_council, notes, updated_at
  ) values (
    year_id, target.id, classroom.education_band, requested_application_level, effective_exam, coalesce(requested_special_needs, false),
    nullif(trim(requested_previous_year), ''), nullif(trim(requested_previous_no), ''),
    nullif(trim(requested_organization_name), ''), nullif(trim(requested_organization_location), ''), nullif(trim(requested_temple_affiliation), ''), nullif(trim(requested_school_council), ''), nullif(trim(requested_notes), ''), now()
  ) on conflict (academic_year_id, student_id, application_level) do update set
    exam_status = excluded.exam_status, special_needs = excluded.special_needs,
    previous_certificate_year = excluded.previous_certificate_year,
    previous_certificate_no = excluded.previous_certificate_no,
    organization_name = excluded.organization_name, organization_location = excluded.organization_location,
    temple_affiliation = excluded.temple_affiliation, school_council = excluded.school_council,
    notes = excluded.notes, updated_at = now();
  if effective_exam = 'exam' then
    insert into public.exam_registrations(academic_year_id, student_id, education_band, dhamma_level, application_status, submitted_at)
    values (year_id, target.id, classroom.education_band, requested_application_level, 'submitted', now())
    on conflict (academic_year_id, student_id, education_band, dhamma_level) do update set application_status = 'submitted', submitted_at = now();
  elsif effective_exam = 'not_exam' then
    update public.exam_registrations set application_status = 'cancelled'
    where academic_year_id = year_id and student_id = target.id and dhamma_level = requested_application_level and application_status = 'submitted';
  end if;
  insert into public.google_sheet_sync_queue(academic_year_id, state, requested_at)
  values (year_id, 'pending', now())
  on conflict (academic_year_id) do update set state = 'pending', requested_at = now(), last_error = null;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'save_activity_form_row', 'student', target.id,
    jsonb_build_object('academic_year', requested_year, 'level', requested_application_level, 'exam_status', effective_exam));
  return query select true, 'SAVED', 'บันทึกข้อมูลเข้าสู่ฐานข้อมูลแล้ว';
end;
$$;
revoke all on function public.save_activity_form_row(text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text) from public;
grant execute on function public.save_activity_form_row(text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text) to anon, authenticated;

comment on table public.activity_form_submissions is 'Central activity form values; Supabase is authoritative and Google Sheets is a protected synchronized report surface.';

create or replace function public.public_activity_access_v2(
  requested_year text, requested_role text, requested_code text,
  requested_grade smallint default null, requested_room smallint default null
)
returns table (
  student_id uuid, student_number text, full_name text, education_band text,
  grade_level smallint, room_no smallint, advisor_1 text, advisor_2 text,
  certificate_no text, certificate_year text, legacy_level text, match_status text,
  citizen_id text, birth_iso text, application_level text, previous_certificate_year text,
  exam_status text, special_needs boolean, organization_name text, organization_location text,
  temple_affiliation text, school_council text, notes text
)
language sql stable security definer set search_path = public
as $$
  with permitted as (
    select case
      when lower(trim(requested_role)) = 'teacher' and lower(trim(requested_code)) = lower('wrk' || c.grade_level::text || c.room_no::text)
        and requested_grade = c.grade_level and requested_room = c.room_no then true
      when lower(trim(requested_role)) = 'student' and trim(requested_code) = s.student_number then true
      else false end as allowed, s.id as student_id
    from academic_years y join classrooms c on c.academic_year_id = y.id and c.active
    join students s on s.classroom_id = c.id and s.status = 'active'
    where y.year_be = trim(requested_year)
  )
  select s.id, s.student_number, s.full_name, c.education_band, c.grade_level, c.room_no,
    t1.display_name, t2.display_name, coalesce(a.previous_certificate_no, prior.certificate_no),
    coalesce(a.previous_certificate_year, prior.exam_year_be), prior.level, prior.match_status,
    s.citizen_id, case when s.birth_date is null then null else to_char(s.birth_date, 'YYYY-MM-DD') end,
    a.application_level, a.previous_certificate_year, a.exam_status, coalesce(a.special_needs, false),
    a.organization_name, a.organization_location, a.temple_affiliation, a.school_council, a.notes
  from permitted p join students s on s.id = p.student_id
  join classrooms c on c.id = s.classroom_id
  left join teachers t1 on t1.id = c.advisor_1_id left join teachers t2 on t2.id = c.advisor_2_id
  left join lateral (
    select afs.* from activity_form_submissions afs join academic_years ay on ay.id = afs.academic_year_id
    where afs.student_id = s.id and ay.year_be = trim(requested_year)
    order by afs.updated_at desc limit 1
  ) a on true
  left join lateral (
    select lc.certificate_no, lc.exam_year_be, lc.level, cm.status as match_status
    from certificate_matches cm join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = s.id and cm.status in ('auto_matched','confirmed')
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end desc, lc.exam_year_be desc nulls last limit 1
  ) prior on true
  where p.allowed
  order by c.education_band, c.grade_level, c.room_no, s.student_number;
$$;
revoke all on function public.public_activity_access_v2(text,text,text,smallint,smallint) from public;
grant execute on function public.public_activity_access_v2(text,text,text,smallint,smallint) to anon, authenticated;

create or replace function public.staff_activity_roster_page_v2(requested_year text, _page_offset integer, _page_limit integer)
returns table (
  student_id uuid, student_number text, full_name text, education_band text,
  grade_level smallint, room_no smallint, advisor_1 text, advisor_2 text,
  certificate_no text, certificate_year text, legacy_level text, match_status text,
  citizen_id text, birth_iso text, application_level text, previous_certificate_year text,
  exam_status text, special_needs boolean, organization_name text, organization_location text,
  temple_affiliation text, school_council text, notes text
)
language sql stable security definer set search_path = public
as $$
  select s.id, s.student_number, s.full_name, c.education_band, c.grade_level, c.room_no,
    t1.display_name, t2.display_name, coalesce(a.previous_certificate_no, prior.certificate_no),
    coalesce(a.previous_certificate_year, prior.exam_year_be), prior.level, prior.match_status,
    s.citizen_id, case when s.birth_date is null then null else to_char(s.birth_date, 'YYYY-MM-DD') end,
    a.application_level, a.previous_certificate_year, a.exam_status, coalesce(a.special_needs, false),
    a.organization_name, a.organization_location, a.temple_affiliation, a.school_council, a.notes
  from academic_years y join classrooms c on c.academic_year_id = y.id and c.active
  join students s on s.classroom_id = c.id and s.status = 'active'
  left join teachers t1 on t1.id = c.advisor_1_id left join teachers t2 on t2.id = c.advisor_2_id
  left join lateral (
    select afs.* from activity_form_submissions afs where afs.student_id = s.id and afs.academic_year_id = y.id
    order by afs.updated_at desc limit 1
  ) a on true
  left join lateral (
    select lc.certificate_no, lc.exam_year_be, lc.level, cm.status as match_status
    from certificate_matches cm join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = s.id and cm.status in ('auto_matched','confirmed')
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end desc, lc.exam_year_be desc nulls last limit 1
  ) prior on true
  where public.is_staff() and y.year_be = trim(requested_year)
  order by c.education_band, c.grade_level, c.room_no, s.student_number
  offset _page_offset limit _page_limit;
$$;
revoke all on function public.staff_activity_roster_page_v2(text,integer,integer) from public;
grant execute on function public.staff_activity_roster_page_v2(text,integer,integer) to authenticated;

create or replace function public.mother_sangha_form_rows_v4(requested_year text, requested_level text)
returns table (
  form_sequence bigint, academic_year text, dhamma_level text, title text,
  first_name text, last_name text, citizen_id text, birth_date_be text,
  form_education_level text, class_room text, organization_name text,
  organization_subdistrict text, organization_district text, organization_province text,
  temple_affiliation text, temple_subdistrict text, temple_district text, temple_province text,
  school_name text, exam_site_code text, school_council text,
  previous_certificate_year text, previous_certificate_no text, previous_school_council text,
  notes text, current_student_number text
)
language sql stable security definer set search_path = public
as $$
  select row_number() over (order by s.student_number), trim(requested_year), r.dhamma_level,
    coalesce(s.title, case when c.grade_level <= 3 then 'เด็กชาย' else 'นาย' end),
    s.first_name, s.last_name, s.citizen_id,
    case when s.birth_date is null then null else to_char(s.birth_date + interval '543 years', 'DD/MM/YYYY') end,
    case when c.education_band = 'higher_education' then 'อุดมศึกษา' else 'มัธยม' end,
    concat('ม.', c.grade_level, '/', c.room_no), coalesce(a.organization_name, 'โรงเรียนวัดไร่ขิงวิทยา'),
    'ไร่ขิง', 'สามพราน', 'นครปฐม', coalesce(a.temple_affiliation, 'วัดไร่ขิงพระอารามหลวง'),
    'ไร่ขิง', 'สามพราน', 'นครปฐม', coalesce(a.organization_name, 'โรงเรียนวัดไร่ขิงวิทยา'), '256101', coalesce(a.school_council, 'คณะจังหวัดนครปฐม'),
    coalesce(a.previous_certificate_year, prior.exam_year_be), coalesce(a.previous_certificate_no, prior.certificate_no), coalesce(a.school_council, 'คณะจังหวัดนครปฐม'),
    a.notes, s.student_number
  from academic_years y
  join exam_registrations r on r.academic_year_id = y.id
  join students s on s.id = r.student_id and s.status = 'active'
  join classrooms c on c.id = s.classroom_id and c.academic_year_id = y.id and c.active
  left join activity_form_submissions a on a.academic_year_id = y.id and a.student_id = s.id and a.application_level = r.dhamma_level and a.exam_status = 'exam'
  left join lateral (
    select lc.exam_year_be, lc.certificate_no
    from certificate_matches cm join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = s.id and cm.status in ('auto_matched','confirmed')
      and ((r.dhamma_level = 'โท' and lc.level in ('ตรี','โท','เอก')) or (r.dhamma_level = 'เอก' and lc.level in ('โท','เอก')))
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 else 1 end desc, lc.exam_year_be desc nulls last limit 1
  ) prior on true
  where (public.is_staff() or auth.role() = 'service_role')
    and y.year_be = trim(requested_year) and r.dhamma_level = trim(requested_level)
    and r.application_status in ('submitted','verified')
  order by s.student_number;
$$;
revoke all on function public.mother_sangha_form_rows_v4(text,text) from public;
grant execute on function public.mother_sangha_form_rows_v4(text,text) to authenticated, service_role;

create or replace function public.mark_google_sheet_sync(requested_year text, requested_state text, requested_error text default null)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare year_id uuid;
begin
  select id into year_id from public.academic_years where year_be = trim(requested_year) limit 1;
  if year_id is null then return false; end if;
  update public.google_sheet_sync_queue
  set state = requested_state,
      last_error = requested_error,
      attempts = case when requested_state = 'running' then attempts + 1 else attempts end,
      completed_at = case when requested_state = 'complete' then now() else null end,
      requested_at = now()
  where academic_year_id = year_id;
  return found;
end;
$$;
revoke all on function public.mark_google_sheet_sync(text,text,text) from public;
grant execute on function public.mark_google_sheet_sync(text,text,text) to service_role;
