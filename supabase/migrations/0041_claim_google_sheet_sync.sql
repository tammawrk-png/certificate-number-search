-- Single-flight guard shared by the scheduled worker and the immediate endpoint.
create or replace function public.claim_google_sheet_sync(requested_year text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare year_id uuid;
begin
  if auth.role() <> 'service_role' then return false; end if;
  select id into year_id from public.academic_years where year_be = trim(requested_year) limit 1;
  if year_id is null then return false; end if;
  insert into public.google_sheet_sync_queue(academic_year_id, state, requested_at)
  values (year_id, 'pending', now())
  on conflict (academic_year_id) do nothing;
  update public.google_sheet_sync_queue
  set state = 'running', attempts = attempts + 1, requested_at = now(), last_error = null, completed_at = null
  where academic_year_id = year_id and state <> 'running';
  return found;
end;
$$;
revoke all on function public.claim_google_sheet_sync(text) from public;
grant execute on function public.claim_google_sheet_sync(text) to service_role;
