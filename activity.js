(() => {
  const $ = (selector) => document.querySelector(selector);
  const config = window.APP_CONFIG?.supabase;
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
    if (!config?.url || !config?.publishableKey) {
      state.textContent = 'รอเชื่อมต่อ API สาธารณะ';
      return;
    }
    try {
      const response = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/rpc/public_dashboard_metrics`, {
        method: 'POST',
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
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
  $('#registration-form').addEventListener('submit', (event) => {
    event.preventDefault();
    $('#registration-message').textContent = 'ขณะนี้ยังไม่เปิดรับสมัครจริง ระบบจะเปิดให้บันทึกเมื่อเจ้าหน้าที่ประกาศช่วงรับสมัครและเชื่อม API ครบแล้ว';
  });
  $('#lookup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = $('#lookup-input').value.trim();
    $('#lookup-result').textContent = query
      ? 'ยังไม่มีข้อมูลประกาศผู้มีสิทธิ์สอบ ห้องสอบ เลขที่สอบ หรือผลสอบในระบบ'
      : 'กรุณากรอกเลขประจำตัวหรือชื่อ-นามสกุล';
  });
  loadPublicMetrics();
})();
