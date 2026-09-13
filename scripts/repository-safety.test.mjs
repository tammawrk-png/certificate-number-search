import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const { stdout } = await run('git', ['ls-files', '-z']);
const tracked = stdout.split('\0').filter(Boolean);
const forbiddenNames = /(?:firebase-import|firebase-snapshot|service-account|credentials|private-key|roster-staging|match-review)\.(?:json|csv|xlsx?|sql)$/i;
assert.equal(tracked.some((name) => forbiddenNames.test(name)), false, 'raw PII/import or credential artifact is tracked');

const textFiles = tracked.filter((name) => !/\.(?:png|jpe?g|gif|ico|xls[xm]?|pdf|woff2?)$/i.test(name));
const secretLookingPattern = new RegExp(
  ['SUPABASE', 'SERVICE', 'ROLE'].join('_') + '|service[_ -]?role\\s*[:=]|client' + '_secret\\s*[:=]',
  'i',
);
for (const name of textFiles) {
  if (name === 'scripts/repository-safety.test.mjs') continue;
  const { stdout: rawContent } = await run('git', ['show', `HEAD:${name}`]);
  const content = rawContent
    // GitHub Actions secret/variable handles are safe references, not values.
    .replace(/\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}/g, 'GITHUB_SECRET_REFERENCE')
    .replace(/\$\{\{\s*vars\.[A-Z0-9_]+\s*\}\}/g, 'GITHUB_VARIABLE_REFERENCE')
    .replace(/SUPABASE_SERVICE_ROLE_KEY/g, 'RUNTIME_SECRET_HANDLE');
  assert.doesNotMatch(content, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, `private key found in ${name}`);
  assert.doesNotMatch(content, secretLookingPattern, `secret-looking value found in ${name}`);
}

assert.ok(tracked.includes('config.js'), 'public config must remain tracked for static hosting');
assert.ok(tracked.includes('scripts/prepare-public-config.mjs'), 'deploy config injection must remain tracked');
console.log(`repository safety test passed (${tracked.length} tracked files)`);
