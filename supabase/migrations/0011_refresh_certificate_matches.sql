-- Idempotent, reviewable matching pass. Firebase remains read-only.
-- This is callable by authenticated staff only; anonymous clients cannot run it.
create or replace function public.refresh_certificate_matches()
returns table (auto_matched bigint, review_candidates bigint, unmatched_students bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  with candidates as (
    select s.id as student_id, lc.id as legacy_certificate_id,
           count(*) over (partition by s.id) as candidate_count
    from students s
    join legacy_certificates lc on lc.normalized_name = s.normalized_name
    where s.status = 'active'
  )
  insert into certificate_matches (student_id, legacy_certificate_id, status, confidence, matching_basis)
  select student_id, legacy_certificate_id,
         case when candidate_count = 1 then 'auto_matched' else 'review' end,
         case when candidate_count = 1 then 1.0000 else 0.7500 end,
         jsonb_build_object(
           'basis', case when candidate_count = 1 then 'exact_normalized_full_name' else 'exact_name_multiple_legacy_records' end,
           'candidate_count', candidate_count
         )
  from candidates
  on conflict (student_id, legacy_certificate_id) do nothing;

  return query
  select
    (select count(*) from certificate_matches where status = 'auto_matched'),
    (select count(*) from certificate_matches where status = 'review'),
    (select count(*) from students s
      where s.status = 'active'
        and not exists (select 1 from certificate_matches cm where cm.student_id = s.id));
end;
$$;

revoke all on function public.refresh_certificate_matches() from public;
-- Execution is granted only through the staff-guarded successor in 0012.

comment on function public.refresh_certificate_matches() is
  'Idempotent exact-name match pass. Ambiguous names require human review; Firebase is never modified.';
