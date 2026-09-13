import { readFile, writeFile } from 'node:fs/promises';

const path = process.argv[2] || 'config.js';
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
if (key && /service[_ -]?role|private[_ -]?key|secret/i.test(key)) {
  throw new Error('Refusing a secret-looking Supabase key in public configuration');
}

const source = await readFile(path, 'utf8');
const replacement = key ? `publishableKey: ${JSON.stringify(key)}` : 'publishableKey: null';
const output = source.replace(/publishableKey:\s*(?:null|"[^"]*")/, replacement);
if (output === source && !source.includes('publishableKey:')) {
  throw new Error('publishableKey field was not found in public configuration');
}
await writeFile(path, output, 'utf8');
