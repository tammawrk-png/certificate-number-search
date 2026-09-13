(() => {
  const $ = (selector) => document.querySelector(selector);
  document.querySelector('[data-brand="dharma"]')?.setAttribute('src', window.SCHOOL_ASSETS?.dharmaLogo || '');
  document.querySelector('[data-brand="school"]')?.setAttribute('src', window.SCHOOL_ASSETS?.schoolLogo || '');
  const configuredSupabase = window.APP_CONFIG?.supabase || {};
  const config = {
    url: configuredSupabase.url || 'https://jmlcsrmrtghmnpdpfdcf.supabase.co',
    publishableKey: configuredSupabase.publishableKey || 'sb_publishable_ZyZtx2b_wS6XA-PmN5L5cQ_J6WiYrJG',
  };
  const apiBase = config?.url?.replace(/\/$/, '');
  const allowedDomain = '@wrk.ac.th';
  let accessToken = sessionStorage.getItem('dharma_staff_access_token') || '';
  let loadedReports = { school: [], match: [], corrections: [], pickup: [], ตรี: [], โท: [], เอก: [] };
  const headers = () => ({ apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' });
  const setMessage = (text) => { $('#login-message').textContent = text; $('#report-message').textContent = text; };
  const showWorkspace = (visible) => { $('#login-panel').hidden = visible; $('#workspace').hidden = !visible; };
  const isAllowedStaffEmail = (email) => String(email || '').trim().toLowerCase().endsWith(allowedDomain);
  const csvEscape = (value) => {
    const text = String(value ?? '');
    // Prevent spreadsheet formula injection when a CSV is opened in Excel.
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const reportColumns = {
    school: [
      ['academic_year', 'ปีการศึกษา'], ['education_band', 'สายการศึกษา'], ['grade_level', 'ชั้น'], ['room_no', 'ห้อง'],
      ['student_number', 'เลขประจำตัวนักเรียน'], ['full_name', 'ชื่อ-นามสกุล'], ['advisor_1', 'ครูที่ปรึกษา 1'], ['advisor_2', 'ครูที่ปรึกษา 2'],
      ['match_status', 'สถานะจับคู่ประวัติ'], ['highest_legacy_level', 'ระดับสูงสุดจากประวัติเดิม'], ['recommended_level', 'ระดับที่แนะนำ'],
      ['required_for_grade', 'ชั้นบังคับหรือไม่'], ['dhamma_level', 'ระดับที่สมัคร'], ['application_status', 'สถานะสมัคร'],
      ['eligibility_status', 'สิทธิ์สอบ'], ['exam_room', 'ห้องสอบ'], ['seat_no', 'เลขที่สอบ'], ['result_status', 'ผลสอบ'], ['score', 'คะแนน'], ['follow_up_status', 'สถานะติดตาม'],
    ],
    ตรี: [
      ['form_sequence', 'เลขที่'], ['academic_year', 'ปีการศึกษา'], ['dhamma_level', 'ระดับธรรมศึกษา'], ['title', 'คำนำ'],
      ['first_name', 'ชื่อ'], ['last_name', 'นามสกุล'], ['citizen_id', 'เลขที่บัตรประชาชน'], ['birth_date_be', 'เกิด วัน/เดือน/ปี'],
      ['form_education_level', 'ระดับการศึกษา'], ['class_room', 'ชั้น/แผนก/ห้อง'], ['organization_name', 'ชื่อองค์กร'],
      ['subdistrict', 'ตำบล'], ['district', 'อำเภอ'], ['province', 'จังหวัด'], ['temple_affiliation', 'สังกัดวัด'],
      ['school_name', 'สนามสอบ/ชื่อองค์กร'], ['exam_site_code', 'รหัสสนามสอบ'], ['school_council', 'สำนักเรียน'],
      ['previous_certificate_year', 'ประโยคเดิม พ.ศ.'], ['previous_certificate_no', 'เลขที่ ปกศ.'], ['previous_school_council', 'สำนักเรียนเดิม/คณะจังหวัด'],
      ['current_student_number', 'เลขประจำตัวโรงเรียน'],
    ],
    โท: [],
    เอก: [],
    pickup: [
      ['academic_year', 'ปีการศึกษา'], ['student_number', 'เลขประจำตัวนักเรียน'], ['current_full_name', 'ชื่อ-นามสกุลปัจจุบัน'],
      ['education_band', 'สายการศึกษา'], ['grade_level', 'ชั้น'], ['room_no', 'ห้อง'], ['advisor_1', 'ครูที่ปรึกษา 1'], ['advisor_2', 'ครูที่ปรึกษา 2'],
      ['certificate_no', 'เลขใบประกาศ'], ['legacy_full_name', 'ชื่อในประวัติเดิม'], ['dhamma_level', 'ระดับธรรมศึกษา'], ['exam_year_be', 'ปีสอบ'],
      ['pickup_status', 'สถานะรับใบประกาศ'], ['match_status', 'สถานะจับคู่ประวัติ'], ['pickup_note', 'หมายเหตุ'],
    ],
  };
  reportColumns.โท = reportColumns.ตรี;
  reportColumns.เอก = reportColumns.ตรี;
  const downloadCsv = (name, rows, reportKey) => {
    if (!rows.length) return;
    const available = new Set(Object.keys(rows[0]));
    const columns = (reportColumns[reportKey] || Object.keys(rows[0]).map((key) => [key, key]))
      .filter(([key]) => available.has(key));
    const csv = [columns.map(([, label]) => label), ...rows.map((row) => columns.map(([key]) => row[key]))]
      .map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
  };
  const escapeHtml = (value) => String(value ?? '—').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const renderTable = (rows, title, actions = false) => {
    const head = $('#report-head'); const body = $('#report-body'); $('#table-title').textContent = title; $('#row-count').textContent = `${rows.length.toLocaleString('th-TH')} รายการ`;
    if (!rows.length) { head.innerHTML = ''; body.innerHTML = '<tr><td class="empty" colspan="8">ไม่พบข้อมูลสำหรับรายงานนี้</td></tr>'; return; }
    const columns = Object.keys(rows[0]);
    head.innerHTML = `<tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}${actions ? `<th>${actions === 'pickup' ? 'สถานะรับใบประกาศ' : 'การตัดสิน'}</th>` : ''}</tr>`;
    const actionCell = (row) => actions === 'pickup'
      ? `<td class="review-actions"><button class="mini-button confirm" data-pickup-id="${escapeHtml(row.certificate_id)}" data-pickup-status="notified">แจ้งแล้ว</button><button class="mini-button confirm" data-pickup-id="${escapeHtml(row.certificate_id)}" data-pickup-status="claimed">รับแล้ว</button></td>`
      : (row.match_id ? `<td class="review-actions"><button class="mini-button confirm" data-match-id="${escapeHtml(row.match_id)}" data-decision="confirmed">ยืนยัน</button><button class="mini-button reject" data-match-id="${escapeHtml(row.match_id)}" data-decision="rejected">ปฏิเสธ</button></td>` : `<td class="review-actions"><button class="mini-button confirm" data-correction-id="${escapeHtml(row.correction_id)}" data-decision="approved">อนุมัติแก้ไข</button><button class="mini-button reject" data-correction-id="${escapeHtml(row.correction_id)}" data-decision="rejected">ไม่อนุมัติ</button></td>`);
    body.innerHTML = rows.slice(0, 100).map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}${actions ? actionCell(row) : ''}</tr>`).join('');
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
      const pickup = await rpc('certificate_pickup_report_rows_v2', { requested_year: year });
      loadedReports.pickup = pickup;
      renderTable(pickup, `ใบประกาศค้างรับ · ปี ${year}`, 'pickup');
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
        rpc('mother_sangha_form_rows_v2', { requested_year: year, requested_level: 'ตรี' }),
        rpc('mother_sangha_form_rows_v2', { requested_year: year, requested_level: 'โท' }),
        rpc('mother_sangha_form_rows_v2', { requested_year: year, requested_level: 'เอก' }),
      ]);
      loadedReports = { school, ตรี: tri, โท: tho, เอก: ek }; renderTable(school, `รายงานโรงเรียน · ปี ${year}`);
      document.querySelectorAll('.export-button').forEach((button) => { button.disabled = !loadedReports[button.dataset.report]?.length; });
      setMessage('โหลดข้อมูลรายงานแล้ว');
    } catch (error) { console.warn(error); setMessage('โหลดรายงานไม่สำเร็จ หรือบัญชีนี้ยังไม่มี staff role'); }
    finally { $('#load-report').disabled = false; }
  };
  $('#login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!apiBase || !config?.publishableKey) { setMessage('ยังไม่ได้เชื่อม Supabase publishable key'); return; }
    setMessage('กำลังเปิดการยืนยันสิทธิ์ด้วย Google…');
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(`${apiBase}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  });
  $('#load-report').addEventListener('click', loadReports);
  $('#load-match-review').addEventListener('click', loadMatchReview);
  $('#load-correction-review').addEventListener('click', loadCorrectionReview);
  $('#load-pickup-report').addEventListener('click', loadPickupReport);
  $('#report-body').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-match-id], [data-correction-id], [data-pickup-id]');
    if (!button) return;
    button.disabled = true;
    try {
      if (button.dataset.pickupId) {
        await rpc('update_certificate_pickup_status', { requested_certificate_id: button.dataset.pickupId, requested_status: button.dataset.pickupStatus, requested_note: null });
        await loadPickupReport();
      } else if (button.dataset.matchId) {
        await rpc('review_certificate_match', { requested_match_id: button.dataset.matchId, requested_decision: button.dataset.decision });
        await loadMatchReview();
      } else {
        await rpc('review_student_correction', { requested_correction_id: button.dataset.correctionId, requested_decision: button.dataset.decision, requested_note: null });
        await loadCorrectionReview();
      }
    } catch (error) { console.warn(error); setMessage('บันทึกการตัดสินไม่สำเร็จ กรุณาตรวจสอบสิทธิ์หรือรายการซ้ำ'); button.disabled = false; }
  });
  document.querySelectorAll('.export-button').forEach((button) => button.addEventListener('click', () => downloadCsv(`dharma-${button.dataset.report}-${$('#report-year').value}.csv`, loadedReports[button.dataset.report] || [], button.dataset.report)));
  $('#sign-out').addEventListener('click', () => { sessionStorage.removeItem('dharma_staff_access_token'); accessToken = ''; showWorkspace(false); });
  const validateSession = async () => {
    if (!accessToken || !apiBase || !config?.publishableKey) { showWorkspace(false); return; }
    try {
      const response = await fetch(`${apiBase}/auth/v1/user`, { headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`session user request failed: ${response.status}`);
      const user = await response.json();
      if (!isAllowedStaffEmail(user.email)) throw new Error('STAFF_DOMAIN_REQUIRED');
      showWorkspace(true);
      setMessage(`เข้าสู่ระบบแล้ว: ${user.email} · ระบบจะตรวจ staff role เมื่อโหลดข้อมูล`);
    } catch (error) {
      console.warn(error); sessionStorage.removeItem('dharma_staff_access_token'); accessToken = ''; showWorkspace(false);
      setMessage(error.message === 'STAFF_DOMAIN_REQUIRED' ? 'บัญชีนี้ไม่ใช่อีเมลองค์กร @wrk.ac.th' : 'ยืนยันบัญชี Google ไม่สำเร็จ กรุณาลองใหม่');
    }
  };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hashToken = hash.get('access_token'); if (hashToken) { accessToken = hashToken; sessionStorage.setItem('dharma_staff_access_token', accessToken); history.replaceState({}, '', window.location.pathname); }
  validateSession();
})();
