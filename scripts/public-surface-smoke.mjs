import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [legacyHtml, activityHtml, activityJs, staffHtml, staffJs, config, activityCss, staffCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../activity.html', import.meta.url), 'utf8'),
  readFile(new URL('../activity.js', import.meta.url), 'utf8'),
  readFile(new URL('../staff.html', import.meta.url), 'utf8'),
  readFile(new URL('../staff.js', import.meta.url), 'utf8'),
  readFile(new URL('../config.js', import.meta.url), 'utf8'),
  readFile(new URL('../activity.css', import.meta.url), 'utf8'),
  readFile(new URL('../staff.css', import.meta.url), 'utf8'),
]);
const configBuilder = await readFile(new URL('../scripts/prepare-public-config.mjs', import.meta.url), 'utf8');
const deployWorkflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const migration11 = await readFile(new URL('../supabase/migrations/0011_refresh_certificate_matches.sql', import.meta.url), 'utf8');
const migration12 = await readFile(new URL('../supabase/migrations/0012_student_progress_guidance.sql', import.meta.url), 'utf8');
const migration15 = await readFile(new URL('../supabase/migrations/0015_staff_report_rows.sql', import.meta.url), 'utf8');
const migration16 = await readFile(new URL('../supabase/migrations/0016_enforce_room_policy.sql', import.meta.url), 'utf8');
const migration19 = await readFile(new URL('../supabase/migrations/0019_public_registration_options.sql', import.meta.url), 'utf8');
const migration24 = await readFile(new URL('../supabase/migrations/0024_registration_progression_guard.sql', import.meta.url), 'utf8');

assert.match(legacyHtml, /firebase-database-compat\.js/);
assert.match(legacyHtml, /app\.js/);
assert.match(activityHtml, /id="registration-form"/);
assert.match(activityHtml, /id="lookup-form"/);
assert.match(activityHtml, /id="registration-state"/);
assert.match(activityHtml, /data-brand="dharma"/);
assert.match(activityHtml, /data-brand="school"/);
assert.match(activityJs, /public_dashboard_metrics_v2/);
assert.match(activityJs, /submit_public_registration_v2/);
assert.match(activityJs, /lookup_public_exam_status/);
assert.match(activityJs, /public_registration_window_status/);
assert.match(activityJs, /public_student_lookup_options/);
assert.match(activityJs, /public_student_identity/);
assert.match(activityJs, /public_update_student_self/);
assert.match(activityJs, /public_student_registration_status/);
assert.match(activityJs, /public_student_certificate_alerts/);
assert.doesNotMatch(activityHtml, /แก้ทะเบียนให้ทันที/);
assert.match(activityHtml, /บันทึกข้อมูลของฉัน/);
assert.match(activityHtml, /ประวัติใบประกาศเดิม/);
assert.match(activityCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(activityCss, /min-height: 52px; height: 52px/);
assert.match(staffCss, /min-height:?\s*46px/);
assert.match(staffHtml, /id="login-form"/);
assert.match(staffHtml, /id="workspace"/);
assert.match(staffHtml, /data-brand="dharma"/);
assert.match(staffHtml, /data-brand="school"/);
assert.match(staffHtml, /id="google-login"/);
assert.match(staffJs, /school_report_rows/);
assert.match(staffJs, /mother_sangha_form_rows/);
assert.match(staffJs, /mother_sangha_form_rows_v2/);
assert.match(staffJs, /certificate_match_review_rows/);
assert.match(staffJs, /review_certificate_match/);
assert.match(staffJs, /student_correction_review_rows/);
assert.match(staffJs, /review_student_correction/);
assert.match(staffJs, /certificate_pickup_report_rows/);
assert.match(staffJs, /certificate_pickup_report_rows_v2/);
assert.match(staffJs, /update_certificate_pickup_status/);
assert.match(staffJs, /reportColumns/);
assert.match(staffJs, /เลขประจำตัวนักเรียน/);
assert.match(staffJs, /downloadCsv\([^;]+button\.dataset\.report/);
assert.match(staffJs, /sessionStorage/);
assert.match(staffJs, /provider=google/);
assert.match(staffJs, /@wrk\.ac\.th/);
assert.doesNotMatch(migration11, /grant execute on function public\.refresh_certificate_matches\(\) to authenticated/);
assert.match(migration12, /create table if not exists public\.staff_roles/);
assert.match(migration12, /public\.is_staff\(\)/);
assert.doesNotMatch(migration15, /to anon/);
assert.match(migration16, /room_no between 1 and 12/);
assert.match(migration19, /revoke all on function public\.public_student_registration_options/);
assert.match(migration19, /grant execute on function public\.public_student_registration_options.*anon, authenticated/s);
assert.match(migration24, /PREREQUISITE_NOT_MET/);
assert.match(migration24, /cm\.status in \('auto_matched', 'confirmed'\)/);
assert.doesNotMatch(config, /(?:service[-_ ]role|client_secret|private_key)\s*[:=]/i);
assert.match(config, /publishableKey\s*:/);
assert.match(configBuilder, /SUPABASE_PUBLISHABLE_KEY/);
assert.match(configBuilder, /Refusing a secret-looking Supabase key/);
assert.match(deployWorkflow, /Verify Supabase live API when configured/);
assert.match(deployWorkflow, /node scripts\/supabase-live-smoke\.mjs/);
assert.match(deployWorkflow, /Supabase live smoke skipped/);

console.log('public surface smoke test passed');
