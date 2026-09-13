import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = new URL('../supabase/migrations/', import.meta.url);
const rootPath = fileURLToPath(root);
const names = (await readdir(rootPath)).filter((name) => name.endsWith('.sql')).sort();
const expected = ['0001', '0002', '0003', '0004', '0006', '0007', '0008', '0009', '0010', '0011', '0012', '0013', '0014', '0015', '0016', '0017', '0018', '0019', '0020'];
assert.deepEqual(names.map((name) => name.slice(0, 4)), expected);

const [m11, m12, m15, m17, m18, m19, m20] = await Promise.all([
  readFile(join(rootPath, '0011_refresh_certificate_matches.sql'), 'utf8'),
  readFile(join(rootPath, '0012_student_progress_guidance.sql'), 'utf8'),
  readFile(join(rootPath, '0015_staff_report_rows.sql'), 'utf8'),
  readFile(join(rootPath, '0017_official_import_staging.sql'), 'utf8'),
  readFile(join(rootPath, '0018_staff_rls_policies.sql'), 'utf8'),
  readFile(join(rootPath, '0019_public_registration_options.sql'), 'utf8'),
  readFile(join(rootPath, '0020_staff_match_review.sql'), 'utf8'),
]);
assert.doesNotMatch(m11, /grant execute on function public\.refresh_certificate_matches\(\) to authenticated/);
assert.match(m12, /staff_roles/);
assert.match(m12, /STAFF_ROLE_REQUIRED/);
assert.doesNotMatch(m15, /grant execute[^;]+to anon/i);
assert.match(m17, /apply_official_exam_import_batch/);
assert.doesNotMatch(m17, /grant execute[^;]+to anon/i);
assert.match(m18, /create policy staff_roster_staging_all/);
assert.match(m18, /public\.is_staff\(\)/);
assert.match(m19, /public_student_registration_options/);
assert.match(m19, /grant execute on function public\.public_student_registration_options.*anon, authenticated/s);
assert.match(m20, /review_certificate_match/);
assert.match(m20, /audit_logs/);
assert.doesNotMatch(m20, /grant execute[^;]+to anon/i);

console.log('migration contract test passed');
