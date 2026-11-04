-- Google Sheets receives only a real exam selection with complete identity data.
-- The sheet order is classroom first, then first/last name.
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
    a.previous_certificate_year as form_previous_year,
    a.previous_certificate_no as form_previous_no,
    regexp_replace(trim(coalesce(s.full_name, '')), '[[:space:]]+', ' ', 'g') as clean_full_name
  from academic_years y
  join exam_registrations r on r.academic_year_id = y.id
  join students s on s.id = r.student_id and s.status = 'active'
  join classrooms c on c.id = s.classroom_id and c.academic_year_id = y.id and c.active
  join activity_form_submissions a on a.academic_year_id = y.id
    and a.student_id = s.id and a.application_level = r.dhamma_level and a.exam_status = 'exam'
  where auth.role() = 'service_role'
    and y.year_be = trim(requested_year)
    and r.dhamma_level = trim(requested_level)
    and r.application_status in ('submitted', 'verified')
    and s.citizen_id ~ '^[0-9]{13}$'
    and s.birth_date is not null
), parsed as (
  select source_rows.*,
    case when clean_full_name ~ '^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|พระ|สามเณร)' then clean_full_name
      else regexp_replace(trim(concat_ws(' ', title, first_name, last_name)), '[[:space:]]+', ' ', 'g') end as source_name
  from source_rows
), named as (
  select parsed.*,
    substring(source_name from '^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|พระ|สามเณร)') as parsed_title,
    regexp_replace(source_name, '^(เด็กชาย|เด็กหญิง|นาย|นางสาว|นาง|พระ|สามเณร)[[:space:]]*', '') as name_body
  from parsed
)
select row_number() over (order by grade_level, room_no, name_body, student_number), year_be, dhamma_level,
  coalesce(parsed_title, nullif(title, ''), case when grade_level <= 3 then 'เด็กชาย' else 'นาย' end),
  split_part(name_body, ' ', 1), nullif(trim(substr(name_body, length(split_part(name_body, ' ', 1)) + 1)), ''),
  citizen_id, to_char(birth_date + interval '543 years', 'DD/MM/YYYY'),
  case when education_band = 'higher_education' then 'อุดมศึกษา' else 'มัธยม' end,
  concat('ม.', grade_level, '/', room_no), coalesce(organization_name, 'โรงเรียนวัดไร่ขิงวิทยา'),
  'ไร่ขิง', 'สามพราน', 'นครปฐม', coalesce(temple_affiliation, 'วัดไร่ขิงพระอารามหลวง'),
  'ไร่ขิง', 'สามพราน', 'นครปฐม', coalesce(organization_name, 'โรงเรียนวัดไร่ขิงวิทยา'), '256101',
  coalesce(school_council, 'คณะจังหวัดนครปฐม'), coalesce(form_previous_year, prior.exam_year_be),
  coalesce(form_previous_no, prior.certificate_no), coalesce(school_council, 'คณะจังหวัดนครปฐม'), notes, student_number
from named
left join lateral (
  select lc.exam_year_be, lc.certificate_no
  from certificate_matches cm join legacy_certificates lc on lc.id = cm.legacy_certificate_id
  where cm.student_id = named.id and cm.status in ('auto_matched', 'confirmed')
    and ((named.dhamma_level = 'โท' and lc.level in ('ตรี', 'โท', 'เอก'))
      or (named.dhamma_level = 'เอก' and lc.level in ('โท', 'เอก')))
  order by case lc.level when 'เอก' then 3 when 'โท' then 2 else 1 end desc,
    lc.exam_year_be desc nulls last limit 1
) prior on true
order by grade_level, room_no, name_body, student_number;
$$;
revoke all on function public.mother_sangha_form_rows_worker_v1(text, text) from public;
grant execute on function public.mother_sangha_form_rows_worker_v1(text, text) to service_role;
