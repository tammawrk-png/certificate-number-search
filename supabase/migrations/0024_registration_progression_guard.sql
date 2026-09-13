-- Enforce the Dharma progression server-side: ตรี -> โท -> เอก.
-- The public form may offer all levels, but a submission above ตรี needs
-- historical evidence already matched to the current student. Firebase is
-- never written here; only Supabase's reviewed import is consulted.

alter function public.submit_public_registration(text, text, text, text, text)
  rename to submit_public_registration_v1;

revoke all on function public.submit_public_registration_v1(text, text, text, text, text) from public;

create or replace function public.submit_public_registration(
  requested_year text,
  requested_student_number text,
  requested_full_name text,
  requested_band text,
  requested_level text
)
returns table (accepted boolean, result_code text, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_student_id uuid;
  has_prerequisite boolean := false;
begin
  select s.id into matched_student_id
  from students s
  join classrooms c on c.id = s.classroom_id
    and c.active
  join academic_years y on y.id = c.academic_year_id
    and y.year_be = trim(requested_year)
  where s.student_number = trim(requested_student_number)
    and s.status = 'active'
    and public.dharma_normalize_name(s.full_name) = public.dharma_normalize_name(requested_full_name)
  limit 1;

  if matched_student_id is not null and requested_level in ('โท', 'เอก') then
    select exists (
      select 1
      from certificate_matches cm
      join legacy_certificates lc on lc.id = cm.legacy_certificate_id
      where cm.student_id = matched_student_id
        and cm.status in ('auto_matched', 'confirmed')
        and (
          (requested_level = 'โท' and lc.level in ('ตรี', 'โท', 'เอก'))
          or (requested_level = 'เอก' and lc.level in ('โท', 'เอก'))
        )
    ) into has_prerequisite;

    if not has_prerequisite then
      return query select false, 'PREREQUISITE_NOT_MET',
        case requested_level
          when 'โท' then 'ยังไม่พบหลักฐานว่าผ่านชั้นตรี จึงยังสมัครชั้นโทไม่ได้'
          else 'ยังไม่พบหลักฐานว่าผ่านชั้นโท จึงยังสมัครชั้นเอกไม่ได้'
        end;
      return;
    end if;
  end if;

  return query select * from public.submit_public_registration_v1(
    requested_year, requested_student_number, requested_full_name,
    requested_band, requested_level
  );
end;
$$;

revoke all on function public.submit_public_registration(text, text, text, text, text) from public;
grant execute on function public.submit_public_registration(text, text, text, text, text) to anon, authenticated;

comment on function public.submit_public_registration(text, text, text, text, text) is
  'Validated public registration boundary with server-side ตรี/โท/เอก progression guard.';
