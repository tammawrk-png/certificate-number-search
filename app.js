(() => {
  const $ = (selector) => document.querySelector(selector);
  const form = $('#search-form');
  const input = $('#search-input');
  const clearButton = $('#clear-button');
  const status = $('#status');
  const count = $('#results-count');
  const results = $('#results');
  const emptyState = $('#empty-state');
  const toast = $('#toast');
  const modal = $('#modal');
  const modalContent = $('#modal-content');
  let allRecords = [];
  let toastTimer;

  const normalizeDigits = (value) => String(value ?? '').replace(/[๐-๙]/g, (digit) => '๐๑๒๓๔๕๖๗๘๙'.indexOf(digit));
  const normalize = (value) => normalizeDigits(value).toLocaleLowerCase('th-TH').normalize('NFC').replace(/[\s\-_/\\.]+/g, '');
  const clean = (value) => String(value ?? '').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const showToast = (message) => { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); };

  const closeModal = () => { modal.hidden = true; modalContent.replaceChildren(); };
  document.addEventListener('click', (event) => { if (event.target.matches('[data-close-modal]')) closeModal(); });

  const groupRecords = (records) => {
    const grouped = new Map();
    records.forEach((record) => {
      const key = normalize(`${record.firstName} ${record.lastName}`);
      if (!grouped.has(key)) grouped.set(key, { firstName: record.firstName, lastName: record.lastName, records: [] });
      grouped.get(key).records.push(record);
    });
    return [...grouped.values()].sort((a, b) => normalize(`${a.firstName}${a.lastName}`).localeCompare(normalize(`${b.firstName}${b.lastName}`), 'th'));
  };

  const render = (query = '') => {
    const needle = normalize(query);
    results.replaceChildren();
    if (!needle) { count.textContent = ''; emptyState.hidden = false; status.textContent = 'พร้อมค้นหา'; return; }
    const matches = allRecords.filter((record) => [record.certificateNo, record.firstName, record.lastName, record.fullName, record.level, record.educationLevel, record.examYear].some((value) => normalize(value).includes(needle)));
    const groups = groupRecords(matches);
    emptyState.hidden = groups.length > 0;
    count.textContent = `${matches.length.toLocaleString('th-TH')} ใบประกาศ · ${groups.length.toLocaleString('th-TH')} คน`;
    status.textContent = groups.length ? 'พบข้อมูลที่ตรงกัน' : 'ไม่พบข้อมูลที่ตรงกัน ลองค้นด้วยคำที่สั้นลง';
    groups.forEach((person) => {
      const article = document.createElement('article'); article.className = 'result-card';
      const recordsHtml = person.records.sort((a, b) => String(b.examYear).localeCompare(String(a.examYear))).map((record) => `<div class="record-row"><div class="record-field"><small>เลขใบประกาศ</small><strong>${escapeHtml(record.certificateNo || '-')}</strong></div><div class="record-field"><small>ระดับที่สอบได้</small><strong>${escapeHtml(record.level || '-')}</strong></div><div class="record-field"><small>ปีการศึกษา</small><strong>${escapeHtml(record.examYear || '-')}</strong></div><span class="level-badge">${escapeHtml(record.educationLevel || 'ธรรมศึกษา')}</span></div>`).join('');
      article.innerHTML = `<div class="person-summary"><div><p class="person-label">ผู้ผ่านธรรมศึกษา</p><h2 class="person-name">${escapeHtml(person.firstName)} <span>${escapeHtml(person.lastName)}</span></h2></div><span class="record-count">${person.records.length} รายการ</span></div><div class="records-list">${recordsHtml}</div><div class="card-actions"><button class="download-button" type="button" data-download>ดาวน์โหลดเป็นภาพสำหรับโทรศัพท์ ↓</button></div>`;
      article.querySelector('[data-download]').addEventListener('click', () => downloadCard(article, person));
      results.append(article);
    });
  };

  const downloadCard = async (article, person) => {
    if (!window.html2canvas) { showToast('กำลังเตรียมเครื่องมือดาวน์โหลด ลองอีกครั้ง'); return; }
    showToast('กำลังสร้างภาพสำหรับบันทึก…');
    const canvas = await html2canvas(article, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const link = document.createElement('a'); link.download = `ใบประกาศ-${clean(person.firstName)}-${clean(person.lastName)}.png`; link.href = canvas.toDataURL('image/png'); link.click(); showToast('ดาวน์โหลดภาพเรียบร้อยแล้ว');
  };

  const mapRecord = (item, key) => ({
    id: key,
    certificateNo: clean(item.certificateNo ?? item.number ?? item.เลขที่),
    firstName: clean(item.firstName ?? item.name ?? item.ชื่อ),
    lastName: clean(item.lastName ?? item.surname ?? item.สกุล),
    fullName: clean(item.fullName),
    level: clean(item.level ?? item.ระดับที่สอบไล่ได้),
    educationLevel: clean(item.educationLevel ?? item.education ?? item.ระดับการศึกษา),
    examYear: clean(item.examYear ?? item.year ?? item.ประจำปี),
    signature: clean(item.signature ?? item.ลายมือชื่อ),
    receivedDate: clean(item.receivedDate ?? item.วันที่รับ ?? item['ว/ด/ป ที่รับ']),
    note: clean(item.note ?? item.หมายเหตุ)
  });

  const start = async () => {
    if (!window.APP_CONFIG?.firebase?.projectId || window.APP_CONFIG.firebase.projectId === 'เติมค่า') { status.textContent = 'ยังไม่ได้เชื่อมต่อฐานข้อมูล'; emptyState.hidden = false; return; }
    try {
      firebase.initializeApp(window.APP_CONFIG.firebase);
      firebase.database().ref('certificates').on('value', (snapshot) => {
        const raw = snapshot.val() || {};
        allRecords = Object.entries(raw).map(([key, item]) => mapRecord(item, key)).filter((item) => item.certificateNo || item.firstName || item.lastName);
        status.textContent = `ฐานข้อมูลพร้อมใช้งาน · ${allRecords.length.toLocaleString('th-TH')} รายการ`;
        if (input.value) render(input.value);
      }, () => { status.textContent = 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ'; showToast('ไม่สามารถเชื่อมต่อฐานข้อมูลได้ในขณะนี้'); });
    } catch (error) { console.error(error); status.textContent = 'ระบบยังไม่พร้อมใช้งาน'; }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); render(input.value); input.blur(); });
  input.addEventListener('input', () => { clearButton.hidden = !input.value; render(input.value); });
  clearButton.addEventListener('click', () => { input.value = ''; clearButton.hidden = true; render(); input.focus(); });
  start();
})();
