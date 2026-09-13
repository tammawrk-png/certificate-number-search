-- Identity-first public flow. A student number resolves one current roster
-- record; public users may request a correction, but never edit the roster.
create table if not exists public.student_correction_requests (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  current_full_name text not null,
  proposed_title text,
  proposed_first_name text not null,
  proposed_last_name text not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'under_review', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text
);
create index if not exists student_correction_requests_queue_idx
  on public.student_correction_requests(academic_year_id, status, submitted_at);
create unique index if not exists student_correction_requests_open_student_idx
  on public.student_correction_requests(academic_year_id, student_id)
  where status in ('pending', 'under_review');
alter table public.student_correction_requests enable row level security;

create or replace function public.public_student_lookup_options(
  requested_year text,
  requested_student_number text
)
returns table (
  verified boolean,
  student_number text,
  full_name text,
  title text,
  first_name text,
  last_name text,
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
    select s.id, s.student_number, s.full_name, s.title, s.first_name, s.last_name,
      c.education_band, c.grade_level, c.room_no,
      t1.display_name as advisor_1, t2.display_name as advisor_2
    from students s
    join classrooms c on c.id = s.classroom_id and c.active
    join academic_years y on y.id = c.academic_year_id
    left join teachers t1 on t1.id = c.advisor_1_id
    left join teachers t2 on t2.id = c.advisor_2_id
    where y.year_be = trim(requested_year) and s.status = 'active'
      and s.student_number = trim(requested_student_number)
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
  select true, cs.student_number, cs.full_name, cs.title, cs.first_name, cs.last_name,
    cs.education_band, cs.grade_level, cs.room_no, cs.advisor_1, cs.advisor_2,
    coalesce(h.matched_count, 0), coalesce(h.review_count, 0),
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

revoke all on function public.public_student_lookup_options(text, text) from public;
grant execute on function public.public_student_lookup_options(text, text) to anon, authenticated;

create or replace function public.public_submit_student_correction(
  requested_year text,
  requested_student_number text,
  requested_title text,
  requested_first_name text,
  requested_last_name text,
  requested_reason text default null
)
returns table (accepted boolean, result_code text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  year_id uuid;
  student_row students%rowtype;
begin
  select id into year_id from academic_years where year_be = trim(requested_year) limit 1;
  select s.* into student_row
  from students s join classrooms c on c.id = s.classroom_id and c.active
    and c.academic_year_id = year_id
  where s.student_number = trim(requested_student_number) and s.status = 'active' limit 1;
  if year_id is null or student_row.id is null then
    return query select false, 'STUDENT_NOT_FOUND', 'ไม่พบเลขประจำตัวในทะเบียนปีการศึกษานี้'; return;
  end if;
  if nullif(trim(requested_first_name), '') is null or nullif(trim(requested_last_name), '') is null then
    return query select false, 'NAME_REQUIRED', 'กรุณากรอกชื่อและนามสกุลที่ต้องการแก้ไข'; return;
  end if;
  if exists (select 1 from student_correction_requests
    where academic_year_id = year_id and student_id = student_row.id
      and status in ('pending', 'under_review')) then
    return query select false, 'CORRECTION_ALREADY_PENDING', 'มีคำขอแก้ไขข้อมูลอยู่ระหว่างการตรวจสอบแล้ว'; return;
  end if;
  insert into student_correction_requests(
    academic_year_id, student_id, current_full_name, proposed_title,
    proposed_first_name, proposed_last_name, reason
  ) values (
    year_id, student_row.id, student_row.full_name, nullif(trim(requested_title), ''),
    trim(requested_first_name), trim(requested_last_name), nullif(trim(requested_reason), '')
  );
  return query select true, 'CORRECTION_SUBMITTED', 'ส่งคำขอแก้ไขข้อมูลแล้ว เจ้าหน้าที่จะตรวจสอบก่อนปรับทะเบียน';
end;
$$;

revoke all on function public.public_submit_student_correction(text, text, text, text, text, text) from public;
grant execute on function public.public_submit_student_correction(text, text, text, text, text, text) to anon, authenticated;

create or replace function public.student_correction_review_rows(requested_year text)
returns table (
  correction_id uuid,
  academic_year text,
  student_number text,
  current_full_name text,
  proposed_title text,
  proposed_first_name text,
  proposed_last_name text,
  reason text,
  status text,
  submitted_at timestamptz,
  grade_level smallint,
  room_no smallint
)
language sql
stable
security definer
set search_path = public
as $$
  select cr.id, y.year_be, s.student_number, cr.current_full_name,
    cr.proposed_title, cr.proposed_first_name, cr.proposed_last_name, cr.reason,
    cr.status, cr.submitted_at, c.grade_level, c.room_no
  from student_correction_requests cr
  join academic_years y on y.id = cr.academic_year_id and y.year_be = trim(requested_year)
  join students s on s.id = cr.student_id
  join classrooms c on c.id = s.classroom_id and c.active
  where public.is_staff() and cr.status in ('pending', 'under_review')
  order by cr.submitted_at, c.grade_level, c.room_no, s.student_number;
$$;

revoke all on function public.student_correction_review_rows(text) from public;
grant execute on function public.student_correction_review_rows(text) to authenticated;

create or replace function public.review_student_correction(
  requested_correction_id uuid,
  requested_decision text,
  requested_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  correction_row student_correction_requests%rowtype;
  new_full_name text;
begin
  if not public.is_staff() then raise exception 'STAFF_ROLE_REQUIRED'; end if;
  if requested_decision not in ('approved', 'rejected') then raise exception 'INVALID_CORRECTION_DECISION'; end if;
  select * into correction_row from student_correction_requests
    where id = requested_correction_id for update;
  if correction_row.id is null then raise exception 'CORRECTION_NOT_FOUND'; end if;
  if correction_row.status not in ('pending', 'under_review') then raise exception 'CORRECTION_ALREADY_RESOLVED'; end if;

  if requested_decision = 'approved' then
    new_full_name := concat_ws(' ', nullif(trim(correction_row.proposed_title), ''),
      trim(correction_row.proposed_first_name), trim(correction_row.proposed_last_name));
    update students set title = nullif(trim(correction_row.proposed_title), ''),
      first_name = trim(correction_row.proposed_first_name), last_name = trim(correction_row.proposed_last_name),
      full_name = new_full_name, normalized_name = public.dharma_normalize_name(new_full_name), updated_at = now()
    where id = correction_row.student_id;
    update certificate_matches set status = 'review', reviewed_by = null, reviewed_at = null,
      matching_basis = matching_basis || jsonb_build_object('needs_recheck', true, 'reason', 'student_name_corrected')
    where student_id = correction_row.student_id;
  end if;
  update student_correction_requests set status = requested_decision, reviewed_by = auth.uid(),
    reviewed_at = now(), review_note = nullif(trim(requested_note), '') where id = correction_row.id;
  insert into audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'review_student_correction', 'student_correction_request', correction_row.id,
    jsonb_build_object('decision', requested_decision, 'student_id', correction_row.student_id));
  return jsonb_build_object('correction_id', correction_row.id, 'decision', requested_decision);
end;
$$;

revoke all on function public.review_student_correction(uuid, text, text) from public;
grant execute on function public.review_student_correction(uuid, text, text) to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'student_correction_requests' and policyname = 'staff_student_corrections_all') then
    create policy staff_student_corrections_all on public.student_correction_requests
      for all to authenticated using (public.is_staff()) with check (public.is_staff());
  end if;
end;
$$;

comment on table public.student_correction_requests is
  'Public correction requests are pending until staff review; the public flow never edits current roster directly.';
