-- Keep official form columns grounded in the real student name.
-- The full_name field is preferred when it contains a known Thai title;
-- otherwise the structured title/first/last fields are used.
create or replace function public.mother_sangha_form_rows_worker_v1(requested_year text, requested_level text)
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
  with source_rows as (
    select s.*, c.grade_level, c.room_no, c.education_band, r.dhamma_level,
      y.year_be, a.organization_name, a.temple_affiliation, a.school_council, a.notes,
      a.previous_certificate_year as form_previous_year, a.previous_certificate_no as form_previous_no,
      regexp_replace(trim(coalesce(s.full_name, '')), '\\s+', ' ', 'g') as clean_full_name
    from academic_years y
    join exam_registrations r on r.academic_year_id = y.id
    join students s on s.id = r.student_id and s.status = 'active'
    join classrooms c on c.id = s.classroom_id and c.academic_year_id = y.id and c.active
    left join activity_form_submissions a on a.academic_year_id = y.id
      and a.student_id = s.id and a.application_level = r.dhamma_level and a.exam_status = 'exam'
    where auth.role() = 'service_role'
      and y.year_be = trim(requested_year)
      and r.dhamma_level = trim(requested_level)
      and r.application_status in ('submitted','verified')
  ), parsed as (
    select source_rows.*,
      case
        when clean_full_name ~ '^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|พระ|สามเณร)' then clean_full_name
        else regexp_replace(trim(concat_ws(' ', title, first_name, last_name)), '\\s+', ' ', 'g')
      end as source_name
    from source_rows
  ), named as (
    select parsed.*,
      substring(source_name from '^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|พระ|สามเณร)') as parsed_title,
      regexp_replace(source_name, '^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|พระ|สามเณร)\\s*', '') as name_body
    from parsed
  )
  select row_number() over (order by student_number), year_be, dhamma_level,
    coalesce(parsed_title, nullif(title, ''), case when grade_level <= 3 then 'เด็กชาย' else 'นาย' end),
    split_part(name_body, ' ', 1),
    nullif(trim(substr(name_body, length(split_part(name_body, ' ', 1)) + 1)), ''),
    citizen_id,
    case when birth_date is null then null else to_char(birth_date + interval '543 years', 'DD/MM/YYYY') end,
    case when education_band = 'higher_education' then 'อุดมศึกษา' else 'มัธยม' end,
    concat('ม.', grade_level, '/', room_no), coalesce(organization_name, 'โรงเรียนวัดไร่ขิงวิทยา'),
    'ไร่ขิง', 'สามพราน', 'นครปฐม', coalesce(temple_affiliation, 'วัดไร่ขิงพระอารามหลวง'),
    'ไร่ขิง', 'สามพราน', 'นครปฐม', coalesce(organization_name, 'โรงเรียนวัดไร่ขิงวิทยา'), '256101',
    coalesce(school_council, 'คณะจังหวัดนครปฐม'),
    coalesce(form_previous_year, prior.exam_year_be), coalesce(form_previous_no, prior.certificate_no),
    coalesce(school_council, 'คณะจังหวัดนครปฐม'), notes, student_number
  from named
  left join lateral (
    select lc.exam_year_be, lc.certificate_no
    from certificate_matches cm join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = named.id and cm.status in ('auto_matched','confirmed')
      and ((named.dhamma_level = 'โท' and lc.level in ('ตรี','โท','เอก'))
        or (named.dhamma_level = 'เอก' and lc.level in ('โท','เอก')))
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 else 1 end desc,
      lc.exam_year_be desc nulls last limit 1
  ) prior on true
  order by student_number;
$$;
revoke all on function public.mother_sangha_form_rows_worker_v1(text, text) from public;
grant execute on function public.mother_sangha_form_rows_worker_v1(text, text) to service_role;

-- Public status is read-only; only staff can change the window.
create or replace function public.admin_set_registration_window(
  requested_year text,
  requested_open boolean,
  requested_note text default null
)
returns table (academic_year text, is_open boolean, opens_at timestamptz, closes_at timestamptz, note text)
language plpgsql security definer set search_path = public
as $$
declare year_id uuid;
begin
  if not public.is_staff() then raise exception using errcode = '42501', message = 'STAFF_ROLE_REQUIRED'; end if;
  select id into year_id from academic_years where year_be = trim(requested_year) limit 1;
  if year_id is null then raise exception using errcode = '22023', message = 'YEAR_NOT_FOUND'; end if;
  insert into registration_windows(academic_year_id, is_open, opens_at, closes_at, note, updated_at)
  values (year_id, requested_open, case when requested_open then now() else null end,
    case when requested_open then null else now() end, nullif(trim(requested_note), ''), now())
  on conflict (academic_year_id) do update set
    is_open = excluded.is_open, opens_at = excluded.opens_at, closes_at = excluded.closes_at,
    note = excluded.note, updated_at = now();
  insert into audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'admin_set_registration_window', 'academic_year', year_id,
    jsonb_build_object('academic_year', requested_year, 'is_open', requested_open));
  return query select y.year_be, w.is_open, w.opens_at, w.closes_at, w.note
    from academic_years y join registration_windows w on w.academic_year_id = y.id
    where y.id = year_id;
end;
$$;
revoke all on function public.admin_set_registration_window(text, boolean, text) from public;
grant execute on function public.admin_set_registration_window(text, boolean, text) to authenticated;

-- The activity form uses a separate wrapper so the existing save function stays intact.
create or replace function public.save_activity_form_row_v3(
  requested_year text, requested_role text, requested_access_code text,
  requested_student_number text, requested_application_level text,
  requested_citizen_id text default null, requested_birth_iso text default null,
  requested_previous_year text default null, requested_previous_no text default null,
  requested_exam_status text default '', requested_special_needs boolean default false,
  requested_organization_name text default null, requested_organization_location text default null,
  requested_temple_affiliation text default null, requested_school_council text default null,
  requested_notes text default null
)
returns table (saved boolean, result_code text, message text)
language plpgsql security definer set search_path = public
as $$
declare year_id uuid; open_now boolean;
begin
  select id into year_id from academic_years where year_be = trim(requested_year) limit 1;
  select coalesce(w.is_open, false) and (w.opens_at is null or now() >= w.opens_at)
    and (w.closes_at is null or now() <= w.closes_at)
    into open_now
    from registration_windows w where w.academic_year_id = year_id;
  if lower(trim(requested_role)) <> 'admin' and not coalesce(open_now, false) then
    return query select false, 'REGISTRATION_CLOSED', 'ขณะนี้ปิดรับสมัคร ระบบเปิดดูข้อมูลได้อย่างเดียว';
    return;
  end if;
  return query select * from public.save_activity_form_row_v2(
    requested_year, requested_role, requested_access_code, requested_student_number,
    requested_application_level, requested_citizen_id, requested_birth_iso,
    requested_previous_year, requested_previous_no, requested_exam_status,
    requested_special_needs, requested_organization_name, requested_organization_location,
    requested_temple_affiliation, requested_school_council, requested_notes);
end;
$$;
revoke all on function public.save_activity_form_row_v3(text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text) from public;
grant execute on function public.save_activity_form_row_v3(text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text) to anon, authenticated;
