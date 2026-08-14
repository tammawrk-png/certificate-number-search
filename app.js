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

  const normalizeDigits = (value) => String(value ?? '').replace(/[เน-เน]/g, (digit) => 'เนเน‘เน’เน“เน”เน•เน–เน—เนเน'.indexOf(digit));
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
    if (!needle) { count.textContent = ''; emptyState.hidden = false; status.textContent = 'เธเธฃเนเธญเธกเธเนเธเธซเธฒ'; return; }
    const matches = allRecords.filter((record) => [record.certificateNo, record.firstName, record.lastName, record.fullName, record.level, record.educationLevel, record.examYear].some((value) => normalize(value).includes(needle)));
    const groups = groupRecords(matches);
    emptyState.hidden = groups.length > 0;
    count.textContent = `${matches.length.toLocaleString('th-TH')} เนเธเธเธฃเธฐเธเธฒเธจ ยท ${groups.length.toLocaleString('th-TH')} เธเธ`;
    status.textContent = groups.length ? 'เธเธเธเนเธญเธกเธนเธฅเธ—เธตเนเธ•เธฃเธเธเธฑเธ' : 'เนเธกเนเธเธเธเนเธญเธกเธนเธฅเธ—เธตเนเธ•เธฃเธเธเธฑเธ เธฅเธญเธเธเนเธเธ”เนเธงเธขเธเธณเธ—เธตเนเธชเธฑเนเธเธฅเธ';
    groups.forEach((person) => {
      const article = document.createElement('article'); article.className = 'result-card';
      const recordsHtml = person.records.sort((a, b) => String(b.examYear).localeCompare(String(a.examYear))).map((record) => `<div class="record-row"><div class="record-field"><small>เน€เธฅเธเนเธเธเธฃเธฐเธเธฒเธจ</small><strong>${escapeHtml(record.certificateNo || '-')}</strong></div><div class="record-field"><small>เธฃเธฐเธ”เธฑเธเธ—เธตเนเธชเธญเธเนเธ”เน</small><strong>${escapeHtml(record.level || '-')}</strong></div><div class="record-field"><small>เธเธตเธเธฒเธฃเธจเธถเธเธฉเธฒ</small><strong>${escapeHtml(record.examYear || '-')}</strong></div><span class="level-badge">${escapeHtml(record.educationLevel || 'เธเธฃเธฃเธกเธจเธถเธเธฉเธฒ')}</span></div>`).join('');
      article.innerHTML = `<div class="person-summary"><div><p class="person-label">เธเธนเนเธเนเธฒเธเธเธฃเธฃเธกเธจเธถเธเธฉเธฒ</p><h2 class="person-name">${escapeHtml(person.firstName)} <span>${escapeHtml(person.lastName)}</span></h2></div><span class="record-count">${person.records.length} เธฃเธฒเธขเธเธฒเธฃ</span></div><div class="records-list">${recordsHtml}</div><div class="card-actions"><button class="download-button" type="button" data-download>เธ”เธฒเธงเธเนเนเธซเธฅเธ”เน€เธเนเธเธ เธฒเธเธชเธณเธซเธฃเธฑเธเนเธ—เธฃเธจเธฑเธเธ—เน โ“</button></div>`;
      article.querySelector('[data-download]').addEventListener('click', () => downloadCard(article, person));
      results.append(article);
    });
  };

  const downloadCard = async (article, person) => {
    if (!window.html2canvas) { showToast('เธเธณเธฅเธฑเธเน€เธ•เธฃเธตเธขเธกเน€เธเธฃเธทเนเธญเธเธกเธทเธญเธ”เธฒเธงเธเนเนเธซเธฅเธ” เธฅเธญเธเธญเธตเธเธเธฃเธฑเนเธ'); return; }
    showToast('เธเธณเธฅเธฑเธเธชเธฃเนเธฒเธเธ เธฒเธเธชเธณเธซเธฃเธฑเธเธเธฑเธเธ—เธถเธโ€ฆ');
    const canvas = await html2canvas(article, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const link = document.createElement('a'); link.download = `เนเธเธเธฃเธฐเธเธฒเธจ-${clean(person.firstName)}-${clean(person.lastName)}.png`; link.href = canvas.toDataURL('image/png'); link.click(); showToast('เธ”เธฒเธงเธเนเนเธซเธฅเธ”เธ เธฒเธเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง');
  };

  const mapRecord = (item, key) => ({
    id: key,
    certificateNo: clean(item.certificateNo ?? item.number ?? item.เน€เธฅเธเธ—เธตเน),
    firstName: clean(item.firstName ?? item.name ?? item.เธเธทเนเธญ),
    lastName: clean(item.lastName ?? item.surname ?? item.เธชเธเธธเธฅ),
    fullName: clean(item.fullName),
    level: clean(item.level ?? item.เธฃเธฐเธ”เธฑเธเธ—เธตเนเธชเธญเธเนเธฅเนเนเธ”เน),
    educationLevel: clean(item.educationLevel ?? item.education ?? item.เธฃเธฐเธ”เธฑเธเธเธฒเธฃเธจเธถเธเธฉเธฒ),
    examYear: clean(item.examYear ?? item.year ?? item.เธเธฃเธฐเธเธณเธเธต),
    signature: clean(item.signature ?? item.เธฅเธฒเธขเธกเธทเธญเธเธทเนเธญ),
    receivedDate: clean(item.receivedDate ?? item.เธงเธฑเธเธ—เธตเนเธฃเธฑเธ ?? item['เธง/เธ”/เธ เธ—เธตเนเธฃเธฑเธ']),
    note: clean(item.note ?? item.เธซเธกเธฒเธขเน€เธซเธ•เธธ)
  });

  const start = async () => {
    if (!window.APP_CONFIG?.firebase?.projectId || window.APP_CONFIG.firebase.projectId === 'เน€เธ•เธดเธกเธเนเธฒ') { status.textContent = 'เธขเธฑเธเนเธกเนเนเธ”เนเน€เธเธทเนเธญเธกเธ•เนเธญเธเธฒเธเธเนเธญเธกเธนเธฅ'; emptyState.hidden = false; return; }
    try {
      firebase.initializeApp(window.APP_CONFIG.firebase);
      firebase.database().ref('certificates').on('value', (snapshot) => {
        const raw = snapshot.val() || {};
        allRecords = Object.entries(raw).map(([key, item]) => mapRecord(item, key)).filter((item) => item.certificateNo || item.firstName || item.lastName);
        status.textContent = `เธเธฒเธเธเนเธญเธกเธนเธฅเธเธฃเนเธญเธกเนเธเนเธเธฒเธ ยท ${allRecords.length.toLocaleString('th-TH')} เธฃเธฒเธขเธเธฒเธฃ`;
        if (input.value) render(input.value);
      }, () => { status.textContent = 'เน€เธเธทเนเธญเธกเธ•เนเธญเธเธฒเธเธเนเธญเธกเธนเธฅเนเธกเนเธชเธณเน€เธฃเนเธ'; showToast('เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เน€เธเธทเนเธญเธกเธ•เนเธญเธเธฒเธเธเนเธญเธกเธนเธฅเนเธ”เนเนเธเธเธ“เธฐเธเธตเน'); });
    } catch (error) { console.error(error); status.textContent = 'เธฃเธฐเธเธเธขเธฑเธเนเธกเนเธเธฃเนเธญเธกเนเธเนเธเธฒเธ'; }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); render(input.value); input.blur(); });
  input.addEventListener('input', () => { clearButton.hidden = !input.value; render(input.value); });
  clearButton.addEventListener('click', () => { input.value = ''; clearButton.hidden = true; render(); input.focus(); });
  start();
})();
