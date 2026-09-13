-- Public, non-PII registration window status for the activity page.
create or replace function public.public_registration_window_status(requested_year text)
returns table (
  academic_year text,
  is_open boolean,
  opens_at timestamptz,
  closes_at timestamptz,
  note text
)
language sql
stable
security definer
set search_path = public
as $$
  select y.year_be, w.is_open, w.opens_at, w.closes_at, w.note
  from academic_years y
  left join registration_windows w on w.academic_year_id = y.id
  where y.year_be = trim(requested_year)
  limit 1;
$$;

revoke all on function public.public_registration_window_status(text) from public;
grant execute on function public.public_registration_window_status(text) to anon, authenticated;

comment on function public.public_registration_window_status(text) is
  'Public registration window state only; never returns student or staff data.';
