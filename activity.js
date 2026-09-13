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
  const apiHeaders = config?.publishableKey
    ? { apikey: config.publishableKey, Authorization: `Bearer ${config.publishableKey}`, 'Content-Type': 'application/json' }
    : null;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const metricMap = {
    current_students: '#metric-students',
    matched_students: '#metric-matched',
    submitted_registrations: '#metric-registered',
    imported_results: '#metric-passed',
  };
  let activeAcademicYear = '2569';
  let registrationOpen = false;
  let verifiedStudent = null;
  const syncAcademicYear = (year) => {
    if (!year) return;
    activeAcademicYear = String(year);
    const yearSelect = registrationForm?.elements?.year;
    if (yearSelect) {
      yearSelect.innerHTML = `<option value="${escapeHtml(activeAcademicYear)}">${escapeHtml(activeAcademicYear)}</option>`;
      yearSelect.value = activeAcademicYear;
    }
  };
  const setMetric = (name, value) => {
    const node = $(metricMap[name]);
    if (node) node.textContent = value == null ? '—' : Number(value).toLocaleString('th-TH');
  };
  const loadPublicMetrics = async () => {
    const state = $('#metrics-state');
    if (!apiBase || !apiHeaders) {
      state.textContent = 'รอเชื่อมต่อ API สาธารณะ';
      return;
    }
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/public_dashboard_metrics_v2`, {
        method: 'POST',
        headers: apiHeaders,
        body: '{}',
      });
      if (!response.ok) throw new Error(`metrics request failed: ${response.status}`);
      const rows = await response.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('metrics response was empty');
      syncAcademicYear(row.academic_year);
      setMetric('current_students', row.current_students);
      setMetric('submitted_registrations', row.submitted_registrations);
      setMetric('imported_results', row.imported_results);
      setMetric('matched_students', row.matched_students);
      state.textContent = `อัปเดตจากฐานข้อมูล · ปี ${row.academic_year}`;
    } catch (error) {
      console.warn(error);
      state.textContent = 'เชื่อมต่อ API ไม่สำเร็จ';
    }
  };
  const loadRegistrationWindow = async () => {
    const state = $('#registration-state');
    if (!state || !apiBase || !apiHeaders) {
      if (state) state.textContent = 'รอเชื่อมต่อ API สาธารณะ';
      return;
    }
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/public_registration_window_status`, {
        method: 'POST', headers: apiHeaders, body: JSON.stringify({ requested_year: activeAcademicYear }),
      });
      if (!response.ok) throw new Error(`registration window request failed: ${response.status}`);
      const rows = await response.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw new Error('registration window response was empty');
      state.classList.toggle('open', Boolean(row.is_open));
      state.classList.toggle('pending', !row.is_open);
      registrationOpen = Boolean(row.is_open);
      state.textContent = row.is_open ? 'เปิดรับสมัครแล้ว' : 'ยังไม่เปิดรับสมัคร';
    } catch (error) {
      console.warn(error);
      state.textContent = 'ตรวจสอบช่วงรับสมัครไม่ได้';
    }
  };
  const registrationForm = $('#registration-form');
  const wizardSteps = [...registrationForm.querySelectorAll('.wizard-step')];
  const stepIndicators = [...document.querySelectorAll('[data-step-indicator]')];
  let currentStep = 1;
  const summaryLabels = { year: 'ปีการศึกษา', band: 'สายการศึกษา', level: 'ระดับธรรมศึกษา', studentNumber: 'เลขประจำตัวนักเรียน', fullName: 'ชื่อ-นามสกุล', grade: 'ชั้น/ห้อง', advisors: 'ครูที่ปรึกษา' };
  const bandLabels = { lower_secondary: 'มัธยมศึกษาตอนต้น', upper_secondary: 'มัธยมศึกษาตอนปลาย', higher_education: 'อุดมศึกษา' };
  const guidanceLabels = { required: 'ต้องสมัครชั้นตรีตามเกณฑ์ชั้นเริ่มต้น', suggested: 'แนะนำระดับถัดไปจากประวัติเดิม', completed: 'พบประวัติชั้นเอกแล้ว ไม่บังคับสมัครต่อ', unmatched: 'ยังไม่พบประวัติที่จับคู่ได้', review_required: 'พบประวัติชื่อซ้ำ รอเจ้าหน้าที่ตรวจสอบ' };
  const selectedText = (name) => registrationForm.elements[name]?.selectedOptions?.[0]?.textContent || registrationForm.elements[name]?.value || '';
  const updateSummary = () => {
    const values = {
      year: selectedText('year'), band: bandLabels[verifiedStudent?.education_band] || 'ระบบจะกำหนดจากทะเบียน', level: selectedText('level'),
      studentNumber: verifiedStudent?.student_number || registrationForm.elements.studentNumber.value.trim(), fullName: verifiedStudent?.full_name || 'ยังไม่ได้ยืนยันตัวตน',
      grade: verifiedStudent ? `ม.${verifiedStudent.grade_level} · ห้อง ${verifiedStudent.room_no}` : '—',
      advisors: verifiedStudent ? [verifiedStudent.advisor_1, verifiedStudent.advisor_2].filter(Boolean).join(' และ ') || 'รอข้อมูล' : '—',
    };
    $('#registration-summary').innerHTML = Object.entries(values).map(([key, value]) =>
      `<div class="summary-row"><span>${summaryLabels[key]}</span><strong>${escapeHtml(value || '—')}</strong></div>`
    ).join('');
  };
  const setWizardStep = (step) => {
    currentStep = step;
    wizardSteps.forEach((section) => { const active = Number(section.dataset.step) === step; section.hidden = !active; section.classList.toggle('active', active); });
    stepIndicators.forEach((indicator) => indicator.classList.toggle('active', Number(indicator.dataset.stepIndicator) <= step));
    if (step === 3) updateSummary();
  };
  const tabs = [...document.querySelectorAll('.tab')];
  const syncActiveTab = () => {
    const target = window.location.hash || '#dashboard';
    tabs.forEach((tab) => tab.classList.toggle('active', new URL(tab.href).hash === target));
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => window.setTimeout(syncActiveTab, 0)));
  window.addEventListener('hashchange', syncActiveTab);
  syncActiveTab();
  const verifyStudent = async () => {
    const preview = $('#identity-preview');
    const message = $('#registration-message');
    preview.classList.remove('error');
    if (!apiBase || !apiHeaders) {
      preview.hidden = false;
      preview.textContent = 'ยังไม่สามารถตรวจทะเบียนได้ เพราะยังไม่ได้เชื่อมต่อ API';
      return false;
    }
    const studentNumber = registrationForm.elements.studentNumber.value.trim();
    if (!studentNumber) return false;
    preview.hidden = false;
    preview.textContent = 'กำลังค้นเลขประจำตัวกับทะเบียนโรงเรียน…';
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/public_student_lookup_options`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ requested_year: activeAcademicYear, requested_student_number: studentNumber }),
      });
      if (!response.ok) throw new Error(`student preflight failed: ${response.status}`);
      const rows = await response.json();
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row?.verified) {
        preview.classList.add('error');
        preview.textContent = 'ไม่พบเลขประจำตัวในทะเบียนปีนี้ กรุณาตรวจสอบตัวเลข หรือติดต่อโรงเรียน';
        return false;
      }
      verifiedStudent = row;
      registrationForm.elements.band.value = row.education_band;
      if (row.required_level) registrationForm.elements.level.value = row.required_level;
      const advisors = [row.advisor_1, row.advisor_2].filter(Boolean).join(' และ ') || 'รอข้อมูล';
      const recommendation = row.guidance_status === 'review_required'
        ? 'ประวัติเดิมมีรายการชื่อซ้ำ เจ้าหน้าที่จะตรวจสอบก่อนใช้เป็นคำแนะนำ'
        : (row.recommended_level ? `ระดับที่ระบบแนะนำ: ${row.recommended_level}` : 'ไม่มีระดับต่อเนื่องที่ต้องสมัคร');
      preview.classList.remove('error');
      preview.innerHTML = `<strong>พบข้อมูลของคุณจากเลขประจำตัว — โปรดตรวจสอบ</strong><div class="preview-name">${escapeHtml(row.title || '')}${escapeHtml(row.full_name)}</div><div class="preview-grid">` +
        `<span>สาย/ชั้น</span><b>${escapeHtml(bandLabels[row.education_band] || row.education_band)} · ม.${escapeHtml(row.grade_level)}</b>` +
        `<span>ห้อง</span><b>ห้อง ${escapeHtml(row.room_no)}</b>` +
        `<span>ครูที่ปรึกษา</span><b>${escapeHtml(advisors)}</b>` +
        `<span>ประวัติเดิม</span><b>${escapeHtml(row.highest_legacy_level || 'ยังไม่พบ')} · ${escapeHtml(guidanceLabels[row.guidance_status] || '')}</b>` +
        `</div><small>${escapeHtml(recommendation)} · ประวัติใบประกาศจะแสดงด้านล่าง หากไม่สอบต่อไม่ต้องยืนยันหรือสมัคร</small>`;
      const identityResponse = await fetch(`${apiBase}/rest/v1/rpc/public_student_identity`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ requested_year: activeAcademicYear, requested_student_number: studentNumber }),
      });
      const identityRows = identityResponse.ok ? await identityResponse.json() : [];
      const identity = Array.isArray(identityRows) ? identityRows[0] : identityRows;
      const editPanel = $('#self-edit-panel');
      editPanel.hidden = false;
      registrationForm.elements.selfTitle.value = identity?.title || row.title || (Number(row.grade_level) <= 3 ? 'เด็กชาย' : 'นาย');
      registrationForm.elements.selfFirstName.value = identity?.first_name || row.first_name || '';
      registrationForm.elements.selfLastName.value = identity?.last_name || row.last_name || '';
      registrationForm.elements.selfCitizenId.value = identity?.citizen_id || '';
      registrationForm.elements.selfBirthDate.value = identity?.birth_date_be || '';
      await loadCertificateAlerts(studentNumber);
      return true;
    } catch (error) {
      console.warn(error);
      message.textContent = 'ตรวจทะเบียนไม่สำเร็จ กรุณาลองใหม่ภายหลัง';
      preview.classList.add('error');
      preview.textContent = 'ระบบตรวจทะเบียนขัดข้องชั่วคราว กรุณาลองใหม่';
      return false;
    }
  };
  const loadCertificateAlerts = async (studentNumber) => {
    const node = $('#certificate-alert');
    node.hidden = true;
    if (!apiBase || !apiHeaders) return;
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/public_student_certificate_alerts`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ requested_year: activeAcademicYear, requested_student_number: studentNumber }),
      });
      if (!response.ok) throw new Error(`certificate alert request failed: ${response.status}`);
      const rows = await response.json();
      if (!rows.length) return;
      node.hidden = false;
      node.innerHTML = `<strong>ประวัติใบประกาศเดิม</strong><p>ระบบพบรายการที่เกี่ยวข้องกับเลขประจำตัวนี้ กรุณาตรวจสอบสถานะรับใบประกาศ</p>` + rows.map((row) =>
        `<div class="certificate-row"><b>ชั้น${escapeHtml(row.dhamma_level)} · ปี ${escapeHtml(row.exam_year_be || 'ไม่ระบุ')}</b><span>ใบประกาศเลขที่ ${escapeHtml(row.certificate_no || 'รอข้อมูล')}</span><span>ชื่อในประวัติเดิม: ${escapeHtml(row.legacy_full_name || 'ไม่ระบุ')}</span><span>ปัจจุบัน: ม.${escapeHtml(row.grade_level)} ห้อง ${escapeHtml(row.room_no)} · ครูที่ปรึกษา ${escapeHtml([row.advisor_1, row.advisor_2].filter(Boolean).join(' และ ') || 'รอข้อมูล')}</span><small>${escapeHtml(row.pickup_message)}</small></div>`).join('');
    } catch (error) { console.warn(error); }
  };
  registrationForm.elements.studentNumber.addEventListener('input', () => {
    verifiedStudent = null;
    $('#identity-preview').hidden = true;
    $('#certificate-alert').hidden = true;
    $('#self-edit-panel').hidden = true;
  });
  $('#save-self-data').addEventListener('click', async (event) => {
    const panel = $('#self-edit-panel');
    const first = registrationForm.elements.selfFirstName.value.trim();
    const last = registrationForm.elements.selfLastName.value.trim();
    if (!first || !last) { registrationForm.elements.selfFirstName.reportValidity(); registrationForm.elements.selfLastName.reportValidity(); return; }
    event.currentTarget.disabled = true;
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/public_update_student_self`, { method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ requested_year: activeAcademicYear, requested_student_number: registrationForm.elements.studentNumber.value.trim(), current_full_name: verifiedStudent?.full_name, requested_title: registrationForm.elements.selfTitle.value, requested_first_name: first, requested_last_name: last, requested_citizen_id: registrationForm.elements.selfCitizenId.value.trim(), requested_birth_date_be: registrationForm.elements.selfBirthDate.value.trim() }) });
      if (!response.ok) throw new Error(`self update failed: ${response.status}`);
      const rows = await response.json();
      const result = Array.isArray(rows) ? rows[0] : rows;
      $('#registration-message').textContent = result?.message || 'บันทึกข้อมูลแล้ว';
      if (result?.saved) { verifiedStudent.full_name = [registrationForm.elements.selfTitle.value, first, last].filter(Boolean).join(' '); panel.hidden = true; }
    } catch (error) { console.warn(error); $('#registration-message').textContent = 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจรูปแบบข้อมูลแล้วลองใหม่'; }
    finally { event.currentTarget.disabled = false; }
  });
  registrationForm.querySelectorAll('.wizard-next').forEach((button) => button.addEventListener('click', async () => {
    const section = wizardSteps[currentStep - 1];
    const invalid = [...section.querySelectorAll('[required]')].find((field) => !field.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    if (currentStep === 1) {
      button.disabled = true;
      try {
        if (!(await verifyStudent())) return;
      } finally {
        button.disabled = false;
      }
    }
    setWizardStep(Math.min(currentStep + 1, 3));
  }));
  registrationForm.querySelectorAll('.wizard-back').forEach((button) => button.addEventListener('click', () => setWizardStep(Math.max(currentStep - 1, 1))));
  $('#registration-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) { event.currentTarget.reportValidity(); return; }
    const form = new FormData(event.currentTarget);
    const message = $('#registration-message');
    if (!apiBase || !apiHeaders) {
      message.textContent = 'ขณะนี้ยังไม่เปิดรับสมัครจริง ระบบจะเปิดให้บันทึกเมื่อเจ้าหน้าที่ประกาศช่วงรับสมัครและเชื่อม API ครบแล้ว';
      return;
    }
    if (!registrationOpen) {
      message.textContent = 'ขณะนี้ยังไม่เปิดรับสมัคร กรุณารอติดตามประกาศจากโรงเรียน';
      return;
    }
    if (!verifiedStudent || !form.identityConfirmed.checked) {
      message.textContent = 'กรุณาค้นเลขประจำตัวและยืนยันว่าข้อมูลทะเบียนเป็นของคุณก่อนส่งใบสมัคร';
      setWizardStep(2);
      return;
    }
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    message.textContent = 'กำลังตรวจสอบข้อมูล…';
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/submit_public_registration_v2`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({
          requested_year: form.get('year'),
          requested_student_number: form.get('studentNumber'),
          requested_full_name: verifiedStudent?.full_name,
          requested_band: form.get('band'),
          requested_level: form.get('level'),
        }),
      });
      if (!response.ok) throw new Error(`registration request failed: ${response.status}`);
      const rows = await response.json();
      const result = Array.isArray(rows) ? rows[0] : rows;
      message.textContent = result?.reference_code
        ? `${result.message} เลขอ้างอิง ${result.reference_code}`
        : (result?.message || 'ระบบไม่สามารถยืนยันผลการสมัครได้');
    } catch (error) {
      console.warn(error);
      message.textContent = 'เชื่อมต่อระบบรับสมัครไม่สำเร็จ กรุณาลองใหม่ภายหลัง';
    } finally {
      submitButton.disabled = false;
    }
  });
  $('#lookup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = $('#lookup-input').value.trim();
    const resultNode = $('#lookup-result');
    if (!query) { resultNode.textContent = 'กรุณากรอกเลขประจำตัวหรือชื่อ-นามสกุล'; return; }
    if (!apiBase || !apiHeaders) {
      resultNode.textContent = 'ยังไม่มีข้อมูลประกาศผู้มีสิทธิ์สอบ ห้องสอบ เลขที่สอบ หรือผลสอบในระบบ';
      return;
    }
    resultNode.textContent = 'กำลังตรวจสอบข้อมูล…';
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/lookup_public_exam_status`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ requested_year: activeAcademicYear, requested_query: query }),
      });
      if (!response.ok) throw new Error(`lookup request failed: ${response.status}`);
      const rows = await response.json();
      if (!rows.length) {
        resultNode.textContent = 'ยังไม่มีข้อมูลประกาศทางการ หรือไม่พบรายการที่ตรงกัน';
        return;
      }
      resultNode.innerHTML = rows.map((row) =>
        `<strong>${escapeHtml(row.full_name)}</strong> · ${escapeHtml(row.dhamma_level)}<br>` +
        `สถานะสิทธิ์สอบ: ${escapeHtml(row.eligibility_status || 'รอข้อมูล')} · ` +
        `ห้องสอบ: ${escapeHtml(row.room_name || 'รอข้อมูล')} · เลขที่สอบ: ${escapeHtml(row.seat_no || 'รอข้อมูล')} · ` +
        `ผลสอบ: ${escapeHtml(row.result_status || 'รอข้อมูล')}${row.score ? ` (${escapeHtml(row.score)})` : ''}`
      ).join('<hr>');
    } catch (error) {
      console.warn(error);
      resultNode.textContent = 'เชื่อมต่อระบบตรวจสอบไม่สำเร็จ กรุณาลองใหม่ภายหลัง';
    }
  });
  loadPublicMetrics();
  loadRegistrationWindow();
})();
