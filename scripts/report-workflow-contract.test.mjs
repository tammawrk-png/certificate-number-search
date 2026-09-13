import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL('../.github/workflows/build-mother-sangha-report.yml', import.meta.url);
const workflow = await readFile(workflowPath, 'utf8');

test('Mother Sangha report workflow stays manual and one-level-at-a-time', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /on:\s*\n\s*push:/);
  assert.match(workflow, /options:\s*\[ตรี, โท, เอก\]/);
  assert.match(workflow, /--year '\$\{\{ inputs\.year \}\}' --level '\$\{\{ inputs\.level \}\}'/);
});

test('Mother Sangha report workflow protects credentials and validates destinations', () => {
  assert.match(workflow, /GOOGLE_SERVICE_ACCOUNT_JSON:\s*\$\{\{ secrets\.GOOGLE_SERVICE_ACCOUNT_JSON \}\}/);
  assert.match(workflow, /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
  assert.match(workflow, /DRIVE_SOURCE_FOLDER_ID:\s*\$\{\{ vars\.DRIVE_SOURCE_FOLDER_ID \}\}/);
  assert.match(workflow, /DRIVE_OUTPUT_FOLDER_ID:\s*\$\{\{ vars\.DRIVE_OUTPUT_FOLDER_ID \}\}/);
  assert.match(workflow, /name: Preflight protected report inputs/);
  assert.match(workflow, /Source and output Drive folders must differ/);
});
