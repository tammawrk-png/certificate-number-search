(() => {
  const status = document.querySelector('#status');
  const results = document.querySelector('#results');
  const form = document.querySelector('#search-form');

  const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('th-TH').replace(/[\s-]/g, '');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

  if (!window.APP_CONFIG?.firebase?.projectId || window.APP_CONFIG.firebase.projectId === 'เติมค่า') {
    status.textContent = 'ยังไม่ได้ตั้งค่า Firebase: คัดลอก config.example.js เป็น config.js แล้วเติมค่าจาก Firebase Console';
    return;
  }

  firebase.initializeApp(window.APP_CONFIG.firebase);
  const certificatesRef = firebase.database().ref('certificates');
  status.textContent = 'พร้อมค้นหา';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    results.replaceChildren();
    status.textContent = 'กำลังค้นหา…';
    const query = normalize(new FormData(form).get('query'));
    try {
      const snapshot = await certificatesRef.once('value');
      const matches = Object.values(snapshot.val() || {}).filter((item) =>
        [item.certificateNo, item.searchKey, item.fullName, item.school].some((value) => normalize(value).includes(query))
      );
      status.textContent = matches.length ? `พบ ${matches.length} รายการ` : 'ไม่พบข้อมูลที่ตรงกัน';
      matches.forEach((item) => {
        const article = document.createElement('article');
        article.className = 'result';
        article.innerHTML = `<h2>${escapeHtml(item.certificateNo || 'ไม่ระบุเลขใบประกาศ')}</h2><dl><dt>ชื่อผู้สอบ</dt><dd>${escapeHtml(item.fullName)}</dd><dt>สถานศึกษา</dt><dd>${escapeHtml(item.school)}</dd><dt>ระดับ</dt><dd>${escapeHtml(item.level)}</dd><dt>ปีการศึกษา</dt><dd>${escapeHtml(item.examYear)}</dd></dl>${item.documentUrl ? `<a href="${escapeHtml(item.documentUrl)}" target="_blank" rel="noopener">เปิดเอกสาร</a>` : ''}`;
        results.append(article);
      });
    } catch (error) {
      console.error(error);
      status.textContent = 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาตรวจสอบ Firebase config และ Security Rules';
    }
  });
})();
