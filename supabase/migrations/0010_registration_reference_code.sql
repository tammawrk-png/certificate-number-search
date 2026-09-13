-- Public registration response with a non-PII reference code.
-- Keep the original RPC for compatibility and expose this successor to the UI.
create or replace function public.submit_public_registration_v2(
  requested_year text,
  requested_student_number text,
  requested_full_name text,
  requested_band text,
  requested_level text
)
returns table (accepted boolean, result_code text, message text, reference_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row record;
  registration_id uuid;
begin
  select * into result_row
  from public.submit_public_registration(
    requested_year, requested_student_number, requested_full_name,
    requested_band, requested_level
  );

  if not coalesce(result_row.accepted, false) then
    return query select false, result_row.result_code, result_row.message, null::text;
    return;
  end if;

  select r.id into registration_id
  from exam_registrations r
  join academic_years y on y.id = r.academic_year_id and y.year_be = trim(requested_year)
  join students s on s.id = r.student_id and s.student_number = trim(requested_student_number)
  where r.education_band = requested_band
    and r.dhamma_level = requested_level
    and public.dharma_normalize_name(s.full_name) = public.dharma_normalize_name(requested_full_name)
  order by r.created_at desc
  limit 1;

  return query select true, 'SUBMITTED', result_row.message,
    concat(trim(requested_year), '-', upper(substr(replace(registration_id::text, '-', ''), 1, 8)));
end;
$$;

revoke all on function public.submit_public_registration_v2(text, text, text, text, text) from public;
grant execute on function public.submit_public_registration_v2(text, text, text, text, text) to anon, authenticated;

comment on function public.submit_public_registration_v2(text, text, text, text, text) is
  'Validated public registration response with a non-PII reference code.';
