/*
 * Live, non-PII smoke test for the Dharma education Supabase project.
 *
 * Required environment:
 *   SUPABASE_URL
 *   SUPABASE_PUBLISHABLE_KEY
 *
 * This deliberately calls only public RPCs with sentinel values. It never
 * prints the key or response bodies, and it never writes to Supabase.
 */

const apiBase = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!apiBase || !publishableKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}
if (/service[_ -]?role|private[_ -]?key|secret/i.test(publishableKey)) {
  console.error('Refusing a secret-looking key');
  process.exit(2);
}

const headers = {
  apikey: publishableKey,
  Authorization: `Bearer ${publishableKey}`,
  'Content-Type': 'application/json',
};

const calls = [
  ['public_dashboard_metrics_v2', {}],
  ['public_registration_window_status', { requested_year: '2569' }],
  ['public_student_lookup_options', { requested_year: '2569', requested_student_number: '__smoke_no_match__' }],
  ['lookup_public_exam_status', { requested_year: '2569', requested_query: '__smoke_no_match__' }],
];

for (const [name, body] of calls) {
  const response = await fetch(`${apiBase}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    console.error(`${name}: HTTP ${response.status}`);
    process.exit(1);
  }
  await response.arrayBuffer();
  console.log(`${name}: ok`);
}

console.log('Supabase live smoke test passed without writing data');
