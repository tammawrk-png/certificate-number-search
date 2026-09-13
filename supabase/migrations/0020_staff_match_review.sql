-- Staff-only matching review queue and audited decision boundary.
create or replace function public.certificate_match_review_rows(requested_year text)
returns table (
  match_id uuid,
  academic_year text,
  student_number text,
  current_full_name text,
  grade_level smallint,
  room_no smallint,
  advisor_1 text,
  advisor_2 text,
  certificate_no text,
  legacy_full_name text,
  legacy_level text,
  exam_year_be text,
  match_status text,
  matching_basis jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select cm.id, y.year_be, s.student_number, s.full_name,
    c.grade_level, c.room_no, t1.display_name, t2.display_name,
    lc.certificate_no, lc.full_name, lc.level, lc.exam_year_be,
    cm.status, cm.matching_basis
  from certificate_matches cm
  join students s on s.id = cm.student_id and s.status = 'active'
  join classrooms c on c.id = s.classroom_id and c.active
  join academic_years y on y.id = c.academic_year_id and y.year_be = trim(requested_year)
  join legacy_certificates lc on lc.id = cm.legacy_certificate_id
  left join teachers t1 on t1.id = c.advisor_1_id
  left join teachers t2 on t2.id = c.advisor_2_id
  where public.is_staff() and cm.status = 'review'
  order by c.grade_level, c.room_no, s.student_number, lc.level, lc.certificate_no;
$$;

revoke all on function public.certificate_match_review_rows(text) from public;
grant execute on function public.certificate_match_review_rows(text) to authenticated;

create or replace function public.review_certificate_match(
  requested_match_id uuid,
  requested_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  match_row certificate_matches%rowtype;
begin
  if not public.is_staff() then
    raise exception 'STAFF_ROLE_REQUIRED';
  end if;
  if requested_decision not in ('confirmed', 'rejected', 'review') then
    raise exception 'INVALID_MATCH_DECISION';
  end if;

  select * into match_row from certificate_matches where id = requested_match_id for update;
  if match_row.id is null then
    raise exception 'MATCH_NOT_FOUND';
  end if;
  if requested_decision = 'confirmed' and exists (
    select 1 from certificate_matches
    where student_id = match_row.student_id and status = 'confirmed' and id <> match_row.id
  ) then
    raise exception 'STUDENT_ALREADY_HAS_CONFIRMED_MATCH';
  end if;

  update certificate_matches
  set status = requested_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = requested_match_id;

  insert into audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'review_certificate_match', 'certificate_match', requested_match_id,
    jsonb_build_object('decision', requested_decision, 'student_id', match_row.student_id,
      'legacy_certificate_id', match_row.legacy_certificate_id));

  return jsonb_build_object('match_id', requested_match_id, 'decision', requested_decision);
end;
$$;

revoke all on function public.review_certificate_match(uuid, text) from public;
grant execute on function public.review_certificate_match(uuid, text) to authenticated;

comment on function public.certificate_match_review_rows(text) is
  'Staff-only ambiguous legacy match queue. Matching candidates remain review until an explicit decision.';
comment on function public.review_certificate_match(uuid, text) is
  'Audited staff decision for one match. Prevents multiple confirmed certificates for a current student.';
