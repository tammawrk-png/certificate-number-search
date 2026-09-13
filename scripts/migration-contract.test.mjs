import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = new URL('../supabase/migrations/', import.meta.url);
const rootPath = fileURLToPath(root);
const names = (await readdir(rootPath)).filter((name) => name.endsWith('.sql')).sort();
const expected = ['0001', '0002', '0003', '0004', '0006', '0007', '0008', '0009', '0010', '0011', '0012', '0013', '0014', '0015', '0016', '0017', '0018', '0019', '0020', '0021', '0022', '0023', '0024', '0025', '0026', '0027', '0028', '0029'];
assert.deepEqual(names.map((name) => name.slice(0, 4)), expected);

const [m11, m12, m15, m17, m18, m19, m20, m21, m22, m23, m24, m25, m26, m27, m28, m29] = await Promise.all([
  readFile(join(rootPath, '0011_refresh_certificate_matches.sql'), 'utf8'),
  readFile(join(rootPath, '0012_student_progress_guidance.sql'), 'utf8'),
  readFile(join(rootPath, '0015_staff_report_rows.sql'), 'utf8'),
  readFile(join(rootPath, '0017_official_import_staging.sql'), 'utf8'),
  readFile(join(rootPath, '0018_staff_rls_policies.sql'), 'utf8'),
  readFile(join(rootPath, '0019_public_registration_options.sql'), 'utf8'),
  readFile(join(rootPath, '0020_staff_match_review.sql'), 'utf8'),
  readFile(join(rootPath, '0021_identity_lookup_and_correction.sql'), 'utf8'),
  readFile(join(rootPath, '0022_certificate_pickup_tracking.sql'), 'utf8'),
  readFile(join(rootPath, '0023_certificate_pickup_actions.sql'), 'utf8'),
  readFile(join(rootPath, '0024_registration_progression_guard.sql'), 'utf8'),
  readFile(join(rootPath, '0025_public_identity_self_update.sql'), 'utf8'),
  readFile(join(rootPath, '0026_public_registration_status.sql'), 'utf8'),
  readFile(join(rootPath, '0027_mother_sangha_form_rows.sql'), 'utf8'),
  readFile(join(rootPath, '0028_mother_sangha_previous_certificate_fields.sql'), 'utf8'),
  readFile(join(rootPath, '0029_mother_sangha_complete_form_fields.sql'), 'utf8'),
]);
assert.doesNotMatch(m11, /grant execute on function public\.refresh_certificate_matches\(\) to authenticated/);
assert.match(m12, /staff_roles/);
assert.match(m12, /STAFF_ROLE_REQUIRED/);
assert.doesNotMatch(m15, /grant execute[^;]+to anon/i);
assert.match(m15, /create or replace function public\.school_report_rows[\s\S]*?where public\.is_staff\(\)/);
assert.match(m15, /create or replace function public\.mother_sangha_report_rows[\s\S]*?where public\.is_staff\(\)/);
assert.match(m17, /apply_official_exam_import_batch/);
assert.doesNotMatch(m17, /grant execute[^;]+to anon/i);
assert.match(m18, /create policy staff_roster_staging_all/);
assert.match(m18, /public\.is_staff\(\)/);
assert.match(m19, /public_student_registration_options/);
assert.match(m19, /grant execute on function public\.public_student_registration_options.*anon, authenticated/s);
assert.match(m20, /review_certificate_match/);
assert.match(m20, /audit_logs/);
assert.doesNotMatch(m20, /grant execute[^;]+to anon/i);
assert.match(m21, /public_student_lookup_options/);
assert.match(m21, /student_correction_requests/);
assert.match(m21, /review_student_correction/);
assert.match(m21, /grant execute on function public\.public_submit_student_correction.*anon, authenticated/s);
assert.doesNotMatch(m21, /grant execute on function public\.review_student_correction[^;]+to anon/i);
assert.match(m22, /public_student_certificate_alerts/);
assert.match(m22, /certificate_pickup_report_rows/);
assert.match(m22, /pickup_status/);
assert.doesNotMatch(m22, /grant execute on function public\.certificate_pickup_report_rows[^;]+to anon/i);
assert.match(m23, /update_certificate_pickup_status/);
assert.match(m23, /certificate_pickup_report_rows_v2/);
assert.doesNotMatch(m23, /grant execute on function public\.update_certificate_pickup_status[^;]+to anon/i);
assert.match(m24, /rename to submit_public_registration_v1/);
assert.match(m24, /PREREQUISITE_NOT_MET/);
assert.match(m24, /cm\.status in \('auto_matched', 'confirmed'\)/);
assert.match(m24, /grant execute on function public\.submit_public_registration\(text, text, text, text, text\) to anon, authenticated/);
assert.doesNotMatch(m24, /grant execute on function public\.submit_public_registration_v1[^;]+to anon/i);
assert.match(m25, /add column if not exists citizen_id/);
assert.match(m25, /public_student_identity/);
assert.match(m25, /public_update_student_self/);
assert.match(m26, /public_student_registration_status/);
assert.match(m27, /mother_sangha_form_rows/);
assert.match(m27, /citizen_id/);
assert.match(m27, /birth_date_be/);
assert.doesNotMatch(m27, /to anon/i);
assert.match(m28, /mother_sangha_form_rows_v2/);
assert.match(m28, /previous_certificate_no/);
assert.match(m29, /mother_sangha_form_rows_v3/);
assert.match(m29, /temple_subdistrict/);
assert.match(m29, /previous_certificate_no/);

console.log('migration contract test passed');
