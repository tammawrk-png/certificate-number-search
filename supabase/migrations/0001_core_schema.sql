-- Dharma education exam system. Firebase remains a read-only legacy source.
create extension if not exists pgcrypto;

create table if not exists academic_years (
  id uuid primary key default gen_random_uuid(), year_be text not null unique,
  is_current boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists teachers (
  id uuid primary key default gen_random_uuid(), display_name text not null,
  normalized_name text not null, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists classrooms (
  id uuid primary key default gen_random_uuid(), academic_year_id uuid not null references academic_years(id),
  education_band text not null check (education_band in ('lower_secondary','upper_secondary','higher_education')),
  grade_level smallint check (grade_level between 1 and 6), room_no smallint not null check (room_no between 1 and 99),
  advisor_1_id uuid references teachers(id), advisor_2_id uuid references teachers(id),
  source_file_name text, source_sheet_name text, active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (academic_year_id, education_band, grade_level, room_no)
);
create table if not exists students (
  id uuid primary key default gen_random_uuid(), student_number text unique, title text,
  first_name text not null, last_name text not null, full_name text not null, normalized_name text not null,
  birth_date date, classroom_id uuid references classrooms(id),
  status text not null default 'active' check (status in ('active','left','graduated','unknown')),
  source_file_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists students_normalized_name_idx on students(normalized_name);
create table if not exists legacy_certificates (
  id uuid primary key default gen_random_uuid(), firebase_key text not null unique,
  certificate_no text, first_name text, last_name text, full_name text not null, normalized_name text not null,
  education_band text check (education_band in ('secondary','higher_education')),
  level text not null check (level in ('ตรี','โท','เอก')), exam_year_be text,
  source_database text not null default 'firebase', source_payload jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);
create index if not exists legacy_certificates_name_idx on legacy_certificates(normalized_name);
create table if not exists certificate_matches (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references students(id) on delete cascade,
  legacy_certificate_id uuid not null references legacy_certificates(id) on delete cascade,
  status text not null default 'review' check (status in ('auto_matched','review','confirmed','rejected','unmatched')),
  confidence numeric(5,4) check (confidence >= 0 and confidence <= 1), matching_basis jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
  unique (student_id, legacy_certificate_id)
);
create table if not exists exam_registrations (
  id uuid primary key default gen_random_uuid(), academic_year_id uuid not null references academic_years(id),
  student_id uuid not null references students(id),
  education_band text not null check (education_band in ('lower_secondary','upper_secondary','higher_education')),
  dhamma_level text not null check (dhamma_level in ('ตรี','โท','เอก')),
  application_status text not null default 'submitted' check (application_status in ('draft','submitted','verified','cancelled')),
  submitted_at timestamptz, verified_at timestamptz, created_at timestamptz not null default now(),
  unique (academic_year_id, student_id, education_band, dhamma_level)
);
create table if not exists exam_eligibility (
  id uuid primary key default gen_random_uuid(), registration_id uuid not null unique references exam_registrations(id) on delete cascade,
  eligibility_status text not null check (eligibility_status in ('eligible','ineligible','pending')),
  official_reference text, imported_at timestamptz not null default now()
);
create table if not exists exam_rooms (
  id uuid primary key default gen_random_uuid(), academic_year_id uuid not null references academic_years(id),
  room_name text not null, building text, capacity integer check (capacity > 0), created_at timestamptz not null default now(),
  unique (academic_year_id, room_name)
);
create table if not exists exam_seats (
  id uuid primary key default gen_random_uuid(), registration_id uuid not null unique references exam_registrations(id) on delete cascade,
  exam_room_id uuid not null references exam_rooms(id), seat_no text not null, imported_at timestamptz not null default now(),
  unique (exam_room_id, seat_no)
);
create table if not exists exam_results (
  id uuid primary key default gen_random_uuid(), registration_id uuid not null unique references exam_registrations(id) on delete cascade,
  result_status text not null check (result_status in ('passed','failed','absent','pending')),
  score text, official_reference text, imported_at timestamptz not null default now()
);
create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('firebase','student_roster','official_eligibility','official_seat','official_result','google_sheet')),
  source_name text not null, source_version text, row_count integer not null default 0,
  imported_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), action text not null,
  entity_type text not null, entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

alter table academic_years enable row level security;
alter table teachers enable row level security;
alter table classrooms enable row level security;
alter table students enable row level security;
alter table legacy_certificates enable row level security;
alter table certificate_matches enable row level security;
alter table exam_registrations enable row level security;
alter table exam_eligibility enable row level security;
alter table exam_rooms enable row level security;
alter table exam_seats enable row level security;
alter table exam_results enable row level security;
alter table import_batches enable row level security;
alter table audit_logs enable row level security;

comment on table legacy_certificates is 'Read-only historical data imported from the existing Firebase certificate system.';
comment on table certificate_matches is 'Human-reviewable links between current students and historical certificate records.';
comment on table exam_eligibility is 'Imported only after the official eligibility announcement is available.';
