-- PII staging layer for authenticated roster imports. Main tables are populated
-- from this table by a reviewed SQL transaction, never by guessed UUIDs in CSV.
create table if not exists roster_import_staging (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  student_number text not null,
  first_name text not null,
  last_name text not null,
  full_name text not null,
  grade_level smallint not null check (grade_level between 1 and 6),
  education_band text not null check (education_band in ('lower_secondary','upper_secondary','higher_education')),
  room_no smallint not null check (room_no between 1 and 15),
  advisor_text text,
  source_file_name text not null,
  source_sheet_name text not null,
  created_at timestamptz not null default now(),
  unique (academic_year, student_number)
);
create index if not exists roster_import_staging_classroom_idx
  on roster_import_staging(academic_year, education_band, grade_level, room_no);
alter table roster_import_staging enable row level security;
comment on table roster_import_staging is
  'Authenticated import staging for school rosters; not exposed to anonymous users.';
