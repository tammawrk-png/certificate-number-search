import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [legacyHtml, activityHtml, activityJs, config] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../activity.html', import.meta.url), 'utf8'),
  readFile(new URL('../activity.js', import.meta.url), 'utf8'),
  readFile(new URL('../config.js', import.meta.url), 'utf8'),
]);

assert.match(legacyHtml, /firebase-database-compat\.js/);
assert.match(legacyHtml, /app\.js/);
assert.match(activityHtml, /id="registration-form"/);
assert.match(activityHtml, /id="lookup-form"/);
assert.match(activityHtml, /id="registration-state"/);
assert.match(activityJs, /public_dashboard_metrics_v2/);
assert.match(activityJs, /submit_public_registration_v2/);
assert.match(activityJs, /lookup_public_exam_status/);
assert.match(activityJs, /public_registration_window_status/);
assert.doesNotMatch(config, /(?:service[-_ ]role|client_secret|private_key)\s*[:=]/i);
assert.match(config, /publishableKey:\s*null/);

console.log('public surface smoke test passed');
