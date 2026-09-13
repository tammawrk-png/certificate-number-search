(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.APP_CONFIG?.supabase;
  const apiBase = config?.url?.replace(/\/$/, '');
  let accessToken = sessionStorage.getItem('dharma_staff_access_token') || '';
  let loadedReports = { school: [], ตรี: [], โท: [], เอก: [] };
  const headers = () => ({ apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' });
  const setMessage = (text) => { $('#login-message').textContent = text; $('#report-message').textContent = text; };
  const showWorkspace = (visible) => { $('#login-panel').hidden = visible; $('#workspace').hidden = !visible; };
  const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const downloadCsv = (name, rows) => {
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const csv = [columns, ...rows.map((row) => columns.map((column) => row[column]))].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
  };
  const renderTable = (rows, title) => {
    const head = $('#report-head'); const body = $('#report-body'); $('#table-title').textContent = title; $('#row-count').textContent = `${rows.length.toLocaleString('th-TH')} รายการ`;
    if (!rows.length) { head.innerHTML = ''; body.innerHTML = '<tr><td class="empty" colspan="8">ไม่พบข้อมูลสำหรับรายงานนี้</td></tr>'; return; }
    const columns = Object.keys(rows[0]);
    head.innerHTML = `<tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>`;
    body.innerHTML = rows.slice(0, 100).map((row) => `<tr>${columns.map((column) => `<td>${String(row[column] ?? '—').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</td>`).join('')}</tr>`).join('');
  };
  const rpc = async (name, body) => {
    const response = await fetch(`${apiBase}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`RPC ${name} failed: ${response.status}`);
    return response.json();
  };
  const loadReports = async () => {
    const year = $('#report-year').value; $('#load-report').disabled = true; setMessage('กำลังโหลดรายงาน…');
    try {
      const [school, tri, tho, ek] = await Promise.all([
        rpc('school_report_rows', { requested_year: year }),
        rpc('mother_sangha_report_rows', { requested_year: year, requested_level: 'ตรี' }),
        rpc('mother_sangha_report_rows', { requested_year: year, requested_level: 'โท' }),
        rpc('mother_sangha_report_rows', { requested_year: year, requested_level: 'เอก' }),
      ]);
      loadedReports = { school, ตรี: tri, โท: tho, เอก: ek }; renderTable(school, `รายงานโรงเรียน · ปี ${year}`);
      document.querySelectorAll('.export-button').forEach((button) => { button.disabled = !loadedReports[button.dataset.report]?.length; });
      setMessage('โหลดข้อมูลรายงานแล้ว');
    } catch (error) { console.warn(error); setMessage('โหลดรายงานไม่สำเร็จ หรือบัญชีนี้ยังไม่มี staff role'); }
    finally { $('#load-report').disabled = false; }
  };
  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!apiBase || !config?.publishableKey) { setMessage('ยังไม่ได้เชื่อม Supabase publishable key'); return; }
    const email = $('#staff-email').value.trim(); setMessage('กำลังส่งลิงก์เข้าใช้งาน…');
    try {
      const response = await fetch(`${apiBase}/auth/v1/otp`, { method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, create_user: false, options: { email_redirect_to: window.location.href.split('#')[0] } }) });
      if (!response.ok) throw new Error(`OTP request failed: ${response.status}`);
      setMessage('ส่งลิงก์แล้ว กรุณาตรวจสอบอีเมลของคุณ');
    } catch (error) { console.warn(error); setMessage('ส่งลิงก์ไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือการตั้งค่า Supabase Auth'); }
  });
  $('#load-report').addEventListener('click', loadReports);
  document.querySelectorAll('.export-button').forEach((button) => button.addEventListener('click', () => downloadCsv(`dharma-${button.dataset.report}-${$('#report-year').value}.csv`, loadedReports[button.dataset.report] || [])));
  $('#sign-out').addEventListener('click', () => { sessionStorage.removeItem('dharma_staff_access_token'); accessToken = ''; showWorkspace(false); });
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hashToken = hash.get('access_token'); if (hashToken) { accessToken = hashToken; sessionStorage.setItem('dharma_staff_access_token', accessToken); history.replaceState({}, '', window.location.pathname); }
  showWorkspace(Boolean(accessToken));
})();
