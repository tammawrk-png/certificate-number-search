-- Complete the per-level Mother Sangha field contract. The source .xls files
-- remain read-only; temple-location fields stay blank until an authoritative
-- value is supplied rather than being guessed.
create or replace function public.mother_sangha_form_rows_v3(
  requested_year text,
  requested_level text
)
returns table (
  form_sequence bigint, academic_year text, dhamma_level text, title text,
  first_name text, last_name text, citizen_id text, birth_date_be text,
  form_education_level text, class_room text, organization_name text,
  organization_subdistrict text, organization_district text,
  organization_province text, temple_affiliation text,
  temple_subdistrict text, temple_district text, temple_province text,
  school_name text, exam_site_code text, school_council text,
  previous_certificate_year text, previous_certificate_no text,
  previous_school_council text, notes text, current_student_number text
)
language sql stable security definer set search_path = public
as $$
  select row_number() over (order by s.student_number), trim(requested_year), r.dhamma_level,
    coalesce(s.title, case when c.grade_level <= 3 then 'เด็กชาย' else 'นาย' end),
    s.first_name, s.last_name, s.citizen_id,
    case when s.birth_date is null then null else to_char(s.birth_date + interval '543 years', 'DD/MM/YYYY') end,
    case when c.education_band = 'higher_education' then 'อุดมศึกษา' else 'มัธยม' end,
    concat('ม.', c.grade_level, '/', c.room_no), 'โรงเรียนวัดไร่ขิงวิทยา',
    'ไร่ขิง', 'สามพราน', 'นครปฐม', 'วัดไร่ขิงพระอารามหลวง',
    null, null, null, 'โรงเรียนวัดไร่ขิงวิทยา', '256101', 'คณะจังหวัดนครปฐม',
    prior.exam_year_be, prior.certificate_no, 'คณะจังหวัดนครปฐม', null, s.student_number
  from academic_years y
  join exam_registrations r on r.academic_year_id = y.id
  join students s on s.id = r.student_id and s.status = 'active'
  join classrooms c on c.id = s.classroom_id and c.academic_year_id = y.id and c.active
  left join lateral (
    select lc.exam_year_be, lc.certificate_no
    from certificate_matches cm join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = s.id and cm.status in ('auto_matched', 'confirmed')
      and ((r.dhamma_level = 'โท' and lc.level in ('ตรี', 'โท', 'เอก'))
        or (r.dhamma_level = 'เอก' and lc.level in ('โท', 'เอก')))
    order by case lc.level when 'เอก' then 3 when 'โท' then 2 else 1 end desc, lc.exam_year_be desc
    limit 1
  ) prior on true
  where public.is_staff() and y.year_be = trim(requested_year)
    and r.dhamma_level = trim(requested_level)
    and r.application_status in ('submitted', 'verified')
  order by s.student_number;
$$;

revoke all on function public.mother_sangha_form_rows_v3(text, text) from public;
grant execute on function public.mother_sangha_form_rows_v3(text, text) to authenticated;
