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
  let records = [];
  let toastTimer;

  const normalizeDigits = (value) => String(value ?? '').replace(/[\u0e50-\u0e59]/g, (digit) => '\u0e40\u0e19\u0090\u0e40\u0e19\u2018\u0e40\u0e19\u2019\u0e40\u0e19\u201c\u0e40\u0e19\u201d\u0e40\u0e19\u2022\u0e40\u0e19\u2013\u0e40\u0e19\u2014\u0e40\u0e19\u0098\u0e40\u0e19\u0099'.indexOf(digit));
  const normalize = (value) => normalizeDigits(value).toLocaleLowerCase('th-TH').normalize('NFC').replace(/[\s\-_/\\.]+/g, '');
  const clean = (value) => String(value ?? '').trim();
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const showToast = (message) => { toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2800); };

  const groupRecords = (items) => {
    const grouped = new Map();
    items.forEach((item) => {
      const key = normalize(`${item.firstName} ${item.lastName}`);
      if (!grouped.has(key)) grouped.set(key, { firstName: item.firstName, lastName: item.lastName, records: [] });
      grouped.get(key).records.push(item);
    });
    return [...grouped.values()];
  };

  const render = (query = '') => {
    const needle = normalize(query);
    results.replaceChildren();
    if (!needle) { count.textContent = ''; emptyState.hidden = false; status.textContent = '\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e04\u0e49\u0e19\u0e2b\u0e32'; return; }
    const matches = records.filter((item) => [item.certificateNo, item.firstName, item.lastName, item.fullName, item.level, item.educationLevel, item.examYear].some((value) => normalize(value).includes(needle)));
    const people = groupRecords(matches);
    emptyState.hidden = people.length > 0;
    count.textContent = `${matches.length.toLocaleString('th-TH')} \u0e43\u0e1a\u0e1b\u0e23\u0e30\u0e01\u0e32\u0e28 \u00b7 ${people.length.toLocaleString('th-TH')} \u0e04\u0e19`;
    status.textContent = people.length ? '\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e19' : '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e17\u0e35\u0e48\u0e15\u0e23\u0e07\u0e01\u0e31\u0e19';
    people.forEach((person) => {
      const article = document.createElement('article');
      article.className = 'result-card';
      const rows = person.records.sort((a, b) => String(b.examYear).localeCompare(String(a.examYear))).map((item) => `<div class="record-row"><div class="record-field"><small>\u0e40\u0e19\u20ac\u0e40\u0e18\u0e05\u0e40\u0e18\u0082\u0e40\u0e19\u0083\u0e40\u0e18\u009a\u0e40\u0e18\u009b\u0e40\u0e18\u0e03\u0e40\u0e18\u0e10\u0e40\u0e18\u0081\u0e40\u0e18\u0e12\u0e40\u0e18\u0e08</small><strong>${escapeHtml(item.certificateNo || '-')}</strong></div><div class="record-field"><small>\u0e40\u0e18\u0e03\u0e40\u0e18\u0e10\u0e40\u0e18\u201d\u0e40\u0e18\u0e11\u0e40\u0e18\u009a\u0e40\u0e18\u2014\u0e40\u0e18\u0e15\u0e40\u0e19\u0088\u0e40\u0e18\u0e0a\u0e40\u0e18\u0e0d\u0e40\u0e18\u009a\u0e40\u0e19\u0084\u0e40\u0e18\u201d\u0e40\u0e19\u0089</small><strong>${escapeHtml(item.level || '-')}</strong></div><div class="record-field"><small>\u0e40\u0e18\u009b\u0e40\u0e18\u0e15\u0e40\u0e18\u0081\u0e40\u0e18\u0e12\u0e40\u0e18\u0e03\u0e40\u0e18\u0e08\u0e40\u0e18\u0e16\u0e40\u0e18\u0081\u0e40\u0e18\u0e09\u0e40\u0e18\u0e12</small><strong>${escapeHtml(item.examYear || '-')}</strong></div><span class="level-badge">${escapeHtml(item.educationLevel || '\u0e40\u0e18\u0098\u0e40\u0e18\u0e03\u0e40\u0e18\u0e03\u0e40\u0e18\u0e01\u0e40\u0e18\u0e08\u0e40\u0e18\u0e16\u0e40\u0e18\u0081\u0e40\u0e18\u0e09\u0e40\u0e18\u0e12')}</span></div>`).join('');
      article.innerHTML = `<div class="person-summary"><div><p class="person-label">\u0e40\u0e18\u009c\u0e40\u0e18\u0e19\u0e40\u0e19\u0089\u0e40\u0e18\u009c\u0e40\u0e19\u0088\u0e40\u0e18\u0e12\u0e40\u0e18\u0099\u0e40\u0e18\u0098\u0e40\u0e18\u0e03\u0e40\u0e18\u0e03\u0e40\u0e18\u0e01\u0e40\u0e18\u0e08\u0e40\u0e18\u0e16\u0e40\u0e18\u0081\u0e40\u0e18\u0e09\u0e40\u0e18\u0e12</p><h2 class="person-name">${escapeHtml(person.firstName)} <span>${escapeHtml(person.lastName)}</span></h2></div><span class="record-count">${person.records.length} \u0e40\u0e18\u0e03\u0e40\u0e18\u0e12\u0e40\u0e18\u0e02\u0e40\u0e18\u0081\u0e40\u0e18\u0e12\u0e40\u0e18\u0e03</span></div><div class="records-list">${rows}</div><div class="card-actions"><button class="download-button" type="button">\u0e40\u0e18\u201d\u0e40\u0e18\u0e12\u0e40\u0e18\u0e07\u0e40\u0e18\u0099\u0e40\u0e19\u008c\u0e40\u0e19\u0082\u0e40\u0e18\u0e0b\u0e40\u0e18\u0e05\u0e40\u0e18\u201d\u0e40\u0e19\u20ac\u0e40\u0e18\u009b\u0e40\u0e19\u0087\u0e40\u0e18\u0099\u0e40\u0e18\u00a0\u0e40\u0e18\u0e12\u0e40\u0e18\u009e\u0e40\u0e18\u0e0a\u0e40\u0e18\u0e13\u0e40\u0e18\u0e0b\u0e40\u0e18\u0e03\u0e40\u0e18\u0e11\u0e40\u0e18\u009a\u0e40\u0e19\u0082\u0e40\u0e18\u2014\u0e40\u0e18\u0e03\u0e40\u0e18\u0e08\u0e40\u0e18\u0e11\u0e40\u0e18\u009e\u0e40\u0e18\u2014\u0e40\u0e19\u008c \u0e42\u0086\u201c</button></div>`;
      article.querySelector('.download-button').addEventListener('click', async () => {
        if (!window.html2canvas) return showToast('\u0e40\u0e18\u0081\u0e40\u0e18\u0e13\u0e40\u0e18\u0e05\u0e40\u0e18\u0e11\u0e40\u0e18\u0087\u0e40\u0e19\u20ac\u0e40\u0e18\u2022\u0e40\u0e18\u0e03\u0e40\u0e18\u0e15\u0e40\u0e18\u0e02\u0e40\u0e18\u0e01\u0e40\u0e19\u20ac\u0e40\u0e18\u0084\u0e40\u0e18\u0e03\u0e40\u0e18\u0e17\u0e40\u0e19\u0088\u0e40\u0e18\u0e0d\u0e40\u0e18\u0087\u0e40\u0e18\u0e01\u0e40\u0e18\u0e17\u0e40\u0e18\u0e0d\u0e40\u0e18\u201d\u0e40\u0e18\u0e12\u0e40\u0e18\u0e07\u0e40\u0e18\u0099\u0e40\u0e19\u008c\u0e40\u0e19\u0082\u0e40\u0e18\u0e0b\u0e40\u0e18\u0e05\u0e40\u0e18\u201d \u0e40\u0e18\u0e05\u0e40\u0e18\u0e0d\u0e40\u0e18\u0087\u0e40\u0e18\u0e0d\u0e40\u0e18\u0e15\u0e40\u0e18\u0081\u0e40\u0e18\u0084\u0e40\u0e18\u0e03\u0e40\u0e18\u0e11\u0e40\u0e19\u0089\u0e40\u0e18\u0087');
        showToast('\u0e40\u0e18\u0081\u0e40\u0e18\u0e13\u0e40\u0e18\u0e05\u0e40\u0e18\u0e11\u0e40\u0e18\u0087\u0e40\u0e18\u0e0a\u0e40\u0e18\u0e03\u0e40\u0e19\u0089\u0e40\u0e18\u0e12\u0e40\u0e18\u0087\u0e40\u0e18\u00a0\u0e40\u0e18\u0e12\u0e40\u0e18\u009e\u0e40\u0e18\u0e0a\u0e40\u0e18\u0e13\u0e40\u0e18\u0e0b\u0e40\u0e18\u0e03\u0e40\u0e18\u0e11\u0e40\u0e18\u009a\u0e40\u0e18\u009a\u0e40\u0e18\u0e11\u0e40\u0e18\u0099\u0e40\u0e18\u2014\u0e40\u0e18\u0e16\u0e40\u0e18\u0081...');
        const canvas = await html2canvas(article, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
        const link = document.createElement('a');
        link.download = `certificate-${clean(person.firstName)}-${clean(person.lastName)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('\u0e40\u0e18\u201d\u0e40\u0e18\u0e12\u0e40\u0e18\u0e07\u0e40\u0e18\u0099\u0e40\u0e19\u008c\u0e40\u0e19\u0082\u0e40\u0e18\u0e0b\u0e40\u0e18\u0e05\u0e40\u0e18\u201d\u0e40\u0e18\u00a0\u0e40\u0e18\u0e12\u0e40\u0e18\u009e\u0e40\u0e19\u20ac\u0e40\u0e18\u0e03\u0e40\u0e18\u0e15\u0e40\u0e18\u0e02\u0e40\u0e18\u009a\u0e40\u0e18\u0e03\u0e40\u0e19\u0089\u0e40\u0e18\u0e0d\u0e40\u0e18\u0e02\u0e40\u0e19\u0081\u0e40\u0e18\u0e05\u0e40\u0e19\u0089\u0e40\u0e18\u0e07');
      });
      results.append(article);
    });
  };

  const mapRecord = (item, key) => ({
    id: key,
    certificateNo: clean(item.certificateNo),
    firstName: clean(item.firstName),
    lastName: clean(item.lastName),
    fullName: clean(item.fullName),
    level: clean(item.level),
    educationLevel: clean(item.educationLevel),
    examYear: clean(item.examYear),
    receivedDate: clean(item.receivedDate),
    note: clean(item.note)
  });

  const start = () => {
    if (!window.APP_CONFIG?.firebase?.projectId) { status.textContent = '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e10\u0e32\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25'; return; }
    try {
      firebase.initializeApp(window.APP_CONFIG.firebase);
      firebase.database().ref('certificates').on('value', (snapshot) => {
        const raw = snapshot.val() || {};
        records = Object.entries(raw).map(([key, item]) => mapRecord(item, key)).filter((item) => item.certificateNo || item.firstName || item.lastName);
        status.textContent = `\u0e10\u0e32\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19 \u00b7 ${records.length.toLocaleString('th-TH')} \u0e23\u0e32\u0e22\u0e01\u0e32\u0e23`;
        if (input.value) render(input.value);
      }, () => { status.textContent = '\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e10\u0e32\u0e19\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08'; });
    } catch (error) { console.error(error); status.textContent = '\u0e23\u0e30\u0e1a\u0e1a\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e43\u0e0a\u0e49\u0e07\u0e32\u0e19'; }
  };

  form.addEventListener('submit', (event) => { event.preventDefault(); render(input.value); input.blur(); });
  input.addEventListener('input', () => { clearButton.hidden = !input.value; render(input.value); });
  clearButton.addEventListener('click', () => { input.value = ''; clearButton.hidden = true; render(); input.focus(); });
  start();
})();

