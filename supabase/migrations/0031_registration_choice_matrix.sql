-- Registration choice matrix for the simplified school workflow.
-- This migration is source-only until an operator applies it to the approved
-- Supabase project. Firebase remains read-only.

create or replace function public.registration_choice_matrix(
  requested_year text,
  requested_student_number text
)
returns table (
  student_id uuid,
  student_number text,
  full_name text,
  education_band text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  dhamma_level text,
  is_selected boolean,
  application_status text,
  certificate_no text,
  certificate_year text,
  highest_legacy_level text,
  recommended_level text,
  required_level text,
  guidance_status text,
  guidance_note text
)
language sql stable security definer set search_path = public
as $$
  with current_student as (
    select s.id as student_id, s.student_number, s.full_name,
      c.education_band, c.grade_level, c.room_no,
      t1.display_name as advisor_1, t2.display_name as advisor_2
    from students s
    join classrooms c on c.id = s.classroom_id and c.active
    join academic_years y on y.id = c.academic_year_id
      and y.year_be = trim(requested_year)
    left join teachers t1 on t1.id = c.advisor_1_id
    left join teachers t2 on t2.id = c.advisor_2_id
    where s.status = 'active'
      and s.student_number = trim(requested_student_number)
    limit 1
  ), levels(dhamma_level) as (values ('ตรี'), ('โท'), ('เอก')),
  history as (
    select cm.student_id,
      max(case when cm.status in ('auto_matched', 'confirmed')
        then case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end end) as highest_level_no,
      (array_agg(lc.certificate_no order by
        case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end desc,
        lc.exam_year_be desc nulls last) filter (where cm.status in ('auto_matched', 'confirmed')))[1] as certificate_no,
      (array_agg(lc.exam_year_be order by
        case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end desc,
        lc.exam_year_be desc nulls last) filter (where cm.status in ('auto_matched', 'confirmed')))[1] as certificate_year,
      count(*) filter (where cm.status = 'review') as review_count
    from certificate_matches cm
    join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    group by cm.student_id
  )
  select cs.student_id, cs.student_number, cs.full_name,
    cs.education_band, cs.grade_level, cs.room_no, cs.advisor_1, cs.advisor_2,
    l.dhamma_level,
    coalesce(r.application_status in ('submitted', 'verified'), false),
    coalesce(r.application_status, 'not_applied'), h.certificate_no, h.certificate_year,
    case h.highest_level_no when 3 then 'เอก' when 2 then 'โท' when 1 then 'ตรี' end,
    case when cs.education_band in ('lower_secondary', 'upper_secondary') and cs.grade_level in (1, 4) then 'ตรี'
      when h.highest_level_no = 1 then 'โท'
      when h.highest_level_no = 2 then 'เอก'
      when h.highest_level_no = 3 then null else 'ตรี' end,
    case when cs.education_band in ('lower_secondary', 'upper_secondary') and cs.grade_level in (1, 4) then 'ตรี' end,
    case when coalesce(h.review_count, 0) > 0 then 'review_required'
      when cs.education_band in ('lower_secondary', 'upper_secondary') and cs.grade_level in (1, 4) then 'required'
      when h.highest_level_no = 3 then 'completed'
      when h.highest_level_no in (1, 2) then 'suggested' else 'unmatched' end,
    case when coalesce(h.review_count, 0) > 0 then 'พบชื่อซ้ำหรือประวัติที่ต้องตรวจสอบ'
      when cs.education_band in ('lower_secondary', 'upper_secondary') and cs.grade_level in (1, 4) then 'ชั้น ม.1 และ ม.4 ต้องสมัครชั้นตรี'
      when h.highest_level_no = 1 then 'แนะนำสมัครชั้นโท'
      when h.highest_level_no = 2 then 'แนะนำสมัครชั้นเอก'
      when h.highest_level_no = 3 then 'พบประวัติชั้นเอกแล้ว'
      else 'ยังไม่พบประวัติเดิมที่จับคู่ได้' end
  from current_student cs
  cross join levels l
  left join exam_registrations r
    on r.student_id = cs.student_id
   and r.academic_year_id = (select id from academic_years where year_be = trim(requested_year) limit 1)
   and r.dhamma_level = l.dhamma_level
  left join history h on h.student_id = cs.student_id
  order by case l.dhamma_level when 'ตรี' then 1 when 'โท' then 2 else 3 end;
$$;

