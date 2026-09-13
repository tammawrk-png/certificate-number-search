-- Staff-only row contract matching the personal fields in the unchanged
-- Mother Sangha workbook. It is a source dataset for filling a copy, not a
-- replacement workbook and never changes the source .xls files.
create or replace function public.mother_sangha_form_rows(
  requested_year text,
  requested_level text
)
returns table (
  form_sequence bigint,
  academic_year text,
  dhamma_level text,
  title text,
  first_name text,
  last_name text,
  citizen_id text,
  birth_date_be text,
  form_education_level text,
  class_room text,
  organization_name text,
  subdistrict text,
  district text,
  province text,
  temple_affiliation text,
  school_name text,
  exam_site_code text,
  school_council text,
  current_student_number text
)
language sql stable security definer set search_path = public
as $$
  select row_number() over (order by s.student_number), trim(requested_year), r.dhamma_level,
    coalesce(s.title, case when c.grade_level <= 3 then 'เด็กชาย' else 'นาย' end),
    s.first_name, s.last_name, s.citizen_id,
    case when s.birth_date is null then null else to_char(s.birth_date + interval '543 years', 'DD/MM/YYYY') end,
    case when c.education_band = 'higher_education' then 'อุดมศึกษา' else 'มัธยม' end,
    concat('ม.', c.grade_level, '/', c.room_no),
    'โรงเรียนวัดไร่ขิงวิทยา', 'ไร่ขิง', 'สามพราน', 'นครปฐม',
    'วัดไร่ขิงพระอารามหลวง', 'โรงเรียนวัดไร่ขิงวิทยา', '256101', 'คณะจังหวัดนครปฐม', s.student_number
  from academic_years y
  join exam_registrations r on r.academic_year_id = y.id
  join students s on s.id = r.student_id and s.status = 'active'
  join classrooms c on c.id = s.classroom_id and c.academic_year_id = y.id and c.active
  where public.is_staff() and y.year_be = trim(requested_year)
    and r.dhamma_level = trim(requested_level)
    and r.application_status in ('submitted', 'verified')
  order by s.student_number;
$$;

revoke all on function public.mother_sangha_form_rows(text, text) from public;
grant execute on function public.mother_sangha_form_rows(text, text) to authenticated;

comment on function public.mother_sangha_form_rows(text, text) is
  'Staff-only exact-field dataset for populating a copy of the unchanged per-level Mother Sangha workbook.';
