-- Admin-only control plane for requesting and observing the protected sheet sync.
-- Google credentials remain in the worker environment; this RPC never exposes them.

create or replace function public.request_google_sheet_sync(requested_year text)
returns table (requested boolean, state text, requested_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare year_id uuid;
begin
  if not public.is_staff() then
    raise exception using errcode = '42501', message = 'STAFF_ROLE_REQUIRED';
  end if;
  select id into year_id from public.academic_years where year_be = trim(requested_year) limit 1;
  if year_id is null then
    raise exception using errcode = '22023', message = 'YEAR_NOT_FOUND';
  end if;
  insert into public.google_sheet_sync_queue(academic_year_id, state, requested_at, last_error)
  values (year_id, 'pending', now(), null)
  on conflict (academic_year_id) do update set
    state = 'pending', requested_at = now(), last_error = null;
  return query
    select true, q.state, q.requested_at
    from public.google_sheet_sync_queue q
    where q.academic_year_id = year_id;
end;
$$;
revoke all on function public.request_google_sheet_sync(text) from public;
grant execute on function public.request_google_sheet_sync(text) to authenticated;

create or replace function public.google_sheet_sync_status(requested_year text)
returns table (state text, attempts integer, last_error text, requested_at timestamptz, completed_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select q.state, q.attempts, q.last_error, q.requested_at, q.completed_at
  from public.google_sheet_sync_queue q
  join public.academic_years y on y.id = q.academic_year_id
  where public.is_staff() and y.year_be = trim(requested_year)
  limit 1;
$$;
revoke all on function public.google_sheet_sync_status(text) from public;
grant execute on function public.google_sheet_sync_status(text) to authenticated;
