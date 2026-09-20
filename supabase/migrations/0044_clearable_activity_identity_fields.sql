-- Keep Supabase authoritative across devices, including explicit clearing of
-- birth date / citizen ID. The legacy function uses COALESCE for compatibility
-- and therefore cannot distinguish "clear" from "not supplied".
create or replace function public.save_activity_form_row_v2(
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
  result record;
begin
  select * into result from public.save_activity_form_row(
    requested_year, requested_role, requested_access_code,
    requested_student_number, requested_application_level,
    requested_citizen_id, requested_birth_iso, requested_previous_year,
    requested_previous_no, requested_exam_status, requested_special_needs,
    requested_organization_name, requested_organization_location,
    requested_temple_affiliation, requested_school_council, requested_notes
  );

  if not coalesce(result.saved, false) then
    return query select result.saved::boolean, result.result_code::text, result.message::text;
    return;
  end if;

  -- The form submits the complete current value. An empty value therefore
  -- means an intentional clear, not "leave the old PII in place".
  update public.students s
  set citizen_id = case
        when nullif(trim(coalesce(requested_citizen_id, '')), '') is null then null
        else regexp_replace(requested_citizen_id, '[^0-9]', '', 'g')
      end,
      birth_date = case
        when nullif(trim(coalesce(requested_birth_iso, '')), '') is null then null
        else to_date(requested_birth_iso, 'YYYY-MM-DD')
      end,
      updated_at = now()
  from public.classrooms c
  join public.academic_years y on y.id = c.academic_year_id
  where s.classroom_id = c.id
    and y.year_be = trim(requested_year)
    and s.student_number = trim(requested_student_number)
    and s.status = 'active';

  return query select result.saved::boolean, result.result_code::text, result.message::text;
end;
$$;

revoke all on function public.save_activity_form_row_v2(text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text) from public;
grant execute on function public.save_activity_form_row_v2(text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text) to anon, authenticated;
