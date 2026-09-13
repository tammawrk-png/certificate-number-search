-- RLS policies for authenticated staff workflows. Anonymous users receive no
-- direct table access; public clients use only the aggregate/status RPCs.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'staff_roles' and policyname = 'staff_roles_self_read') then
    create policy staff_roles_self_read on public.staff_roles
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_import_staging' and policyname = 'staff_roster_staging_all') then
    create policy staff_roster_staging_all on public.roster_import_staging
      for all to authenticated using (public.is_staff()) with check (public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'official_exam_import_staging' and policyname = 'staff_official_staging_all') then
    create policy staff_official_staging_all on public.official_exam_import_staging
      for all to authenticated using (public.is_staff()) with check (public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_batches' and policyname = 'staff_import_batches_all') then
    create policy staff_import_batches_all on public.import_batches
      for all to authenticated using (public.is_staff()) with check (public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'certificate_matches' and policyname = 'staff_certificate_matches_all') then
    create policy staff_certificate_matches_all on public.certificate_matches
      for all to authenticated using (public.is_staff()) with check (public.is_staff());
  end if;
end;
$$;

comment on policy staff_roster_staging_all on public.roster_import_staging is
  'Only authenticated users with an active staff role can manage roster staging data.';
comment on policy staff_official_staging_all on public.official_exam_import_staging is
  'Only authenticated users with an active staff role can manage official import staging data.';
