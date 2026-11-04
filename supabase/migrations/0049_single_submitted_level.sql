-- Keep the single-level activity form from leaving a stale submitted level behind.
create or replace function public.enforce_single_submitted_level()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.exam_status = 'exam' then
    update activity_form_submissions
    set exam_status = 'not_exam', updated_at = now()
    where academic_year_id = new.academic_year_id
      and student_id = new.student_id
      and application_level <> new.application_level
      and exam_status = 'exam';
    update exam_registrations
    set application_status = 'cancelled'
    where academic_year_id = new.academic_year_id
      and student_id = new.student_id
      and dhamma_level <> new.application_level
      and application_status = 'submitted';
  elsif new.exam_status = 'not_exam' or new.special_needs then
    update exam_registrations
    set application_status = 'cancelled'
    where academic_year_id = new.academic_year_id
      and student_id = new.student_id
      and dhamma_level = new.application_level
      and application_status = 'submitted';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_single_submitted_level on activity_form_submissions;
create trigger enforce_single_submitted_level
after insert or update of exam_status, application_level, special_needs
on activity_form_submissions
for each row execute function public.enforce_single_submitted_level();

revoke all on function public.enforce_single_submitted_level() from public;
grant execute on function public.enforce_single_submitted_level() to anon, authenticated, service_role;
