(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.APP_CONFIG?.supabase;
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
  const registrationForm = $('#registration-form');
  const wizardSteps = [...registrationForm.querySelectorAll('.wizard-step')];
  const stepIndicators = [...document.querySelectorAll('[data-step-indicator]')];
  let currentStep = 1;
  const summaryLabels = { year: 'ปีการศึกษา', band: 'สายการศึกษา', level: 'ระดับธรรมศึกษา', studentNumber: 'เลขประจำตัวนักเรียน', fullName: 'ชื่อ-นามสกุล' };
  const selectedText = (name) => registrationForm.elements[name]?.selectedOptions?.[0]?.textContent || registrationForm.elements[name]?.value || '';
  const updateSummary = () => {
    const values = {
      year: selectedText('year'), band: selectedText('band'), level: selectedText('level'),
      studentNumber: registrationForm.elements.studentNumber.value.trim(), fullName: registrationForm.elements.fullName.value.trim(),
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
  registrationForm.querySelectorAll('.wizard-next').forEach((button) => button.addEventListener('click', () => {
    const section = wizardSteps[currentStep - 1];
    const invalid = [...section.querySelectorAll('[required]')].find((field) => !field.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    if (currentStep === 2) {
      const preview = $('#identity-preview');
      preview.hidden = false;
      preview.textContent = 'ข้อมูลจะถูกตรวจสอบกับทะเบียนโรงเรียนอีกครั้งเมื่อกดส่งใบสมัคร';
    }
    setWizardStep(Math.min(currentStep + 1, 3));
  }));
  registrationForm.querySelectorAll('.wizard-back').forEach((button) => button.addEventListener('click', () => setWizardStep(Math.max(currentStep - 1, 1))));
  $('#registration-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!event.currentTarget.checkValidity()) { event.currentTarget.reportValidity(); return; }
    const message = $('#registration-message');
    if (!apiBase || !apiHeaders) {
      message.textContent = 'ขณะนี้ยังไม่เปิดรับสมัครจริง ระบบจะเปิดให้บันทึกเมื่อเจ้าหน้าที่ประกาศช่วงรับสมัครและเชื่อม API ครบแล้ว';
      return;
    }
    const form = new FormData(event.currentTarget);
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    message.textContent = 'กำลังตรวจสอบข้อมูล…';
    try {
      const response = await fetch(`${apiBase}/rest/v1/rpc/submit_public_registration`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({
          requested_year: form.get('year'),
          requested_student_number: form.get('studentNumber'),
          requested_full_name: form.get('fullName'),
          requested_band: form.get('band'),
          requested_level: form.get('level'),
        }),
      });
      if (!response.ok) throw new Error(`registration request failed: ${response.status}`);
      const rows = await response.json();
      const result = Array.isArray(rows) ? rows[0] : rows;
      message.textContent = result?.message || 'ระบบไม่สามารถยืนยันผลการสมัครได้';
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
        body: JSON.stringify({ requested_year: '2569', requested_query: query }),
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
})();
