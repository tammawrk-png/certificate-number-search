(() => {
  const $ = (selector) => document.querySelector(selector);
  const levelCode = { ตรี:'tri', โท:'tho', เอก:'ek' };
  const grades = ['1','2','3','4','5','6','higher'];
  const rooms = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','higher'];
  const demoStudents = {
    '1:1': [
      { number:'10001', name:'เด็กชาย สมชาย ใจดี', birth_iso:'2013-03-15', education:'มัธยม', previous:'', citizen:'', application_level:'ตรี', advisor_1:'ครูตัวอย่าง หนึ่ง', advisor_2:'ครูตัวอย่าง สอง' },
      { number:'10002', name:'เด็กหญิง มาลี รักเรียน', birth_iso:'2012-08-20', education:'มัธยม', previous:'TR-2568-001', citizen:'', application_level:'ตรี', advisor_1:'ครูตัวอย่าง หนึ่ง', advisor_2:'ครูตัวอย่าง สอง' },
    ],
    '4:2': [{ number:'40001', name:'นาย วิทยา ตั้งใจ', birth_iso:'2009-01-02', education:'มัธยม', previous:'TR-2567-009', citizen:'', application_level:'โท', advisor_1:'ครูตัวอย่าง สาม', advisor_2:'ครูตัวอย่าง สี่' }],
  };
  const state = { grade:'1', room:'1', level:'ตรี', rows:[] };
  const access = { role:'', code:'', studentNumber:'' };
  const adminRequested = new URLSearchParams(location.search).get('admin') === '1';
  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hashParams.get('access_token')) { sessionStorage.setItem('dharma_staff_access_token', hashParams.get('access_token')); history.replaceState({}, '', `${location.pathname}?admin=1`); }
  const staffToken = sessionStorage.getItem('dharma_staff_access_token') || '';
  let pendingPrint = '';
  const storageKey = () => `dharma-direct-form-v3:${state.grade}:${state.room}`;
  const rosterOverrideKey = 'dharma-roster-overrides-2569-v1';
  let rosterRows = [];
  const configuredSupabase = window.APP_CONFIG?.supabase || {};
  const supabaseUrl = (configuredSupabase.url || 'https://jmlcsrmrtghmnpdpfdcf.supabase.co').replace(/\/$/, '');
  // This is a publishable Supabase key. Never put a service-role key in a public page.
  const supabaseKey = configuredSupabase.publishableKey || 'sb_publishable_ZyZtx2b_wS6XA-PmN5L5cQ_J6WiYrJG';
  const demoMode = ['localhost', '127.0.0.1'].includes(location.hostname);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const thaiDigits = (value) => String(value ?? '').replace(/[๐-๙]/g, (c) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
  const normalizeDigits = (value) => thaiDigits(value).replace(/\D/g, '');
  const validThaiId = (value) => {
    const digits = normalizeDigits(value);
    if (!/^\d{13}$/.test(digits) || /^(\d)\1{12}$/.test(digits)) return false;
    let sum = 0;
    for (let index = 0; index < 12; index += 1) sum += Number(digits[index]) * (13 - index);
    return ((11 - (sum % 11)) % 10) === Number(digits[12]);
  };
  const citizenState = (value) => {
    const digits = normalizeDigits(value);
    if (!digits) return '';
    if (digits.length < 13) return 'incomplete';
    return validThaiId(digits) ? 'valid' : 'invalid';
  };
  // Keep the incomplete state separate from the legacy `.incomplete` rule.
  // The old stylesheet used that class for a warning overlay that hid the
  // input value, which made partially entered IDs appear to disappear.
  const citizenVisualClass = (status) => status === 'incomplete' ? 'citizen-incomplete' : status;
  const formatThaiDate = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${Number(year) + 543}`;
  };
  const gradeLabel = (value) => value === 'higher' ? 'อุดมศึกษา' : `ม.${value}`;
  const roomLabel = (value) => value === 'higher' ? 'ห้องอุดม' : `ห้อง ${value}`;
  const gradeRecommendation = () => ({ '1':'ตรี', '4':'ตรี' }[state.grade] || '');
  const nextLevel = { ตรี:'โท', โท:'เอก' };
  const recommendationFor = (row) => {
    const byGrade = gradeRecommendation();
    if (byGrade) return { level:byGrade, basis:'ตามชั้นเริ่มต้น' };
    if (row.match_status === 'auto_matched' && nextLevel[row.legacy_level]) return { level:nextLevel[row.legacy_level], basis:`ต่อจากเดิมชั้น${row.legacy_level}` };
    return { level:'', basis:'ต้องตรวจสอบใบประกาศเดิมก่อน' };
  };
  const suggestedLevel = () => recommendationFor({}).level;
  const requiresPreviousYear = (rowOrLevel) => {
    const level = typeof rowOrLevel === 'string' ? rowOrLevel : rowOrLevel?.application_level;
    return level === 'โท' || level === 'เอก';
  };
  const hasPreviousCertificate = (row) => Boolean(
    String(row.previous || '').trim()
      && (!requiresPreviousYear(row) || /^25\d{2}$/.test(String(row.previous_certificate_year || '').trim()))
  );
  const canSkipExam = (row) => Boolean(row.special_needs || hasPreviousCertificate(row));
  const setStatus = (text, color = '') => { $('#save-status').textContent = text; if (color) $('#save-status').style.color = color; };
  const rosterEdits = () => { try { return JSON.parse(localStorage.getItem(rosterOverrideKey) || '{"overrides":{},"extras":[]}'); } catch { return { overrides:{}, extras:[] }; } };
  const studentsForRoom = () => {
    if (!rosterRows.length) return demoMode ? (demoStudents[`${state.grade}:${state.room}`] || []) : [];
    const edits = rosterEdits();
    const base = rosterRows.map((student) => {
      const override = edits.overrides?.[student.number] || {};
      return {
        ...student,
        ...override,
        ...(student.match_status === 'auto_matched' && String(student.previous || '').trim() && !String(override.previous || '').trim()
          ? { previous: student.previous, legacy_level: student.legacy_level, match_status: student.match_status }
          : {}),
      };
    }).filter((student) => String(student.grade) === state.grade && String(student.room) === state.room);
    return base.concat((edits.extras || []).filter((student) => String(student.grade) === state.grade && String(student.room) === state.room));
  };
  const loadRows = () => {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}');
    state.rows = studentsForRoom().map((student) => ({
      organization_name:'โรงเรียนวัดไร่ขิงวิทยา', organization_location:'ไร่ขิง / สามพราน / นครปฐม', temple_affiliation:'วัดไร่ขิงพระอารามหลวง', school_council:'คณะจังหวัดนครปฐม', notes:'', special_needs:false, exam_status:'', ...student,
      ...saved[student.number],
      ...(student.match_status === 'auto_matched' && String(student.previous || '').trim() && !String(saved[student.number]?.previous || '').trim()
        ? { previous: student.previous, legacy_level: student.legacy_level, match_status: student.match_status }
        : {}),
    })).map((row) => { if (row.exam_status === 'not_exam' && !canSkipExam(row)) row.exam_status = ''; return row; });
  };
  const rowComplete = (row) => Boolean(validThaiId(row.citizen) && row.birth_iso && row.application_level && (row.exam_status === 'exam' || (row.exam_status === 'not_exam' && canSkipExam(row))));
  const fieldClass = (row) => citizenState(row.citizen);
  const requiredMarker = (label) => `<span class="required-marker" title="${esc(label)}" aria-label="${esc(label)}">!</span>`;
  const valueOrInput = ({ value, field, placeholder, label, type = 'text', inputmode = '' }) => `<span class="field-shell ${value ? 'has-value' : 'needs-input'}">${value ? '' : requiredMarker(label)}<input class="minimal-field ${value ? 'has-value' : ''}" data-field="${field}" type="${type}" value="${esc(value || '')}" ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(placeholder)}" aria-label="${esc(label)}" /></span>`;
  const option = (value, label, current, recommendation = '') => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}${recommendation === value ? ' · แนะนำ' : ''}</option>`;
  const render = () => {
    const students = state.rows;
    $('#room-label').value = `${gradeLabel(state.grade)} / ${roomLabel(state.room)}`;
    $('#advisor-one').value = students[0]?.advisor_1 || '—';
    $('#advisor-two').value = students[0]?.advisor_2 || '—';
    $('#form-title').textContent = 'แบบตรวจข้อมูลสมัครธรรมศึกษา';
    $('#student-body').innerHTML = students.length ? students.map((row, index) => {
      const complete = rowComplete(row); const partial = Boolean(normalizeDigits(row.citizen) || row.exam_status || row.special_needs || row.notes); const recommendation = recommendationFor(row); const selectedApplicationLevel = row.application_level || recommendation.level; const code = levelCode[selectedApplicationLevel] || 'tri';
      const rowKind = row.special_needs ? 'special' : row.exam_status === 'not_exam' ? 'not-exam' : row.exam_status === 'exam' ? 'exam-selected' : '';
      const noExamDisabled = !canSkipExam(row);
      return `<tr class="student-row ${complete ? 'complete' : partial ? 'partial' : 'empty'} ${rowKind}" data-number="${esc(row.number)}" data-application-level="${code}">
        <td>${index + 1}</td><td>${esc(row.number)}</td><td><button type="button" class="student-name-button" data-edit-number="${esc(row.number)}" title="กดเพื่อแก้ไขหรือกรอกข้อมูลรายคน">${esc(row.name)}</button></td>
        <td><div class="citizen-cell"><span class="field-shell ${row.citizen ? 'has-value' : 'needs-input'}">${validThaiId(row.citizen) ? '' : requiredMarker(row.citizen ? 'ตรวจสอบเลขประชาชน' : 'ต้องกรอกเลขประชาชน 13 หลัก')}<input class="citizen-input minimal-field ${citizenVisualClass(fieldClass(row))}" style="color:${validThaiId(row.citizen) ? '#167047' : row.citizen ? '#a04b40' : 'inherit'} !important;border-color:transparent !important;background:transparent !important" data-field="citizen" inputmode="numeric" maxlength="13" value="${esc(row.citizen || '')}" placeholder="" aria-label="เลขประชาชน ${esc(row.name)}" /></span></div></td>
        <td><div class="birth-cell ${row.birth_iso ? 'has-value' : 'needs-value'}">${!row.birth_iso ? requiredMarker('ต้องเลือกวันเดือนปีเกิด') : ''}<button type="button" class="date-display ${row.birth_iso ? 'filled' : 'needs-input'}" data-open-date aria-label="เลือกวันเดือนปีเกิด ${esc(row.name)}"><span data-be-date>${esc(formatThaiDate(row.birth_iso)) || 'ว/ด/ป พ.ศ.'}</span></button><input class="date-picker-input" data-field="birth_iso" type="date" value="${esc(row.birth_iso || '')}" aria-label="วันเดือนปีเกิด ${esc(row.name)}" /></div></td>
        <td>${esc(row.education)}</td>
        <td><div class="level-cell">${recommendation.level ? `<span class="field-shell ${selectedApplicationLevel ? 'has-value' : 'needs-input'}">${selectedApplicationLevel ? '' : requiredMarker('ต้องเลือกระดับที่จะสมัคร')}<select data-field="application_level">${option('ตรี','ตรี',selectedApplicationLevel,recommendation.level)}${option('โท','โท',selectedApplicationLevel,recommendation.level)}${option('เอก','เอก',selectedApplicationLevel,recommendation.level)}</select></span>` : `<button type="button" class="level-review-trigger" data-edit-number="${esc(row.number)}" title="กดเพื่อตรวจสอบใบประกาศเดิมก่อนเลือกระดับ">ตรวจสอบใบประกาศเดิมก่อนเลือก</button>`}</div></td>
        <td><div class="previous-cell"><button type="button" class="previous-display" data-edit-previous aria-label="แก้ไขข้อมูลประโยคเดิม">${esc(row.previous ? `${row.previous_certificate_year ? `${row.previous_certificate_year} · ` : ''}${row.previous}` : 'เลขเดิม')}</button><input class="previous-editor minimal-field" data-field="previous" value="${esc(row.previous || '')}" placeholder="เลขที่ ปกศ." aria-label="เลขที่ ปกศ." hidden /><input class="previous-year-editor minimal-field" data-field="previous_certificate_year" value="${esc(row.previous_certificate_year || '')}" placeholder="พ.ศ. ที่จบ" aria-label="พ.ศ. ที่จบประโยคเดิม" inputmode="numeric" maxlength="4" hidden />${row.match_status === 'auto_matched' ? `<span class="match-hint">จับคู่แล้ว${row.legacy_level ? ` · เดิม${esc(row.legacy_level)}` : ''}</span>` : row.match_status === 'review' ? '<span class="match-hint review">ต้องตรวจ</span>' : ''}</div></td>
        <td><div class="exam-choice"><label><input data-field="exam_status" data-exam-value="exam" type="checkbox" ${row.exam_status === 'exam' ? 'checked' : ''} /> สอบ</label><label class="no-exam-option"><input data-field="exam_status" data-exam-value="not_exam" type="checkbox" ${row.exam_status === 'not_exam' ? 'checked' : ''} ${noExamDisabled ? 'disabled' : ''} /> ไม่สอบ</label><label class="special-option"><input data-field="special_needs" type="checkbox" ${row.special_needs ? 'checked' : ''} /> นักเรียนพิเศษ ไม่ต้องสอบ</label></div></td>
        <td class="detail-column"><input data-field="organization_name" value="${esc(row.organization_name)}" /></td><td class="detail-column"><input data-field="organization_location" value="${esc(row.organization_location)}" /></td><td class="detail-column"><input data-field="temple_affiliation" value="${esc(row.temple_affiliation)}" /></td><td class="detail-column"><input data-field="school_council" value="${esc(row.school_council)}" /></td><td class="detail-column"><input data-field="notes" value="${esc(row.notes || '')}" placeholder="หมายเหตุ" /></td>
        <td><span class="status-chip ${complete ? 'complete' : partial ? 'partial' : 'empty'}">${row.special_needs ? 'พิเศษ' : complete ? 'กรอกแล้ว' : partial ? 'ข้อมูลไม่ครบ' : 'ยังไม่กรอก'}</span></td>
      </tr>`;
    }).join('') : '<tr><td colspan="15" class="empty-room">ชั้นและห้องนี้ยังไม่มีรายชื่อนักเรียน</td></tr>';
    const complete = students.filter(rowComplete).length;
    const partial = students.filter((row) => !rowComplete(row) && (normalizeDigits(row.citizen) || row.exam_status || row.special_needs || row.notes)).length;
    const special = students.filter((row) => row.special_needs).length;
    const exams = students.filter((row) => row.exam_status === 'exam').length;
    const noExams = students.filter((row) => row.exam_status === 'not_exam').length;
    $('#filled-count').textContent = `กรอกแล้ว ${complete}/${students.length} คน`;
    $('#status-summary').innerHTML = `<span class="summary-complete">กรอกแล้ว ${complete}</span><span class="summary-empty">ยังไม่กรอก ${Math.max(students.length - partial - complete, 0)}</span><span class="summary-partial">ข้อมูลไม่ครบ ${partial}</span><span class="summary-special">พิเศษ ${special}</span><span class="summary-exam">สอบ ${exams}</span><span class="summary-no-exam">ไม่สอบ ${noExams}</span>`;
    $('#footer-summary').textContent = complete === students.length && students.length ? 'ข้อมูลครบทุกคนแล้ว พร้อมตรวจและพิมพ์' : `ยังเหลือข้อมูลที่ต้องกรอก ${Math.max(students.length - complete, 0)} คน`;
    document.querySelectorAll('#student-body tr[data-number]').forEach((tr) => {
      tr.querySelectorAll('[data-field]').forEach((field) => {
        field.addEventListener('input', () => {
          if (field.dataset.field === 'citizen') { field.classList.remove('valid','invalid','incomplete','citizen-incomplete'); const status = citizenState(field.value); if (status) field.classList.add(citizenVisualClass(status)); field.style.color = status === 'valid' ? '#167047' : status ? '#a04b40' : 'inherit'; field.style.borderColor = 'transparent'; field.style.background = 'transparent'; }
          if (field.dataset.field === 'birth_iso') tr.querySelector('[data-be-date]').textContent = formatThaiDate(field.value) || 'ว/ด/ป พ.ศ.';
          if (field.dataset.field === 'previous' || field.dataset.field === 'previous_certificate_year') syncExamCheckboxes(tr);
        });
        field.addEventListener('change', () => { if (field.dataset.field === 'exam_status' && field.checked) tr.querySelectorAll('[data-field="exam_status"]').forEach((other) => { if (other !== field) other.checked = false; }); updateRow(tr); });
      });
    });
    document.querySelectorAll('[data-edit-number]').forEach((button) => button.addEventListener('click', () => openRosterModal(button.dataset.editNumber)));
    document.querySelectorAll('[data-edit-previous]').forEach((button) => button.addEventListener('click', () => { const cell = button.closest('.previous-cell'); const inputs = cell?.querySelectorAll('[data-field="previous"], [data-field="previous_certificate_year"]'); if (!inputs?.length) return; button.hidden = true; inputs.forEach((input) => { input.hidden = false; input.addEventListener('blur', () => { setTimeout(() => { if (cell.contains(document.activeElement)) return; const tr = cell.closest('tr[data-number]'); if (tr) updateRow(tr); }, 0); }, { once:false }); }); inputs[0].focus(); }));
    document.querySelectorAll('[data-open-date]').forEach((button) => button.addEventListener('click', () => { const input = button.parentElement.querySelector('input[type="date"]'); if (input?.showPicker) input.showPicker(); else input?.click(); }));
  };
  const syncExamCheckboxes = (tr) => {
    const row = state.rows.find((item) => item.number === tr.dataset.number); if (!row) return;
    const noExam = tr.querySelector('[data-exam-value="not_exam"]');
    if (noExam) noExam.disabled = !(row.special_needs || hasPreviousCertificate({ ...row, previous: tr.querySelector('[data-field="previous"]')?.value || '', previous_certificate_year: tr.querySelector('[data-field="previous_certificate_year"]')?.value || '' }));
  };
  const updateRow = (tr) => {
    const row = state.rows.find((item) => item.number === tr.dataset.number); if (!row) return;
    tr.querySelectorAll('[data-field]').forEach((field) => {
      if (field.dataset.field === 'exam_status' && field.type === 'checkbox') return;
      row[field.dataset.field] = field.type === 'checkbox' ? field.checked : field.value;
    });
    const selectedExam = tr.querySelector('[data-field="exam_status"]:checked');
    row.exam_status = selectedExam?.dataset.examValue || '';
    if (row.special_needs) row.exam_status = 'not_exam';
    if (row.exam_status === 'not_exam' && !canSkipExam(row)) row.exam_status = '';
    const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}'); saved[row.number] = row; localStorage.setItem(storageKey(), JSON.stringify(saved));
    setStatus(row.citizen && validThaiId(row.citizen) ? 'บันทึกแล้ว · เลขบัตรถูกต้อง' : 'บันทึกแล้ว', validThaiId(row.citizen) ? '#167047' : '#765914'); render();
  };
  const commitPreviousEdit = (cell) => {
    const button = cell?.querySelector('[data-edit-previous]');
    const tr = cell?.closest('tr[data-number]');
    if (button && button.hidden && tr) updateRow(tr);
  };
  document.addEventListener('pointerdown', (event) => {
    const cell = document.activeElement?.closest?.('.previous-cell');
    if (cell && !cell.contains(event.target)) setTimeout(() => commitPreviousEdit(cell), 0);
  }, true);
  document.addEventListener('click', (event) => {
    document.querySelectorAll('.previous-cell').forEach((cell) => {
      if (!cell.contains(event.target)) setTimeout(() => commitPreviousEdit(cell), 0);
    });
  }, true);
  const closeRosterModal = () => { $('#roster-modal').hidden = true; $('#roster-form-message').textContent = ''; };
  const openRosterModal = (number = '') => {
    const row = state.rows.find((item) => item.number === number) || { number:'', name:'', grade:state.grade, room:state.room, citizen:'', birth_iso:'', application_level:suggestedLevel() || 'ตรี', previous:'', exam_status:'', special_needs:false, advisor_1:'', advisor_2:'' };
    $('#edit-original-number').value = number;
    $('#edit-number').value = row.number || '';
    $('#edit-name').value = row.name || '';
    $('#edit-grade').value = String(row.grade || state.grade);
    $('#edit-room').value = String(row.room || state.room);
    $('#edit-citizen').value = row.citizen || '';
    $('#edit-birth').value = row.birth_iso || '';
    $('#edit-application-level').value = row.application_level || suggestedLevel() || 'ตรี';
    $('#edit-previous').value = row.previous || '';
    $('#edit-previous-year').value = row.previous_certificate_year || '';
    $('#edit-exam').checked = row.exam_status === 'exam';
    $('#edit-no-exam').checked = row.exam_status === 'not_exam';
    $('#edit-special').checked = Boolean(row.special_needs);
    $('#edit-advisor-one').value = row.advisor_1 || '';
    $('#edit-advisor-two').value = row.advisor_2 || '';
    syncRosterExamOptions();
    $('#roster-modal-title').textContent = number ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มรายชื่อนักเรียน';
    $('#roster-modal').hidden = false;
    $('#edit-name').focus();
  };
  const syncRosterExamOptions = () => {
    const hasPrevious = Boolean($('#edit-previous').value.trim() && (!requiresPreviousYear($('#edit-application-level').value) || /^25\d{2}$/.test($('#edit-previous-year').value.trim())));
    const special = $('#edit-special').checked;
    $('#edit-no-exam').disabled = !(hasPrevious || special);
    $('#edit-no-exam-note').textContent = special ? 'นักเรียนพิเศษจะถูกบันทึกเป็นไม่สอบ' : requiresPreviousYear($('#edit-application-level').value) ? 'การเลือกไม่สอบต้องมี พ.ศ. และเลขใบประกาศเดิม' : 'การเลือกไม่สอบต้องมีเลขใบประกาศเดิม';
    if (special) { $('#edit-no-exam').checked = true; $('#edit-exam').checked = false; }
    else if (!hasPrevious) $('#edit-no-exam').checked = false;
  };
  const syncRosterExamChecks = (source) => {
    if (source === 'exam' && $('#edit-exam').checked) { $('#edit-no-exam').checked = false; $('#edit-special').checked = false; }
    if (source === 'no-exam' && $('#edit-no-exam').checked) { $('#edit-exam').checked = false; }
    if (source === 'special' && $('#edit-special').checked) { $('#edit-exam').checked = false; }
    syncRosterExamOptions();
  };
  const saveRosterEdit = (event) => {
    event.preventDefault();
    const original = $('#edit-original-number').value.trim();
    const number = $('#edit-number').value.trim();
    const name = $('#edit-name').value.trim();
    if (!number || !name) { $('#roster-form-message').textContent = 'กรุณากรอกเลขประจำตัวและชื่อ - สกุล'; return; }
    const edits = rosterEdits();
    const previous = $('#edit-previous').value.trim();
    const previous_certificate_year = $('#edit-previous-year').value.trim();
    const special_needs = $('#edit-special').checked;
    const validPrevious = previous && (!requiresPreviousYear($('#edit-application-level').value) || /^25\d{2}$/.test(previous_certificate_year));
    const exam_status = special_needs ? 'not_exam' : $('#edit-exam').checked ? 'exam' : $('#edit-no-exam').checked && validPrevious ? 'not_exam' : '';
    const updated = { number, name, grade:$('#edit-grade').value, room:$('#edit-room').value, citizen:$('#edit-citizen').value.trim(), birth_iso:$('#edit-birth').value, application_level:$('#edit-application-level').value, previous, previous_certificate_year, exam_status, special_needs, advisor_1:$('#edit-advisor-one').value.trim(), advisor_2:$('#edit-advisor-two').value.trim() };
    if (original && rosterRows.some((row) => row.number === original)) edits.overrides[original] = updated;
    else if (original) { const index = (edits.extras || []).findIndex((row) => row.number === original); if (index >= 0) edits.extras[index] = { ...edits.extras[index], ...updated }; else edits.extras.push(updated); }
    else edits.extras.push({ ...updated, education:updated.grade === 'higher' ? 'อุดมศึกษา' : 'มัธยม', notes:'' });
    localStorage.setItem(rosterOverrideKey, JSON.stringify(edits));
    state.grade = updated.grade; state.room = updated.room;
    $('#grade-select').value = state.grade; $('#room-select').value = state.room;
    loadRows(); render(); closeRosterModal(); setStatus('บันทึกการแก้ไขรายชื่อไว้ในเครื่องแล้ว','#167047');
  };
  const loadRosterData = async () => {
    try {
      let payload;
      if (demoMode) {
        const localResponse = await fetch('data/roster-2569.json', { cache:'no-store' });
        if (!localResponse.ok) throw new Error(`HTTP ${localResponse.status}`);
        payload = (await localResponse.json()).rows || [];
      } else {
        if (access.role === 'admin') {
          const adminRows = [];
          for (let offset = 0; ; offset += 1000) {
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/staff_activity_roster`, {
              method:'POST', cache:'no-store',
              headers:{ apikey:supabaseKey, Authorization:`Bearer ${staffToken}`, 'Content-Type':'application/json', Prefer:'count=exact', 'Range-Unit':'items', Range:`${offset}-${offset + 999}` },
              body:JSON.stringify({ requested_year:'2569' }),
            });
            if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
            const chunk = await response.json();
            if (!Array.isArray(chunk) || !chunk.length) break;
            const firstKey = String(chunk[0]?.student_id ?? chunk[0]?.student_number ?? '');
            if (offset > 0 && firstKey && adminRows.some((row) => String(row.student_id ?? row.student_number ?? '') === firstKey)) break;
            adminRows.push(...chunk);
            const contentRange = response.headers.get('content-range') || '';
            const totalMatch = contentRange.match(/\/([0-9]+|\*)$/);
            const total = totalMatch && totalMatch[1] !== '*' ? Number(totalMatch[1]) : null;
            if (chunk.length < 1000 || (total !== null && adminRows.length >= total)) break;
          }
          payload = adminRows;
        } else {
        const fetchChunk = async (grade, room) => {
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/public_activity_access`, {
            method:'POST', cache:'no-store',
            headers:{ apikey:supabaseKey, Authorization:`Bearer ${supabaseKey}`, 'Content-Type':'application/json' },
            body:JSON.stringify({ requested_year:'2569', requested_role:access.role, requested_code:access.code, requested_grade:grade, requested_room:room }),
          });
          if (!response.ok) throw new Error(`Supabase HTTP ${response.status} · ม.${grade}/${room}`);
          return response.json();
        };
        // Supabase REST caps a single response at 1,000 rows. Room-scoped reads
        // keep every request small and make the full 2569 roster deterministic.
        const chunks = access.role === 'student'
          ? [await fetchChunk(null, null)]
          : [await fetchChunk(Number(state.grade), Number(state.room))];
        payload = chunks.flat();
        }
      }
      rosterRows = (Array.isArray(payload) ? payload : []).map((row) => ({
        number: row.student_number ?? row.number,
        name: row.full_name ?? row.name,
        grade: String(row.grade_level ?? row.grade ?? 'higher'),
        room: String(row.room_no ?? row.room ?? 'higher'),
        education: row.education_band ? (row.education_band === 'higher_education' ? 'อุดมศึกษา' : 'มัธยม') : (row.education || 'มัธยม'),
        citizen: row.citizen_id || row.citizen || '',
        birth_iso: row.birth_iso || '',
        previous: row.certificate_no || row.previous || '',
        previous_certificate_year: row.certificate_year || row.previous_certificate_year || '',
        legacy_level: String(row.legacy_level || '').replace(/^ธรรมศึกษาชั้น/, ''),
        match_status: row.match_status || '',
        application_level: row.application_level || (Number(row.grade_level ?? row.grade) === 1 || Number(row.grade_level ?? row.grade) === 4 ? 'ตรี' : ''),
        advisor_1: row.advisor_1 || '', advisor_2: row.advisor_2 || '',
      }));
      rosterRows.forEach((row) => {
        if (row.match_status === 'auto_matched' && row.application_level === row.legacy_level) row.application_level = '';
      });
      if (access.role === 'student' && rosterRows[0]) {
        state.grade = String(rosterRows[0].grade);
        state.room = String(rosterRows[0].room);
        $('#grade-select').value = state.grade;
        $('#room-select').value = state.room;
      }
      loadRows(); render(); setStatus(`รายชื่อปี 2569 · ${rosterRows.length.toLocaleString('th-TH')} คน`, '#167047');
    } catch (error) {
      rosterRows = [];
      loadRows(); render();
      setStatus(demoMode ? 'โหมดทดลอง · ใช้รายชื่อจำลอง' : 'เชื่อมต่อรายชื่อจริงไม่สำเร็จ', '#a04b40');
    }
  };
  const exportExcel = () => {
    const escapeHtml = (value) => esc(value).replace(/\n/g, '<br>');
    const levelTitle = `ศ.${state.level === 'ตรี' ? '5' : '6'} ${state.level}`;
    const splitName = (name) => { const parts = String(name || '').trim().split(/\s+/); const prefix = ['เด็กชาย','เด็กหญิง','นาย','นางสาว','นาง'].includes(parts[0]) ? parts.shift() : ''; return [prefix, parts.shift() || '', parts.join(' ')]; };
    const isTri = state.level === 'ตรี';
  const officialRows = state.rows.map((row, index) => { const [prefix, firstName, lastName] = splitName(row.name); const examNote = row.special_needs ? 'นักเรียนพิเศษ ไม่ต้องสอบ' : row.exam_status === 'not_exam' ? `ไม่สอบ เลขใบประกาศเดิม ${row.previous}` : row.exam_status === 'exam' ? 'สอบ' : ''; const previousMatch = String(row.previous || '').match(/(\d{4}).*?(\d+)$/); const previousYear = row.previous_certificate_year || previousMatch?.[1] || ''; const previousNumber = previousMatch?.[2] || String(row.previous || '').replace(/^.*?\//, ''); const currentCouncil = row.school_council || 'คณะจังหวัดนครปฐม'; const previousCouncil = row.previous_school_council || currentCouncil; const tail = isTri ? `<td>${escapeHtml(`${examNote}${row.notes ? ` · ${row.notes}` : ''}`)}</td>` : `<td>${escapeHtml(previousYear)}</td><td>${escapeHtml(previousNumber)}</td><td>${escapeHtml(previousCouncil)}</td><td>${escapeHtml(`${examNote}${row.notes ? ` · ${row.notes}` : ''}`)}</td>`; return `<tr><td>${index + 1}</td><td>${escapeHtml(prefix)}</td><td>${escapeHtml(firstName)}</td><td>${escapeHtml(lastName)}</td><td>${escapeHtml(row.citizen)}</td><td>${escapeHtml(row.application_level)}</td><td>ม.${state.grade} / ห้อง ${state.room}</td><td>${escapeHtml(formatThaiDate(row.birth_iso))}</td><td>${escapeHtml(row.organization_name)}</td><td>ไร่ขิง</td><td>สามพราน</td><td>นครปฐม</td><td>${escapeHtml(row.temple_affiliation)}</td><td></td><td></td><td>นครปฐม</td><td>${escapeHtml(currentCouncil)}</td>${tail}</tr>`; }).join('');
    const previousTitle = state.level === 'โท' ? 'ประโยคเดิม (ธรรมศึกษาชั้นตรี)' : 'ประโยคเดิม (ธรรมศึกษาชั้นโท)';
    const previousGroup = isTri ? '<th rowspan="2" class="group">หมายเหตุ</th>' : `<th colspan="3" class="group">${previousTitle}</th><th rowspan="2" class="group">หมายเหตุ</th>`;
    const previousSubhead = isTri ? '' : '<th class="subhead">พ.ศ.</th><th class="subhead">เลขที่ ปกศ.</th><th class="subhead">สำนักเรียนวัด/คณะจังหวัด</th>';
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${levelTitle} ม.${state.grade} ห้อง ${state.room}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,'Tahoma',sans-serif;color:#111;margin:0}h1,h2,p{text-align:center;margin:4px}h1{font-size:16pt}h2{font-size:12pt}p{font-size:9pt}.meta{width:100%;margin:10px 0 5px;border-collapse:collapse}.meta td{padding:4px;border:1px solid #777;text-align:left}.meta b{font-weight:700}.official{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt}.official th,.official td{border:1px solid #222;padding:3px;text-align:center;vertical-align:middle;height:25px;word-break:break-word}.official th{background:#fffbd1;font-weight:700}.official .group{font-size:8pt;height:34px}.official .subhead{font-size:7pt;height:24px}small{font-size:7pt;color:#555}.note{margin-top:7px;text-align:left;font-size:8pt}</style></head><body><h1>บัญชีสำมะโนครัวผู้ขอเข้าสอบความรู้ ธรรมศึกษาชั้น${state.level}</h1><h2>ในสนามหลวง พ.ศ. 2569</h2><table class="meta"><tr><td><b>ชื่อสนามสอบ</b><br>โรงเรียนวัดไร่ขิงวิทยา</td><td><b>ตำบล</b><br>ไร่ขิง</td><td><b>อำเภอ</b><br>สามพราน</td><td><b>จังหวัด</b><br>นครปฐม</td><td><b>รหัสสนามสอบ</b><br>256101</td><td><b>ชั้น / ห้อง</b><br>ม.${state.grade} / ห้อง ${state.room}</td></tr></table><table class="official"><thead><tr><th rowspan="2" class="group">เลขที่</th><th rowspan="2" class="group">คำนำ</th><th rowspan="2" class="group">ชื่อ</th><th rowspan="2" class="group">นามสกุล</th><th rowspan="2" class="group">เลขที่บัตรประชาชน</th><th rowspan="2" class="group">ระดับธรรมศึกษา</th><th rowspan="2" class="group">ชั้น / แผนก / ห้อง</th><th rowspan="2" class="group">เกิด</th><th colspan="4" class="group">สังกัดองค์กร / สถาบัน / สถานศึกษา ที่ส่งเข้าสมัคร</th><th colspan="4" class="group">สำนักศาสนศึกษา / วัด / สำนักสงฆ์ / ฯลฯ ที่จัดสอน</th><th rowspan="2" class="group">สำนักเรียน</th>${previousGroup}</tr><tr><th class="subhead">ชื่อองค์กร</th><th class="subhead">ตำบล</th><th class="subhead">อำเภอ</th><th class="subhead">จังหวัด</th><th class="subhead">สังกัดวัด</th><th class="subhead">ตำบล</th><th class="subhead">อำเภอ</th><th class="subhead">จังหวัด</th>${previousSubhead}</tr></thead><tbody>${officialRows}</tbody></table><p class="note">ครูที่ปรึกษา 1: ${escapeHtml($('#advisor-one').value)} &nbsp;&nbsp; ครูที่ปรึกษา 2: ${escapeHtml($('#advisor-two').value)} &nbsp;&nbsp; ส่งออกจากระบบกรอกข้อมูลธรรมศึกษา</p></body></html>`;
    const blob = new Blob([html], { type:'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${levelTitle}-ม${state.grade}-ห้อง${state.room}.xls`; link.click(); URL.revokeObjectURL(link.href); setStatus('ดาวน์โหลดแบบฟอร์ม Excel แล้ว','#167047');
  };
  const loadRoom = () => { loadRows(); render(); };
  const printableRow = (student) => {
    const saved = JSON.parse(localStorage.getItem(`dharma-direct-form-v3:${student.grade}:${student.room}`) || '{}');
    return { organization_name:'โรงเรียนวัดไร่ขิงวิทยา', temple_affiliation:'วัดไร่ขิงพระอารามหลวง', school_council:'คณะจังหวัดนครปฐม', notes:'', special_needs:false, exam_status:'', ...student, ...saved[student.number] };
  };
  const printStatus = (row) => {
    const complete = rowComplete(row);
    const partial = Boolean(normalizeDigits(row.citizen) || row.exam_status || row.special_needs || row.notes);
    return { complete, partial, label: row.special_needs ? 'พิเศษ' : complete ? 'กรอกแล้ว' : partial ? 'ข้อมูลไม่ครบ' : 'ยังไม่กรอก' };
  };
  const buildPrintReport = (rows, title, subtitle) => { const includeRoom = rows.length !== state.rows.length; const locationHead = includeRoom ? '<th>ชั้น / ห้อง</th>' : ''; return `<div class="report-heading"><h1>${esc(title)}</h1><p class="all-print-meta">${esc(subtitle)}</p><div class="report-meta"><span><b>สนามสอบ</b> โรงเรียนวัดไร่ขิงวิทยา</span><span><b>รหัสสนามสอบ</b> 256101</span><span><b>ครูที่ปรึกษา 1</b> ${esc($('#advisor-one').value)}</span><span><b>ครูที่ปรึกษา 2</b> ${esc($('#advisor-two').value)}</span></div></div><table class="report-table"><thead><tr><th>ที่</th>${locationHead}<th>เลขประจำตัว</th><th>ชื่อ - สกุล</th><th>เลขประชาชน</th><th>วันเดือนปีเกิด (พ.ศ.)</th><th>ระดับสมัคร</th><th>ใบประกาศเดิม</th><th>สอบ / ไม่สอบ</th><th>สถานะ</th></tr></thead><tbody>${rows.map((row, index) => { const status = printStatus(row); const exam = row.special_needs ? 'พิเศษ · ไม่ต้องสอบ' : row.exam_status === 'not_exam' ? 'ไม่สอบ' : row.exam_status === 'exam' ? 'สอบ' : ''; const rowClass = row.special_needs ? 'special' : status.complete ? 'complete' : status.partial ? 'partial' : 'empty'; const location = includeRoom ? `<td>${esc(gradeLabel(row.grade))} / ${esc(roomLabel(row.room))}</td>` : ''; return `<tr class="${rowClass}"><td>${index + 1}</td>${location}<td>${esc(row.number)}</td><td class="report-name">${esc(row.name)}</td><td>${esc(row.citizen || '')}</td><td>${esc(formatThaiDate(row.birth_iso))}</td><td>${esc(row.application_level || '')}</td><td>${esc(row.previous || '')}</td><td>${esc(exam)}</td><td>${status.label}</td></tr>`; }).join('')}</tbody></table><p class="report-footnote">รวม ${rows.length.toLocaleString('th-TH')} คน · สีเขียว = กรอกแล้ว · สีเหลือง = ข้อมูลไม่ครบ · สีเทา = ยังไม่กรอก · สีม่วง = นักเรียนพิเศษ</p>`; };
  const printCurrentRoom = () => {
    const rows = state.rows.map(printableRow).sort((a, b) => String(a.number).localeCompare(String(b.number), 'th', { numeric:true }));
    if (!rows.length) { setStatus('ห้องนี้ยังไม่มีรายชื่อสำหรับพิมพ์','#a04b40'); return; }
    $('#all-print-sheet').innerHTML = buildPrintReport(rows, 'รายงานตรวจข้อมูลสมัครธรรมศึกษา', `${gradeLabel(state.grade)} / ${roomLabel(state.room)} · ปีการศึกษา 2569`);
    pendingPrint = 'room';
    $('#print-preview-title').textContent = `พิมพ์ ${gradeLabel(state.grade)} / ${roomLabel(state.room)}`;
    $('#print-preview-note').textContent = `รายงานเฉพาะ ${gradeLabel(state.grade)} ${roomLabel(state.room)} จัดหน้า A4 แนวนอน พร้อมพิมพ์`;
    $('#print-preview-content').innerHTML = $('#all-print-sheet').cloneNode(true).outerHTML;
    $('#print-preview-modal').hidden = false;
  };
  const printAll = () => {
    if (!rosterRows.length) { setStatus('ยังไม่มีรายชื่อสำหรับพิมพ์ทั้งหมด','#a04b40'); return; }
    const rank = (value) => value === 'higher' ? 999 : Number(value);
    const rows = rosterRows.map(printableRow).sort((a, b) => rank(a.grade) - rank(b.grade) || rank(a.room) - rank(b.room) || String(a.number).localeCompare(String(b.number), 'th'));
    $('#all-print-sheet').innerHTML = `<h1>สรุปตรวจข้อมูลสมัครธรรมศึกษา ปี 2569</h1><p class="all-print-meta">โรงเรียนวัดไร่ขิงวิทยา · จำนวน ${rows.length.toLocaleString('th-TH')} คน</p><table><thead><tr><th>ที่</th><th>ชั้น / ห้อง</th><th>เลขประจำตัว</th><th>ชื่อ - สกุล</th><th>เลขประชาชน</th><th>วันเดือนปีเกิด (พ.ศ.)</th><th>ระดับสมัคร</th><th>ใบประกาศเดิม</th><th>สถานะ</th></tr></thead><tbody>${rows.map((row, index) => { const status = printStatus(row); return `<tr><td>${index + 1}</td><td>${esc(gradeLabel(row.grade))} / ${esc(roomLabel(row.room))}</td><td>${esc(row.number)}</td><td>${esc(row.name)}</td><td>${esc(row.citizen || '')}</td><td>${esc(formatThaiDate(row.birth_iso))}</td><td>${esc(row.application_level || '')}</td><td>${esc(row.previous || '')}</td><td class="${row.special_needs ? 'special' : status.complete ? 'complete' : status.partial ? 'partial' : 'empty'}">${status.label}</td></tr>`; }).join('')}</tbody></table>`;
    pendingPrint = 'all';
    $('#print-preview-title').textContent = 'พิมพ์ข้อมูลทั้งหมด';
    $('#print-preview-note').textContent = `จะแสดงรายชื่อทั้งหมด ${rows.length.toLocaleString('th-TH')} คน แยกตามชั้นและห้อง ในรูปแบบสรุป A4 แนวนอน`;
    $('#print-preview-content').innerHTML = $('#all-print-sheet').cloneNode(true).outerHTML;
    $('#print-preview-modal').hidden = false;
  };
  const closePrintPreview = () => { $('#print-preview-modal').hidden = true; $('#print-preview-content').innerHTML = ''; pendingPrint = ''; };
  const confirmPrint = () => {
    const mode = pendingPrint;
    $('#print-preview-modal').hidden = true;
    $('#print-preview-content').innerHTML = '';
    setStatus(mode === 'all' ? 'กำลังเปิดหน้าพิมพ์ข้อมูลทั้งหมด...' : `กำลังเปิดหน้าพิมพ์ ${gradeLabel(state.grade)} ${roomLabel(state.room)}...`, '#167047');
    document.body.classList.add(mode === 'all' ? 'printing-all' : 'printing-room');
    if (typeof window.print === 'function') window.setTimeout(() => window.print(), 80);
    else setStatus('เบราว์เซอร์นี้ไม่รองรับการพิมพ์', '#a04b40');
  };
  window.addEventListener('afterprint', () => { document.body.classList.remove('printing-room','printing-all'); $('#all-print-sheet').innerHTML = ''; setStatus(`รายชื่อปี 2569 · ${rosterRows.length.toLocaleString('th-TH')} คน`, '#167047'); });
  $('#grade-select').innerHTML = grades.map((grade) => `<option value="${grade}">${gradeLabel(grade)}</option>`).join(''); $('#room-select').innerHTML = rooms.map((room) => `<option value="${room}">${roomLabel(room)}</option>`).join(''); $('#grade-select').value = state.grade; $('#room-select').value = state.room;
  $('#edit-grade').innerHTML = grades.map((grade) => `<option value="${grade}">${gradeLabel(grade)}</option>`).join(''); $('#edit-room').innerHTML = rooms.map((room) => `<option value="${room}">${roomLabel(room)}</option>`).join('');
  const startApp = () => { $('#app-shell').hidden = false; $('#access-gate').hidden = true; document.body.classList.add('activity-access'); document.body.classList.toggle('admin-access', access.role === 'admin'); document.body.classList.toggle('teacher-access', access.role === 'teacher'); document.body.classList.toggle('student-access', access.role === 'student'); setStatus('กำลังโหลดรายชื่อปี 2569…', '#765914'); loadRows(); render(); loadRosterData(); };
  $('#grade-select').addEventListener('change', (event) => { if (access.role === 'teacher' || access.role === 'student') return; state.grade = event.target.value; if (state.grade === 'higher') state.room = 'higher'; else if (state.room === 'higher') state.room = '1'; $('#room-select').value = state.room; loadRoom(); }); $('#room-select').addEventListener('change', (event) => { if (access.role === 'teacher' || access.role === 'student') return; state.room = event.target.value; if (state.room === 'higher') state.grade = 'higher'; $('#grade-select').value = state.grade; loadRoom(); }); $('#print-button').addEventListener('click', printCurrentRoom); $('#print-all-button').addEventListener('click', printAll); document.querySelectorAll('[data-close-print-preview]').forEach((element) => element.addEventListener('click', closePrintPreview)); $('#confirm-print-button').addEventListener('click', confirmPrint);
  $('#roster-editor-button').addEventListener('click', () => openRosterModal()); $('#roster-form').addEventListener('submit', saveRosterEdit); document.querySelectorAll('[data-close-roster-modal]').forEach((element) => element.addEventListener('click', closeRosterModal)); $('#edit-previous').addEventListener('input', syncRosterExamOptions); $('#edit-previous-year').addEventListener('input', syncRosterExamOptions); $('#edit-application-level').addEventListener('change', syncRosterExamOptions); $('#edit-exam').addEventListener('change', () => syncRosterExamChecks('exam')); $('#edit-no-exam').addEventListener('change', () => syncRosterExamChecks('no-exam')); $('#edit-special').addEventListener('change', () => syncRosterExamChecks('special'));
  $('#toggle-detail-columns').addEventListener('click', (event) => { document.body.classList.toggle('details-visible'); event.currentTarget.textContent = document.body.classList.contains('details-visible') ? 'ซ่อนข้อมูลประกอบ' : 'แสดงข้อมูลประกอบ'; });
  $('#logout-button').addEventListener('click', () => { access.role = ''; access.code = ''; access.studentNumber = ''; sessionStorage.removeItem('dharma_staff_access_token'); window.location.replace(location.pathname); });
  $('#font-upload').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (result) => { const style = document.createElement('style'); style.dataset.printFont = 'true'; style.textContent = `@font-face{font-family:UploadedPrintFont;src:url(${result.target.result})}@media print{body,.paper{font-family:UploadedPrintFont,Sarabun,sans-serif}}`; document.head.appendChild(style); setStatus('ใช้ฟอนต์นี้เฉพาะตอนพิมพ์','#167047'); }; reader.readAsDataURL(file); });
  const accessForm = $('#access-form'); let selectedRole = 'teacher';
  document.querySelectorAll('[data-access-role]').forEach((button) => button.addEventListener('click', () => { selectedRole = button.dataset.accessRole; document.querySelectorAll('[data-access-role]').forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); }); $('#access-label').textContent = selectedRole === 'teacher' ? 'รหัสห้องเรียน' : 'เลขประจำตัวนักเรียน'; $('#access-code').placeholder = selectedRole === 'teacher' ? 'กรอกรหัสห้องเรียน' : 'กรอกเลขประจำตัวนักเรียน'; $('#access-code').value = ''; $('#access-message').textContent = ''; }));
  accessForm.addEventListener('submit', (event) => { event.preventDefault(); const code = $('#access-code').value.trim(); if (selectedRole === 'teacher') { const match = code.toLowerCase().match(/^wrk([1-6])(\d{1,2})$/); if (!match || Number(match[2]) < 1 || Number(match[2]) > 15) { $('#access-message').textContent = 'รหัสห้องเรียนไม่ถูกต้อง'; return; } access.role = 'teacher'; access.code = code.toLowerCase(); state.grade = match[1]; state.room = match[2]; $('#grade-select').value = state.grade; $('#room-select').value = state.room; $('#grade-select').disabled = true; $('#room-select').disabled = true; } else { if (!/^\d+$/.test(code)) { $('#access-message').textContent = 'กรุณากรอกเลขประจำตัวนักเรียน'; return; } access.role = 'student'; access.code = code; access.studentNumber = code; $('#grade-select').disabled = true; $('#room-select').disabled = true; } startApp(); });
  const startAdmin = async () => {
    document.body.classList.add('admin-mode');
    if (!staffToken) { $('#access-gate').hidden = false; $('#app-shell').hidden = true; $('#admin-login-panel').hidden = false; return; }
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/is_staff`, { method:'POST', headers:{ apikey:supabaseKey, Authorization:`Bearer ${staffToken}`, 'Content-Type':'application/json' }, body:'{}' });
      const allowed = response.ok && (await response.json()) === true;
      if (!allowed) {
        sessionStorage.removeItem('dharma_staff_access_token');
        $('#admin-login-panel').hidden = false;
        $('#access-message').textContent = 'บัญชี Google นี้ยังไม่ได้รับสิทธิ์ผู้ดูแลระบบ';
        return;
      }
      access.role = 'admin'; access.code = 'admin'; startApp();
    } catch { $('#admin-login-panel').hidden = false; $('#access-message').textContent = 'ยืนยันสิทธิ์ผู้ดูแลระบบไม่สำเร็จ'; }
  };
  if (adminRequested) startAdmin();
  else if (demoMode) { access.role = 'teacher'; access.code = 'wrk11'; startApp(); }
  $('#admin-google-login')?.addEventListener('click', () => {
    const redirectTo = `${location.origin}${location.pathname}?admin=1`;
    window.location.assign(`${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  });
})();
