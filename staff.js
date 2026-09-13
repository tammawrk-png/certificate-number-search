(() => {
  const $ = (selector) => document.querySelector(selector);
  document.querySelector('[data-brand="dharma"]')?.setAttribute('src', window.SCHOOL_ASSETS?.dharmaLogo || '');
  document.querySelector('[data-brand="school"]')?.setAttribute('src', window.SCHOOL_ASSETS?.schoolLogo || '');
  const config = window.APP_CONFIG?.supabase;
  const apiBase = config?.url?.replace(/\/$/, '');
  let accessToken = sessionStorage.getItem('dharma_staff_access_token') || '';
  let loadedReports = { school: [], match: [], corrections: [], pickup: [], ตรี: [], โท: [], เอก: [] };
  const headers = () => ({ apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' });
  const setMessage = (text) => { $('#login-message').textContent = text; $('#report-message').textContent = text; };
  const showWorkspace = (visible) => { $('#login-panel').hidden = visible; $('#workspace').hidden = !visible; };
  const csvEscape = (value) => {
    const text = String(value ?? '');
    // Prevent spreadsheet formula injection when a CSV is opened in Excel.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const downloadCsv = (name, rows) => {
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const csv = [columns, ...rows.map((row) => columns.map((column) => row[column]))].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
  };
  const escapeHtml = (value) => String(value ?? '—').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const renderTable = (rows, title, actions = false) => {
    const head = $('#report-head'); const body = $('#report-body'); $('#table-title').textContent = title; $('#row-count').textContent = `${rows.length.toLocaleString('th-TH')} รายการ`;
    if (!rows.length) { head.innerHTML = ''; body.innerHTML = '<tr><td class="empty" colspan="8">ไม่พบข้อมูลสำหรับรายงานนี้</td></tr>'; return; }
    const columns = Object.keys(rows[0]);
    head.innerHTML = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}${actions ? '<th>การตัดสิน</th>' : ''}</tr>`;
    body.innerHTML = rows.slice(0, 100).map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}${actions ? (row.match_id ? `<td class="review-actions"><button class="mini-button confirm" data-match-id="${escapeHtml(row.match_id)}" data-decision="confirmed">ยืนยัน</button><button class="mini-button reject" data-match-id="${escapeHtml(row.match_id)}" data-decision="rejected">ปฏิเสธ</button></td>` : `<td class="review-actions"><button class="mini-button confirm" data-correction-id="${escapeHtml(row.correction_id)}" data-decision="approved">อนุมัติแก้ไข</button><button class="mini-button reject" data-correction-id="${escapeHtml(row.correction_id)}" data-decision="rejected">ไม่อนุมัติ</button></td>`) : ''}</tr>`).join('');
  };
  const loadCorrectionReview = async () => {
    const year = $('#report-year').value; $('#load-correction-review').disabled = true; setMessage('กำลังโหลดคำขอแก้ไข…');
    try {
      const corrections = await rpc('student_correction_review_rows', { requested_year: year });
      loadedReports.corrections = corrections;
      renderTable(corrections, `คำขอแก้ไขข้อมูล · ปี ${year}`, true);
      setMessage(`พบคำขอรอตรวจ ${corrections.length.toLocaleString('th-TH')} รายการ`);
    } catch (error) { console.warn(error); setMessage('โหลดคำขอแก้ไขไม่สำเร็จ หรือบัญชีนี้ยังไม่มี staff role'); }
    finally { $('#load-correction-review').disabled = false; }
  };
  const loadPickupReport = async () => {
    const year = $('#report-year').value; $('#load-pickup-report').disabled = true; setMessage('กำลังโหลดใบประกาศค้างรับ…');
    try {
      const pickup = await rpc('certificate_pickup_report_rows', { requested_year: year });
      loadedReports.pickup = pickup;
      renderTable(pickup, `ใบประกาศค้างรับ · ปี ${year}`);
      const exportButton = document.querySelector('.export-button[data-report="pickup"]');
      if (exportButton) exportButton.disabled = !pickup.length;
      setMessage(`พบใบประกาศค้างรับ ${pickup.length.toLocaleString('th-TH')} รายการ`);
    } catch (error) { console.warn(error); setMessage('โหลดรายงานใบประกาศค้างรับไม่สำเร็จ หรือบัญชีนี้ยังไม่มี staff role'); }
    finally { $('#load-pickup-report').disabled = false; }
  };
  const loadMatchReview = async () => {
    const year = $('#report-year').value; $('#load-match-review').disabled = true; setMessage('กำลังโหลดคิวจับคู่…');
    try {
      const match = await rpc('certificate_match_review_rows', { requested_year: year });
      loadedReports.match = match;
      renderTable(match, `คิวตรวจจับคู่ชื่อซ้ำ · ปี ${year}`, true);
      setMessage(`พบรายการรอตรวจ ${match.length.toLocaleString('th-TH')} รายการ`);
    } catch (error) { console.warn(error); setMessage('โหลดคิวจับคู่ไม่สำเร็จ หรือบัญชีนี้ยังไม่มี staff role'); }
    finally { $('#load-match-review').disabled = false; }
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
  $('#load-match-review').addEventListener('click', loadMatchReview);
  $('#load-correction-review').addEventListener('click', loadCorrectionReview);
  $('#load-pickup-report').addEventListener('click', loadPickupReport);
  $('#report-body').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-match-id], [data-correction-id]');
    if (!button) return;
    button.disabled = true;
    try {
      if (button.dataset.matchId) {
        await rpc('review_certificate_match', { requested_match_id: button.dataset.matchId, requested_decision: button.dataset.decision });
        await loadMatchReview();
      } else {
        await rpc('review_student_correction', { requested_correction_id: button.dataset.correctionId, requested_decision: button.dataset.decision, requested_note: null });
        await loadCorrectionReview();
      }
    } catch (error) { console.warn(error); setMessage('บันทึกการตัดสินไม่สำเร็จ กรุณาตรวจสอบสิทธิ์หรือรายการซ้ำ'); button.disabled = false; }
  });
  document.querySelectorAll('.export-button').forEach((button) => button.addEventListener('click', () => downloadCsv(`dharma-${button.dataset.report}-${$('#report-year').value}.csv`, loadedReports[button.dataset.report] || [])));
  $('#sign-out').addEventListener('click', () => { sessionStorage.removeItem('dharma_staff_access_token'); accessToken = ''; showWorkspace(false); });
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hashToken = hash.get('access_token'); if (hashToken) { accessToken = hashToken; sessionStorage.setItem('dharma_staff_access_token', accessToken); history.replaceState({}, '', window.location.pathname); }
  showWorkspace(Boolean(accessToken));
})();
