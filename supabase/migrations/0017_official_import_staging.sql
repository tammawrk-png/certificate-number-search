-- Staging and idempotent apply boundary for official announcements.
-- Nothing is visible publicly until it is applied by an active staff member.
create table if not exists public.official_exam_import_staging (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references import_batches(id) on delete cascade,
  record_key text not null unique,
  record_type text not null check (record_type in ('eligibility', 'seat', 'result')),
  academic_year text not null,
  student_number text not null,
  full_name text not null,
  dhamma_level text not null check (dhamma_level in ('ตรี', 'โท', 'เอก')),
  eligibility_status text check (eligibility_status in ('eligible', 'ineligible', 'pending')),
  room_name text,
  building text,
  capacity integer check (capacity is null or capacity > 0),
  seat_no text,
  result_status text check (result_status in ('passed', 'failed', 'absent', 'pending')),
  score text,
  official_reference text,
  source_file_name text not null,
  source_sheet_name text,
  processed_at timestamptz,
  process_status text not null default 'pending' check (process_status in ('pending', 'applied', 'review', 'rejected')),
  process_note text,
  created_at timestamptz not null default now()
);

create index if not exists official_exam_import_staging_batch_idx
  on public.official_exam_import_staging(import_batch_id, process_status);
alter table public.official_exam_import_staging enable row level security;

create or replace function public.apply_official_exam_import_batch(requested_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item record;
  registration_id uuid;
  room_id uuid;
  applied_count integer := 0;
  review_count integer := 0;
  invalid_count integer := 0;
begin
  if not public.is_staff() then
    raise exception 'STAFF_ROLE_REQUIRED';
  end if;

  if not exists (select 1 from import_batches where id = requested_batch_id) then
    raise exception 'IMPORT_BATCH_NOT_FOUND';
  end if;

  for item in
    select * from official_exam_import_staging
    where import_batch_id = requested_batch_id and process_status = 'pending'
    order by id
  loop
    registration_id := null;
    select r.id into registration_id
    from academic_years y
    join exam_registrations r on r.academic_year_id = y.id and r.dhamma_level = item.dhamma_level
    join students s on s.id = r.student_id and s.student_number = trim(item.student_number)
    where y.year_be = trim(item.academic_year)
      and public.dharma_normalize_name(s.full_name) = public.dharma_normalize_name(item.full_name)
      and r.application_status in ('submitted', 'verified')
    limit 1;

    if registration_id is null then
      update official_exam_import_staging
      set process_status = 'review', process_note = 'ไม่พบใบสมัครที่ตรงกับปี เลขนักเรียน ชื่อ และระดับ', processed_at = now()
      where id = item.id;
      review_count := review_count + 1;
      continue;
    end if;

    if item.record_type = 'eligibility' then
      if item.eligibility_status is null then
        update official_exam_import_staging
        set process_status = 'rejected', process_note = 'ไม่มีสถานะสิทธิ์สอบ', processed_at = now()
        where id = item.id;
        invalid_count := invalid_count + 1;
        continue;
      end if;
      insert into exam_eligibility (registration_id, eligibility_status, official_reference, imported_at)
      values (registration_id, item.eligibility_status, item.official_reference, now())
      on conflict (registration_id) do update set
        eligibility_status = excluded.eligibility_status,
        official_reference = excluded.official_reference,
        imported_at = now();
    elsif item.record_type = 'seat' then
      if nullif(trim(item.room_name), '') is null or nullif(trim(item.seat_no), '') is null then
        update official_exam_import_staging
        set process_status = 'rejected', process_note = 'ไม่มีห้องสอบหรือเลขที่สอบ', processed_at = now()
        where id = item.id;
        invalid_count := invalid_count + 1;
        continue;
      end if;
      insert into exam_rooms (academic_year_id, room_name, building, capacity)
      select y.id, trim(item.room_name), item.building, item.capacity
      from academic_years y where y.year_be = trim(item.academic_year)
      on conflict (academic_year_id, room_name) do update set
        building = coalesce(excluded.building, exam_rooms.building),
        capacity = coalesce(excluded.capacity, exam_rooms.capacity);
      select er.id into room_id from exam_rooms er
      join academic_years y on y.id = er.academic_year_id
      where y.year_be = trim(item.academic_year) and er.room_name = trim(item.room_name);
      insert into exam_seats (registration_id, exam_room_id, seat_no, imported_at)
      values (registration_id, room_id, trim(item.seat_no), now())
      on conflict (registration_id) do update set
        exam_room_id = excluded.exam_room_id, seat_no = excluded.seat_no, imported_at = now();
    elsif item.record_type = 'result' then
      if item.result_status is null then
        update official_exam_import_staging
        set process_status = 'rejected', process_note = 'ไม่มีผลสอบ', processed_at = now()
        where id = item.id;
        invalid_count := invalid_count + 1;
        continue;
      end if;
      insert into exam_results (registration_id, result_status, score, official_reference, imported_at)
      values (registration_id, item.result_status, item.score, item.official_reference, now())
      on conflict (registration_id) do update set
        result_status = excluded.result_status, score = excluded.score,
        official_reference = excluded.official_reference, imported_at = now();
    end if;

    update official_exam_import_staging
    set process_status = 'applied', process_note = null, processed_at = now()
    where id = item.id;
    applied_count := applied_count + 1;
  end loop;

  return jsonb_build_object('applied', applied_count, 'review', review_count, 'rejected', invalid_count);
end;
$$;

revoke all on function public.apply_official_exam_import_batch(uuid) from public;
grant execute on function public.apply_official_exam_import_batch(uuid) to authenticated;

comment on table public.official_exam_import_staging is
  'Staff-only staging for official eligibility, seat and result imports; source values are required.';
comment on function public.apply_official_exam_import_batch(uuid) is
  'Idempotent staff-only official import apply. Unmatched records remain review and are never guessed.';
