import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [legacyHtml, activityHtml, activityJs, staffHtml, staffJs, config] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../activity.html', import.meta.url), 'utf8'),
  readFile(new URL('../activity.js', import.meta.url), 'utf8'),
  readFile(new URL('../staff.html', import.meta.url), 'utf8'),
  readFile(new URL('../staff.js', import.meta.url), 'utf8'),
  readFile(new URL('../config.js', import.meta.url), 'utf8'),
]);
const migration11 = await readFile(new URL('../supabase/migrations/0011_refresh_certificate_matches.sql', import.meta.url), 'utf8');
const migration12 = await readFile(new URL('../supabase/migrations/0012_student_progress_guidance.sql', import.meta.url), 'utf8');
const migration15 = await readFile(new URL('../supabase/migrations/0015_staff_report_rows.sql', import.meta.url), 'utf8');
const migration16 = await readFile(new URL('../supabase/migrations/0016_enforce_room_policy.sql', import.meta.url), 'utf8');
const migration19 = await readFile(new URL('../supabase/migrations/0019_public_registration_options.sql', import.meta.url), 'utf8');

assert.match(legacyHtml, /firebase-database-compat\.js/);
assert.match(legacyHtml, /app\.js/);
assert.match(activityHtml, /id="registration-form"/);
assert.match(activityHtml, /id="lookup-form"/);
assert.match(activityHtml, /id="registration-state"/);
assert.match(activityJs, /public_dashboard_metrics_v2/);
assert.match(activityJs, /submit_public_registration_v2/);
assert.match(activityJs, /lookup_public_exam_status/);
assert.match(activityJs, /public_registration_window_status/);
assert.match(activityJs, /public_student_registration_options/);
assert.match(staffHtml, /id="login-form"/);
assert.match(staffHtml, /id="workspace"/);
assert.match(staffJs, /school_report_rows/);
assert.match(staffJs, /mother_sangha_report_rows/);
assert.match(staffJs, /sessionStorage/);
assert.doesNotMatch(migration11, /grant execute on function public\.refresh_certificate_matches\(\) to authenticated/);
assert.match(migration12, /create table if not exists public\.staff_roles/);
assert.match(migration12, /public\.is_staff\(\)/);
assert.doesNotMatch(migration15, /to anon/);
assert.match(migration16, /room_no between 1 and 12/);
assert.match(migration19, /revoke all on function public\.public_student_registration_options/);
assert.match(migration19, /grant execute on function public\.public_student_registration_options.*anon, authenticated/s);
assert.doesNotMatch(config, /(?:service[-_ ]role|client_secret|private_key)\s*[:=]/i);
assert.match(config, /publishableKey\s*:/);

console.log('public surface smoke test passed');