revoke all on function public.registration_choice_matrix(text, text) from public;
grant execute on function public.registration_choice_matrix(text, text) to anon, authenticated;

create or replace function public.submit_registration_choices(
  requested_year text,
  requested_student_number text,
  requested_full_name text,
  requested_band text,
  requested_levels text[]
)
returns table (accepted boolean, result_code text, message text, updated_count integer)
language plpgsql security definer set search_path = public
as $$
declare
  year_id uuid;
  student_row students%rowtype;
  level_name text;
  updated_rows integer := 0;
begin
  select id into year_id from academic_years where year_be = trim(requested_year) limit 1;
  select s.* into student_row
  from students s join classrooms c on c.id = s.classroom_id and c.active
  where c.academic_year_id = year_id and s.status = 'active'
    and s.student_number = trim(requested_student_number)
    and public.dharma_normalize_name(s.full_name) = public.dharma_normalize_name(requested_full_name)
  limit 1;

  if year_id is null or student_row.id is null then
    return query select false, 'STUDENT_NOT_FOUND', 'ไม่พบข้อมูลนักเรียนหรือชื่อไม่ตรงทะเบียน', 0;
    return;
  end if;
  if requested_band is null or not exists (
    select 1 from classrooms c where c.id = student_row.classroom_id
      and c.education_band = trim(requested_band)
  ) then
    return query select false, 'BAND_MISMATCH', 'สายการศึกษาที่ส่งมาไม่ตรงกับทะเบียน', 0;
    return;
  end if;
  if not exists (select 1 from registration_windows where academic_year_id = year_id and is_open) then
    return query select false, 'REGISTRATION_CLOSED', 'ยังไม่เปิดช่วงรับสมัคร', 0;
    return;
  end if;
  if exists (select 1 from unnest(coalesce(requested_levels, array[]::text[])) x
    where x not in ('ตรี', 'โท', 'เอก')) then
    return query select false, 'INVALID_LEVEL', 'พบระดับธรรมศึกษาที่ไม่ถูกต้อง', 0;
    return;
  end if;
  if student_row.classroom_id is not null and exists (
    select 1 from classrooms c where c.id = student_row.classroom_id
      and c.education_band in ('lower_secondary', 'upper_secondary')
      and c.grade_level in (1, 4)
  ) and not ('ตรี' = any(coalesce(requested_levels, array[]::text[]))) then
    return query select false, 'REQUIRED_LEVEL_UNSELECTED', 'ชั้น ม.1 และ ม.4 ต้องสมัครธรรมศึกษาชั้นตรี', 0;
    return;
  end if;

  foreach level_name in array array['ตรี', 'โท', 'เอก'] loop
    if level_name = any(coalesce(requested_levels, array[]::text[])) then
      if level_name in ('โท', 'เอก') and not exists (
        select 1 from certificate_matches cm
        join legacy_certificates lc on lc.id = cm.legacy_certificate_id
        where cm.student_id = student_row.id and cm.status in ('auto_matched', 'confirmed')
          and ((level_name = 'โท' and lc.level in ('ตรี', 'โท', 'เอก'))
            or (level_name = 'เอก' and lc.level in ('โท', 'เอก')))
      ) then
        return query select false, 'PREREQUISITE_NOT_MET',
          case level_name when 'โท' then 'ยังไม่พบหลักฐานชั้นตรีสำหรับสมัครชั้นโท'
            else 'ยังไม่พบหลักฐานชั้นโทสำหรับสมัครชั้นเอก' end, updated_rows;
        return;
      end if;
      insert into exam_registrations(academic_year_id, student_id, education_band, dhamma_level,
        application_status, submitted_at)
      values (year_id, student_row.id, requested_band, level_name, 'submitted', now())
      on conflict (academic_year_id, student_id, education_band, dhamma_level)
      do update set application_status = 'submitted', submitted_at = now();
      updated_rows := updated_rows + 1;
    else
      update exam_registrations set application_status = 'cancelled'
      where academic_year_id = year_id and student_id = student_row.id
        and dhamma_level = level_name and application_status = 'submitted';
      updated_rows := updated_rows + coalesce((select count(*) from exam_registrations
        where academic_year_id = year_id and student_id = student_row.id
          and dhamma_level = level_name and application_status = 'cancelled'), 0)::integer;
    end if;
  end loop;
  insert into audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'submit_registration_choices', 'student', student_row.id,
    jsonb_build_object('academic_year', requested_year, 'levels', requested_levels));
  return query select true, 'CHOICES_SAVED', 'บันทึกสถานะการสมัครแล้ว', updated_rows;
