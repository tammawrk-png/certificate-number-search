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
  let accessToken = sessionStorage.getItem('dharma_staff_access_token') || '';
  let loadedReports = { school: [], match: [], corrections: [], pickup: [], ตรี: [], โท: [], เอก: [] };
  let registrationMatrixRows = [];
  let matrixPollTimer = null;
  const headers = () => ({ apikey: config.publishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' });
  const setMessage = (text) => {
    const target = $('#workspace').hidden ? $('#login-message') : $('#report-message');
    if (target) target.textContent = text;
  };
  const showToast = (text, tone = 'error') => {
    const region = $('#toast-region');
    if (!region) return;
    region.replaceChildren();
    const toast = document.createElement('div');
    toast.className = `toast ${tone}`;
    toast.textContent = text;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 5200);
  };
  const showWorkspace = (visible) => { $('#login-panel').hidden = visible; $('#workspace').hidden = !visible; };
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
      ['organization_subdistrict', 'ตำบลองค์กร'], ['organization_district', 'อำเภอองค์กร'], ['organization_province', 'จังหวัดองค์กร'],
      ['temple_affiliation', 'สังกัดวัด'], ['temple_subdistrict', 'ตำบลวัด'], ['temple_district', 'อำเภอวัด'], ['temple_province', 'จังหวัดวัด'],
      ['school_name', 'สนามสอบ/ชื่อองค์กร'], ['exam_site_code', 'รหัสสนามสอบ'], ['school_council', 'สำนักเรียน'],
      ['previous_certificate_year', 'ประโยคเดิม พ.ศ.'], ['previous_certificate_no', 'เลขที่ ปกศ.'], ['previous_school_council', 'สำนักเรียนเดิม/คณะจังหวัด'],
      ['notes', 'หมายเหตุ'], ['current_student_number', 'เลขประจำตัวโรงเรียน'],
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
  const printReport = (reportKey) => {
    const rows = loadedReports[reportKey] || [];
    if (!rows.length) return showToast('ยังไม่มีข้อมูลสำหรับพิมพ์รายงาน');
    const columns = (reportColumns[reportKey] || Object.keys(rows[0]).map((key) => [key, key]))
      .filter(([key]) => Object.prototype.hasOwnProperty.call(rows[0], key));
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return showToast('เปิดหน้าพิมพ์ไม่ได้ กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้');
    const title = reportKey === 'school' ? 'รายงานโรงเรียน' : reportKey === 'pickup' ? 'ใบประกาศค้างรับ' : `ข้อมูลแม่กองธรรม · ${reportKey}`;
    printWindow.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#19324a}h1{font-size:20px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #b8c9d6;padding:5px;text-align:left;vertical-align:top}th{background:#eaf5ff}</style></head><body><h1>${escapeHtml(title)} · ปี ${escapeHtml($('#report-year').value)}</h1><table><thead><tr>${columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key]) => `<td>${escapeHtml(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
    printWindow.document.close();
  };
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
  const setMatrixStatus = (text, tone = '') => {
    const badge = $('#matrix-sync-status');
    if (badge) { badge.textContent = text; badge.className = `sync-badge ${tone}`.trim(); }
  };
  const matrixNumber = (value) => value === null || value === undefined || value === '' ? null : Number(value);
  const matrixGroups = (rows) => {
    const groups = new Map();
    rows.forEach((row) => {
      if (!groups.has(row.student_id)) groups.set(row.student_id, { ...row, levels: {} });
      groups.get(row.student_id).levels[row.dhamma_level] = row;
    });
    return [...groups.values()].sort((a, b) => Number(a.grade_level) - Number(b.grade_level) || Number(a.room_no) - Number(b.room_no) || String(a.student_number).localeCompare(String(b.student_number), 'th'));
  };
  const sortFormRows = (rows) => [...rows].sort((a, b) => {
    const roomA = String(a.class_room || '').match(/(\d+)\s*\/\s*(\d+)/) || [];
    const roomB = String(b.class_room || '').match(/(\d+)\s*\/\s*(\d+)/) || [];
    return Number(roomA[1] || 999) - Number(roomB[1] || 999) || Number(roomA[2] || 999) - Number(roomB[2] || 999) || String(a.current_student_number || '').localeCompare(String(b.current_student_number || ''), 'th');
  });
  const renderRegistrationMatrix = (rows) => {
    const body = $('#registration-matrix-body');
    const groups = matrixGroups(rows);
    if (!groups.length) { body.innerHTML = '<tr><td class="empty" colspan="9">ไม่พบรายชื่อนักเรียนตามตัวกรอง</td></tr>'; return; }
    const levelCell = (student, level) => {
      const row = student.levels[level] || {};
      const checked = row.is_selected ? ' checked' : '';
      const disabled = row.application_status === 'verified' ? ' disabled' : '';
      const state = row.application_status === 'verified' ? '<span class="choice-state locked">ยืนยันแล้ว</span>' : row.is_selected ? '<span class="choice-state selected">สมัคร</span>' : '<span class="choice-state off">ไม่สมัคร</span>';
      return `<td><label class="choice-cell"><input type="checkbox" data-matrix-student="${escapeHtml(student.student_id)}" data-matrix-level="${level}"${checked}${disabled} aria-label="${escapeHtml(student.full_name)} สมัครชั้น${level}">${state}</label></td>`;
    };
    body.innerHTML = groups.map((student) => {
      const history = student.certificate_no ? `${escapeHtml(student.highest_legacy_level || 'มีประวัติ')} · ${escapeHtml(student.certificate_no)}${student.certificate_year ? ` (${escapeHtml(student.certificate_year)})` : ''}` : 'ยังไม่พบเลขใบประกาศ';
      const guidance = student.guidance_note || '—';
      const guidanceClass = student.guidance_status === 'required' ? 'guidance-required' : student.guidance_status === 'suggested' ? 'guidance-suggested' : student.guidance_status === 'completed' ? 'guidance-completed' : '';
      return `<tr><td>${escapeHtml(student.grade_level)}/${escapeHtml(student.room_no)}</td><td>${escapeHtml(student.student_number)}</td><td><span class="matrix-student">${escapeHtml(student.full_name)}</span><span class="matrix-subline">${escapeHtml(student.education_band)}</span></td><td>${escapeHtml(student.advisor_1 || '—')}<span class="matrix-subline">${escapeHtml(student.advisor_2 || '')}</span></td><td>${history}</td>${levelCell(student, 'ตรี')}${levelCell(student, 'โท')}${levelCell(student, 'เอก')}<td class="${guidanceClass}">${escapeHtml(guidance)}</td></tr>`;
    }).join('');
  };
  const loadRegistrationMatrix = async ({ silent = false } = {}) => {
    const year = $('#report-year').value;
    const band = $('#matrix-band').value || null;
    const grade = matrixNumber($('#matrix-grade').value.trim());
    const room = matrixNumber($('#matrix-room').value.trim());
    if (grade !== null && !Number.isInteger(grade)) return showToast('ชั้นต้องเป็นตัวเลข');
    if (room !== null && !Number.isInteger(room)) return showToast('ห้องต้องเป็นตัวเลข');
    if (!silent) $('#load-registration-matrix').disabled = true;
    setMatrixStatus(silent ? 'กำลังซิงก์…' : 'กำลังโหลด…', 'busy');
    try {
      registrationMatrixRows = await rpc('staff_registration_choice_matrix', { requested_year: year, requested_band: band, requested_grade: grade, requested_room: room });
      renderRegistrationMatrix(registrationMatrixRows);
      setMatrixStatus(`ซิงก์แล้ว ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`, 'ok');
      if (!silent) setMessage(`โหลดทะเบียนสมัคร ${matrixGroups(registrationMatrixRows).length.toLocaleString('th-TH')} คนแล้ว`);
    } catch (error) { console.warn(error); setMatrixStatus('ซิงก์ไม่สำเร็จ'); if (!silent) showToast('โหลดทะเบียนสมัครไม่สำเร็จ กรุณาตรวจสิทธิ์เจ้าหน้าที่แล้วลองใหม่'); }
    finally { if (!silent) $('#load-registration-matrix').disabled = false; }
  };
  const startMatrixPolling = () => {
    window.clearInterval(matrixPollTimer);
    matrixPollTimer = window.setInterval(() => { if (!document.hidden && !document.querySelector('[data-matrix-saving="1"]')) loadRegistrationMatrix({ silent: true }); }, 10000);
  };
  const loadCorrectionReview = async () => {
    const year = $('#report-year').value; $('#load-correction-review').disabled = true; setMessage('กำลังโหลดคำขอแก้ไข…');
    try {
      const corrections = await rpc('student_correction_review_rows', { requested_year: year });
      loadedReports.corrections = corrections;
      renderTable(corrections, `คำขอแก้ไขข้อมูล · ปี ${year}`, true);
      setMessage(`พบคำขอรอตรวจ ${corrections.length.toLocaleString('th-TH')} รายการ`);
    } catch (error) { console.warn(error); showToast('โหลดคำขอแก้ไขไม่สำเร็จ กรุณาตรวจสิทธิ์เจ้าหน้าที่แล้วลองใหม่'); }
    finally { $('#load-correction-review').disabled = false; }
  };
  const loadPickupReport = async () => {
    const year = $('#report-year').value; $('#load-pickup-report').disabled = true; setMessage('กำลังโหลดใบประกาศค้างรับ…');
    try {
      const pickup = await rpc('certificate_pickup_report_rows_v2', { requested_year: year });
      loadedReports.pickup = pickup;
      renderTable(pickup, `ใบประกาศค้างรับ · ปี ${year}`, 'pickup');
      document.querySelectorAll('[data-report="pickup"].export-button,[data-report="pickup"].print-button').forEach((button) => { button.disabled = !pickup.length; });
      setMessage(`พบใบประกาศค้างรับ ${pickup.length.toLocaleString('th-TH')} รายการ`);
    } catch (error) { console.warn(error); showToast('โหลดรายงานใบประกาศค้างรับไม่สำเร็จ กรุณาลองใหม่ภายหลัง'); }
    finally { $('#load-pickup-report').disabled = false; }
  };
  const loadMatchReview = async () => {
    const year = $('#report-year').value; $('#load-match-review').disabled = true; setMessage('กำลังโหลดคิวจับคู่…');
    try {
      const match = await rpc('certificate_match_review_rows', { requested_year: year });
      loadedReports.match = match;
      renderTable(match, `คิวตรวจจับคู่ชื่อซ้ำ · ปี ${year}`, true);
      setMessage(`พบรายการรอตรวจ ${match.length.toLocaleString('th-TH')} รายการ`);
    } catch (error) { console.warn(error); showToast('โหลดคิวจับคู่ไม่สำเร็จ กรุณาตรวจสิทธิ์เจ้าหน้าที่แล้วลองใหม่'); }
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
        rpc('mother_sangha_form_rows_v3', { requested_year: year, requested_level: 'ตรี' }),
        rpc('mother_sangha_form_rows_v3', { requested_year: year, requested_level: 'โท' }),
        rpc('mother_sangha_form_rows_v3', { requested_year: year, requested_level: 'เอก' }),
      ]);
      loadedReports = { school, ตรี: sortFormRows(tri), โท: sortFormRows(tho), เอก: sortFormRows(ek) }; renderTable(school, `รายงานโรงเรียน · ปี ${year}`);
      document.querySelectorAll('.export-button,.print-button').forEach((button) => { button.disabled = !loadedReports[button.dataset.report]?.length; });
      setMessage('โหลดข้อมูลรายงานแล้ว');
    } catch (error) { console.warn(error); showToast('โหลดรายงานไม่สำเร็จ กรุณาตรวจสิทธิ์เจ้าหน้าที่แล้วลองใหม่'); }
    finally { $('#load-report').disabled = false; }
  };
  const staffAccessPin = '1234';
  const showGoogleLogin = () => { $('#staff-access-gate').hidden = true; $('#google-login-panel').hidden = false; };
  $('#staff-pin-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if ($('#staff-pin').value.trim() !== staffAccessPin) { showToast('รหัสเข้าพื้นที่เจ้าหน้าที่ไม่ถูกต้อง'); $('#staff-pin').select(); return; }
    sessionStorage.setItem('dharma_staff_gate', '1'); showGoogleLogin(); setMessage('กรุณายืนยันด้วยบัญชี Google ของเจ้าหน้าที่');
  });
  if (sessionStorage.getItem('dharma_staff_gate') === '1') showGoogleLogin();
  $('#login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!apiBase || !config?.publishableKey) { setMessage('ยังไม่ได้เชื่อม Supabase publishable key'); return; }
    setMessage('กำลังเปิดการยืนยันสิทธิ์ด้วย Google…');
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    window.location.assign(`${apiBase}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  });
  $('#load-report').addEventListener('click', loadReports);
  $('#load-registration-matrix').addEventListener('click', async () => { await loadRegistrationMatrix(); startMatrixPolling(); });
  $('#registration-matrix-body').addEventListener('change', async (event) => {
    const input = event.target.closest('[data-matrix-student][data-matrix-level]');
    if (!input) return;
    const studentId = input.dataset.matrixStudent;
    const level = input.dataset.matrixLevel;
    const selected = input.checked;
    input.dataset.matrixSaving = '1';
    input.disabled = true;
    setMatrixStatus('กำลังบันทึก…', 'busy');
    try {
      await rpc('staff_set_registration_choice', { requested_year: $('#report-year').value, requested_student_id: studentId, requested_level: level, requested_selected: selected });
      const row = registrationMatrixRows.find((item) => item.student_id === studentId && item.dhamma_level === level);
      if (row) { row.is_selected = selected; row.application_status = selected ? 'submitted' : 'cancelled'; }
      renderRegistrationMatrix(registrationMatrixRows);
      setMatrixStatus(`บันทึกแล้ว ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`, 'ok');
      setMessage(`บันทึกการสมัครชั้น${level}แล้ว`);
    } catch (error) {
      console.warn(error); input.checked = !selected; input.disabled = false; showToast(error.message.includes('PREREQUISITE') ? `ยังไม่มีหลักฐานเดิมสำหรับสมัครชั้น${level}` : error.message.includes('REQUIRED') ? 'ชั้น ม.1 และ ม.4 ต้องสมัครชั้นตรี' : 'บันทึกการสมัครไม่สำเร็จ');
      setMatrixStatus('ยังไม่ได้บันทึก', '');
    } finally { delete input.dataset.matrixSaving; }
  });
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
  document.querySelectorAll('.export-button').forEach((button) => button.addEventListener('click', () => {
    const rows = loadedReports[button.dataset.report] || [];
    const year = $('#report-year').value;
    downloadCsv(`dharma-${button.dataset.report}-${year}.csv`, rows, button.dataset.report);
  }));
  document.querySelectorAll('.print-button').forEach((button) => button.addEventListener('click', () => printReport(button.dataset.report)));
  document.querySelectorAll('[data-report-tab]').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-report-tab]').forEach((item) => item.classList.toggle('active', item === tab));
    const reportKey = tab.dataset.reportTab;
    const rows = loadedReports[reportKey] || [];
    const title = reportKey === 'school' ? `รายงานโรงเรียน · ปี ${$('#report-year').value}` : reportKey === 'pickup' ? `ใบประกาศค้างรับ · ปี ${$('#report-year').value}` : `รายชื่อผู้สมัครธรรมศึกษาชั้น${reportKey} · ปี ${$('#report-year').value}`;
    renderTable(rows, title);
  }));
  $('#sign-out').addEventListener('click', () => { sessionStorage.removeItem('dharma_staff_access_token'); sessionStorage.removeItem('dharma_staff_gate'); accessToken = ''; showWorkspace(false); $('#staff-access-gate').hidden = false; $('#google-login-panel').hidden = true; });
  const validateSession = async () => {
    if (sessionStorage.getItem('dharma_staff_gate') !== '1') { showWorkspace(false); return; }
    if (!accessToken || !apiBase || !config?.publishableKey) { showWorkspace(false); return; }
    try {
      const response = await fetch(`${apiBase}/auth/v1/user`, { headers: { apikey: config.publishableKey, Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) throw new Error(`session user request failed: ${response.status}`);
      const user = await response.json();
      const staffRole = await rpc('is_staff', {});
      if (staffRole !== true) throw new Error('STAFF_ROLE_REQUIRED');
      showWorkspace(true);
      setMessage(`เข้าสู่ระบบแล้ว: ${user.email} · ยืนยัน staff role แล้ว`);
    } catch (error) {
      console.warn(error); sessionStorage.removeItem('dharma_staff_access_token'); accessToken = ''; showWorkspace(false);
      setMessage(error.message === 'STAFF_ROLE_REQUIRED' ? 'บัญชีนี้ยังไม่ได้รับสิทธิ์เจ้าหน้าที่จาก staff_roles' : 'ยืนยันบัญชี Google ไม่สำเร็จ กรุณาลองใหม่');
    }
  };
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const hashToken = hash.get('access_token'); if (hashToken) { accessToken = hashToken; sessionStorage.setItem('dharma_staff_access_token', accessToken); history.replaceState({}, '', window.location.pathname); }
  validateSession();
})();
