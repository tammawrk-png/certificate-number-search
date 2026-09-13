-- Public, exact-identity preflight for the no-login registration flow.
-- It returns only the fields needed to review a registration after the
-- caller supplies both a current student number and the matching full name.
create or replace function public.public_student_registration_options(
  requested_year text,
  requested_student_number text,
  requested_full_name text
)
returns table (
  verified boolean,
  education_band text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  matched_certificate_count bigint,
  review_candidate_count bigint,
  highest_legacy_level text,
  recommended_level text,
  required_level text,
  guidance_status text
)
language sql
stable
security definer
set search_path = public
as $$
  with current_student as (
    select s.id, c.education_band, c.grade_level, c.room_no,
      t1.display_name as advisor_1, t2.display_name as advisor_2
    from students s
    join classrooms c on c.id = s.classroom_id and c.active
    join academic_years y on y.id = c.academic_year_id
    left join teachers t1 on t1.id = c.advisor_1_id
    left join teachers t2 on t2.id = c.advisor_2_id
    where y.year_be = trim(requested_year) and s.status = 'active'
      and s.student_number = trim(requested_student_number)
      and public.dharma_normalize_name(s.full_name) = public.dharma_normalize_name(requested_full_name)
    limit 1
  ),
  history as (
    select cm.student_id,
      count(*) filter (where cm.status in ('auto_matched', 'confirmed'))::bigint as matched_count,
      count(*) filter (where cm.status = 'review')::bigint as review_count,
      max(case when cm.status in ('auto_matched', 'confirmed') then
        case lc.level when 'เอก' then 3 when 'โท' then 2 when 'ตรี' then 1 else 0 end
        else 0 end) as highest_level_no
    from certificate_matches cm
    join legacy_certificates lc on lc.id = cm.legacy_certificate_id
    join current_student cs on cs.id = cm.student_id
    group by cm.student_id
  )
  select true, cs.education_band, cs.grade_level, cs.room_no,
    cs.advisor_1, cs.advisor_2, coalesce(h.matched_count, 0), coalesce(h.review_count, 0),
    case h.highest_level_no when 3 then 'เอก' when 2 then 'โท' when 1 then 'ตรี' end,
    case when cs.grade_level in (1, 4) then 'ตรี'
      when h.highest_level_no = 1 then 'โท'
      when h.highest_level_no = 2 then 'เอก'
      when h.highest_level_no = 3 then null else 'ตรี' end,
    case when cs.grade_level in (1, 4) then 'ตรี' end,
    case when h.review_count > 0 then 'review_required'
      when cs.grade_level in (1, 4) then 'required'
      when h.highest_level_no = 3 then 'completed'
      when h.highest_level_no in (1, 2) then 'suggested' else 'unmatched' end
  from current_student cs left join history h on h.student_id = cs.id;
$$;

revoke all on function public.public_student_registration_options(text, text, text) from public;
grant execute on function public.public_student_registration_options(text, text, text) to anon, authenticated;

comment on function public.public_student_registration_options(text, text, text) is
  'Exact-identity public preflight for registration. Returns operational routing and progress guidance only after number/name verification.';