end;
$$;

revoke all on function public.submit_registration_choices(text, text, text, text, text[]) from public;
grant execute on function public.submit_registration_choices(text, text, text, text, text[]) to anon, authenticated;

create or replace function public.staff_registration_choice_matrix(
  requested_year text,
  requested_band text default null,
  requested_grade smallint default null,
  requested_room smallint default null
)
returns table (
  student_id uuid, student_number text, full_name text, education_band text,
  grade_level smallint, room_no smallint, advisor_1 text, advisor_2 text,
  dhamma_level text, is_selected boolean, application_status text,
  certificate_no text, certificate_year text, highest_legacy_level text,
  recommended_level text, required_level text, guidance_status text, guidance_note text
)
language sql stable security definer set search_path = public
as $$
  select m.*
  from academic_years y
  join classrooms c on c.academic_year_id = y.id and c.active
  join students st on st.classroom_id = c.id and st.status = 'active'
  cross join lateral public.registration_choice_matrix(trim(requested_year), st.student_number) m
  where public.is_staff() and y.year_be = trim(requested_year)
    and (requested_band is null or m.education_band = requested_band)
    and (requested_grade is null or m.grade_level = requested_grade)
    and (requested_room is null or m.room_no = requested_room)
  order by m.education_band, m.grade_level, m.room_no, m.student_number,
    case m.dhamma_level when 'ตรี' then 1 when 'โท' then 2 else 3 end;
$$;

revoke all on function public.staff_registration_choice_matrix(text, text, smallint, smallint) from public;
grant execute on function public.staff_registration_choice_matrix(text, text, smallint, smallint) to authenticated;

create or replace function public.staff_set_registration_choice(
  requested_year text,
  requested_student_id uuid,
  requested_level text,
  requested_selected boolean
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  year_id uuid;
  student_row students%rowtype;
  grade_no smallint;
begin
  if not public.is_staff() then raise exception 'STAFF_ROLE_REQUIRED'; end if;
  if requested_level not in ('ตรี', 'โท', 'เอก') then raise exception 'INVALID_LEVEL'; end if;
  select id into year_id from academic_years where year_be = trim(requested_year) limit 1;
  select s.*, c.grade_level into student_row, grade_no
  from students s join classrooms c on c.id = s.classroom_id and c.active
  where s.id = requested_student_id and s.status = 'active' and c.academic_year_id = year_id;
  if student_row.id is null then raise exception 'STUDENT_NOT_FOUND'; end if;
  if not requested_selected and grade_no in (1, 4) and requested_level = 'ตรี' and exists (
    select 1 from classrooms c where c.id = student_row.classroom_id and c.education_band in ('lower_secondary', 'upper_secondary')
  ) then
    raise exception 'REQUIRED_LEVEL_UNSELECTED';
  end if;
  if requested_selected and requested_level in ('โท', 'เอก') and not exists (
    select 1 from certificate_matches cm
    join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    where cm.student_id = student_row.id and cm.status in ('auto_matched', 'confirmed')
      and ((requested_level = 'โท' and lc.level in ('ตรี', 'โท', 'เอก'))
        or (requested_level = 'เอก' and lc.level in ('โท', 'เอก')))
  ) then
    raise exception 'PREREQUISITE_NOT_MET';
  end if;
  if requested_selected then
    insert into exam_registrations(academic_year_id, student_id, education_band, dhamma_level,
      application_status, submitted_at)
    select year_id, student_row.id, c.education_band, requested_level, 'submitted', now()
    from classrooms c where c.id = student_row.classroom_id
    on conflict (academic_year_id, student_id, education_band, dhamma_level)
    do update set application_status = 'submitted', submitted_at = now();
  else
    update exam_registrations set application_status = 'cancelled'
    where academic_year_id = year_id and student_id = student_row.id
      and dhamma_level = requested_level and application_status = 'submitted';
  end if;
  insert into audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'staff_set_registration_choice', 'student', student_row.id,
    jsonb_build_object('academic_year', requested_year, 'level', requested_level, 'selected', requested_selected));
  return jsonb_build_object('saved', true, 'student_id', student_row.id,
    'dhamma_level', requested_level, 'selected', requested_selected);
end;
$$;

revoke all on function public.staff_set_registration_choice(text, uuid, text, boolean) from public;
grant execute on function public.staff_set_registration_choice(text, uuid, text, boolean) to authenticated;
