type SheetSpec = { id: string; tab: string; last: string };

const SHEETS: Record<string, SheetSpec> = {
  'ตรี': { id: '1ezTRI6oafyLPKyGMjOJ7azn96mOp2JXgQYJXHwlThgw', tab: 'sor5', last: 'R' },
  'โท': { id: '1JH4xXdnp5SijlteO_PJ9a24DSqB81_PFZt5C2UuZ_xQ', tab: 'sor6', last: 'U' },
  'เอก': { id: '1XjLq0spLXgMQE2MVVUv7sLiz_6BBUCrNJ6bkIqm4BLU', tab: '1', last: 'U' },
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const googleServiceAccount = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? '';

const base64Url = (value: Uint8Array | string) => {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemToBytes = (pem: string) => {
  const raw = atob(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ''));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

const googleAccessToken = async () => {
  const account = JSON.parse(googleServiceAccount);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey('pkcs8', pemToBytes(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${payload}`)));
  const assertion = `${header}.${payload}.${base64Url(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error('GOOGLE_TOKEN_FAILED');
  return result.access_token as string;
};

const rpc = async (name: string, body: Record<string, unknown>, authorization = `Bearer ${serviceKey}`) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: serviceKey, Authorization: authorization, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.hint || `${name}_FAILED`);
  return data;
};

const sheetValues = (rows: Record<string, unknown>[], level: string) => rows.map((row, index) => {
  const value = (key: string) => row[key] == null ? '' : String(row[key]);
  const values = [String(index + 1), value('title'), value('first_name'), value('last_name'), value('citizen_id'), value('dhamma_level'), value('class_room'), value('birth_date_be'), value('organization_name'), value('organization_subdistrict'), value('organization_district'), value('organization_province'), value('temple_affiliation'), value('temple_subdistrict'), value('temple_district'), value('temple_province'), value('school_council')];
  if (level === 'ตรี') values.push(value('notes'));
  else values.push(value('previous_certificate_year'), value('previous_certificate_no'), value('previous_school_council'), value('notes'));
  return values;
});

const syncSheet = async (token: string, level: string, rows: Record<string, unknown>[]) => {
  const spec = SHEETS[level];
  const root = `https://sheets.googleapis.com/v4/spreadsheets/${spec.id}/values`;
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const range = `'${spec.tab}'!A9:${spec.last}1059`;
  const clear = await fetch(`${root}/${encodeURIComponent(range)}:clear`, { method: 'POST', headers });
  if (!clear.ok) throw new Error(`SHEET_CLEAR_${level}`);
  const values = sheetValues(rows, level);
  if (!values.length) return;
  const updateRange = `'${spec.tab}'!A9:${spec.last}${8 + values.length}`;
  const update = await fetch(`${root}/${encodeURIComponent(updateRange)}?valueInputOption=RAW`, { method: 'PUT', headers, body: JSON.stringify({ range: updateRange, majorDimension: 'ROWS', values }) });
  if (!update.ok) throw new Error(`SHEET_UPDATE_${level}`);
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!supabaseUrl || !serviceKey || !googleServiceAccount) return Response.json({ error: 'SYNC_SERVER_NOT_CONFIGURED' }, { status: 503 });
  const authorization = request.headers.get('authorization') ?? '';
  if (!authorization.startsWith('Bearer ')) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  try {
    const allowed = await rpc('is_staff', {}, authorization);
    if (allowed !== true) return Response.json({ error: 'STAFF_ROLE_REQUIRED' }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const year = String(body.requested_year || '2569');
    const claimed = await rpc('claim_google_sheet_sync', { requested_year: year });
    if (claimed !== true) return Response.json({ error: 'SYNC_ALREADY_RUNNING' }, { status: 409 });
    const token = await googleAccessToken();
    const counts: Record<string, number> = {};
    for (const level of Object.keys(SHEETS)) {
      const rows = await rpc('mother_sangha_form_rows_worker_v1', { requested_year: year, requested_level: level });
      if (!Array.isArray(rows)) throw new Error(`ROWS_FAILED_${level}`);
      await syncSheet(token, level, rows);
      counts[level] = rows.length;
    }
    await rpc('mark_google_sheet_sync', { requested_year: year, requested_state: 'complete', requested_error: null });
    return Response.json({ status: 'synced', year, counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SYNC_FAILED';
    try { await rpc('mark_google_sheet_sync', { requested_year: '2569', requested_state: 'failed', requested_error: message.slice(0, 1000) }); } catch { /* preserve original error */ }
    return Response.json({ error: message }, { status: 500 });
  }
});
