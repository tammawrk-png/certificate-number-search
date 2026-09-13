-- Staff-only status updates for historical certificate pickup tracking.
create or replace function public.certificate_pickup_report_rows_v2(requested_year text)
returns table (
  certificate_id uuid,
  academic_year text,
  student_number text,
  current_full_name text,
  education_band text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  certificate_no text,
  legacy_full_name text,
  dhamma_level text,
  exam_year_be text,
  pickup_status text,
  match_status text,
  pickup_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select lc.id, y.year_be, s.student_number, s.full_name, c.education_band, c.grade_level, c.room_no,
    t1.display_name, t2.display_name, lc.certificate_no, lc.full_name, lc.level, lc.exam_year_be,
    lc.pickup_status, cm.status, lc.pickup_note
  from academic_years y
  join classrooms c on c.academic_year_id = y.id and c.active
  join students s on s.classroom_id = c.id and s.status = 'active'
  join certificate_matches cm on cm.student_id = s.id and cm.status in ('auto_matched', 'confirmed')
  join legacy_certificates lc on lc.id = cm.legacy_certificate_id
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  where public.is_staff() and y.year_be = trim(requested_year)
    and lc.pickup_status in ('pending', 'notified')
  order by c.education_band, c.grade_level, c.room_no, s.student_number, lc.level, lc.exam_year_be;
$$;

revoke all on function public.certificate_pickup_report_rows_v2(text) from public;
grant execute on function public.certificate_pickup_report_rows_v2(text) to authenticated;

create or replace function public.update_certificate_pickup_status(
  requested_certificate_id uuid,
  requested_status text,
  requested_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  certificate_row legacy_certificates%rowtype;
begin
  if not public.is_staff() then raise exception 'STAFF_ROLE_REQUIRED'; end if;
  if requested_status not in ('pending', 'notified', 'claimed', 'not_applicable') then
    raise exception 'INVALID_PICKUP_STATUS';
  end if;
  select * into certificate_row from legacy_certificates where id = requested_certificate_id for update;
  if certificate_row.id is null then raise exception 'CERTIFICATE_NOT_FOUND'; end if;
  update legacy_certificates set pickup_status = requested_status,
    pickup_note = nullif(trim(requested_note), ''),
    pickup_claimed_at = case when requested_status = 'claimed' then coalesce(pickup_claimed_at, now()) else null end,
    pickup_updated_by = auth.uid()
  where id = requested_certificate_id;
  insert into audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'update_certificate_pickup_status', 'legacy_certificate', requested_certificate_id,
    jsonb_build_object('previous_status', certificate_row.pickup_status, 'new_status', requested_status,
      'certificate_no', certificate_row.certificate_no));
  return jsonb_build_object('certificate_id', requested_certificate_id, 'pickup_status', requested_status);
end;
$$;

revoke all on function public.update_certificate_pickup_status(uuid, text, text) from public;
grant execute on function public.update_certificate_pickup_status(uuid, text, text) to authenticated;

comment on function public.update_certificate_pickup_status(uuid, text, text) is
  'Staff-only audited status update for historical certificate pickup; Firebase source rows remain unchanged.';
