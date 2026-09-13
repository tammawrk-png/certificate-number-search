-- Enforce the school room boundary at the database as a second line of
-- defence. Lower secondary permits rooms 1-15; upper secondary permits 1-12.
-- Room 16 and beyond are never valid import targets.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'classrooms_active_room_policy'
      and conrelid = 'public.classrooms'::regclass
  ) then
    alter table public.classrooms
      add constraint classrooms_active_room_policy check (
        (education_band = 'lower_secondary' and room_no between 1 and 15)
        or (education_band = 'upper_secondary' and room_no between 1 and 12)
        or (education_band = 'higher_education' and room_no between 1 and 15)
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'roster_staging_room_policy'
      and conrelid = 'public.roster_import_staging'::regclass
  ) then
    alter table public.roster_import_staging
      add constraint roster_staging_room_policy check (
        (education_band = 'lower_secondary' and room_no between 1 and 15)
        or (education_band = 'upper_secondary' and room_no between 1 and 12)
        or (education_band = 'higher_education' and room_no between 1 and 15)
      );
  end if;
end;
$$;

comment on constraint classrooms_active_room_policy on public.classrooms is
  'School import boundary: excludes room 16 and upper-secondary rooms above 12.';
comment on constraint roster_staging_room_policy on public.roster_import_staging is
  'Staging import boundary: excludes room 16 and upper-secondary rooms above 12.';
