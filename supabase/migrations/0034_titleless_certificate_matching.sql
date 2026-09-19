-- Match historical certificates when only the Thai honorific differs.
-- This migration changes matching metadata only; it does not expose citizen IDs
-- or birth dates and it never writes to the historical source.

create or replace function public.dharma_normalize_person_name(input_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    public.dharma_normalize_name(input_text),
    '^(เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง|พระ|สามเณร)',
    ''
  );
$$;

create or replace function public.refresh_certificate_matches_staff()
returns table (auto_matched bigint, review_candidates bigint, unmatched_students bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'STAFF_ROLE_REQUIRED';
  end if;

  with candidate_pairs as (
    select
      s.id as student_id,
      lc.id as legacy_certificate_id,
      bool_or(lc.normalized_name = s.normalized_name) as exact_match,
      case lc.level
        when 'ธรรมศึกษาชั้นตรี' then 1
        when 'ตรี' then 1
        when 'ธรรมศึกษาชั้นโท' then 2
        when 'โท' then 2
        when 'ธรรมศึกษาชั้นเอก' then 3
        when 'เอก' then 3
        else 0
      end as level_rank,
      coalesce(nullif(regexp_replace(lc.exam_year_be::text, '[^0-9]', '', 'g'), '')::integer, -1) as exam_year_num
    from students s
    join legacy_certificates lc
      on lc.normalized_name = s.normalized_name
      or public.dharma_normalize_person_name(lc.full_name) = public.dharma_normalize_person_name(s.full_name)
    where s.status = 'active'
    group by s.id, lc.id
  ), ranked as (
    select
      student_id,
      legacy_certificate_id,
      exact_match,
      level_rank,
      exam_year_num,
      max(level_rank) over (partition by student_id) as highest_level_rank
    from candidate_pairs
  ), latest_highest as (
    select *, max(exam_year_num) over (partition by student_id) as latest_highest_year
    from ranked
    where level_rank = highest_level_rank
  ), selected as (
    select *, count(*) over (partition by student_id) as candidate_count
    from latest_highest
    where exam_year_num = latest_highest_year
  )
  insert into certificate_matches (student_id, legacy_certificate_id, status, confidence, matching_basis)
  select
    student_id,
    legacy_certificate_id,
    case when candidate_count = 1 then 'auto_matched' else 'review' end,
    case when candidate_count = 1 then 1.0000 else 0.7500 end,
    jsonb_build_object(
      'basis', case
        when candidate_count <> 1 then 'highest_level_still_has_multiple_records'
        when exact_match then 'exact_normalized_full_name'
        else 'exact_normalized_name_without_title_highest_level'
      end,
      'candidate_count', candidate_count,
      'highest_level_rank', level_rank,
      'latest_exam_year_be', exam_year_num
    )
  from ranked
  on conflict (student_id, legacy_certificate_id) do update
    set status = excluded.status,
        confidence = excluded.confidence,
        matching_basis = excluded.matching_basis;

  return query
  select
    (select count(*) from certificate_matches where status = 'auto_matched'),
    (select count(*) from certificate_matches where status = 'review'),
    (select count(*) from students s
      where s.status = 'active'
        and not exists (select 1 from certificate_matches cm where cm.student_id = s.id));
end;
$$;

revoke all on function public.dharma_normalize_person_name(text) from public;
grant execute on function public.dharma_normalize_person_name(text) to authenticated;
revoke all on function public.refresh_certificate_matches_staff() from public;
grant execute on function public.refresh_certificate_matches_staff() to authenticated;

comment on function public.refresh_certificate_matches_staff() is
  'Staff-only idempotent match pass. Selects the highest completed level, then latest year; ties at the highest level remain review.';
