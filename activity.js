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
  let pendingPrint = '';
  const storageKey = () => `dharma-direct-form-v3:${state.grade}:${state.room}`;
  const rosterOverrideKey = 'dharma-roster-overrides-2569-v1';
  let rosterRows = [];
  const demoMode = !(window.APP_CONFIG?.supabase?.publishableKey);
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
  const canSkipExam = (row) => Boolean(row.special_needs || String(row.previous || '').trim());
  const setStatus = (text, color = '') => { $('#save-status').textContent = text; if (color) $('#save-status').style.color = color; };
  const rosterEdits = () => { try { return JSON.parse(localStorage.getItem(rosterOverrideKey) || '{"overrides":{},"extras":[]}'); } catch { return { overrides:{}, extras:[] }; } };
  const studentsForRoom = () => {
    if (!rosterRows.length) return demoStudents[`${state.grade}:${state.room}`] || [];
    const edits = rosterEdits();
    const base = rosterRows.map((student) => ({ ...student, ...(edits.overrides?.[student.number] || {}) })).filter((student) => String(student.grade) === state.grade && String(student.room) === state.room);
    return base.concat((edits.extras || []).filter((student) => String(student.grade) === state.grade && String(student.room) === state.room));
  };
  const loadRows = () => {
    const saved = JSON.parse(localStorage.getItem(storageKey()) || '{}');
    state.rows = studentsForRoom().map((student) => ({
      organization_name:'โรงเรียนวัดไร่ขิงวิทยา', organization_location:'ไร่ขิง / สามพราน / นครปฐม', temple_affiliation:'วัดไร่ขิงพระอารามหลวง', school_council:'คณะจังหวัดนครปฐม', notes:'', special_needs:false, exam_status:'', ...student, ...saved[student.number],
    })).map((row) => { if (row.exam_status === 'not_exam' && !canSkipExam(row)) row.exam_status = ''; return row; });
  };
  const rowComplete = (row) => Boolean(validThaiId(row.citizen) && row.birth_iso && row.application_level && (row.exam_status === 'exam' || (row.exam_status === 'not_exam' && canSkipExam(row))));
  const fieldClass = (row) => citizenState(row.citizen);
  const checkIcon = (row) => citizenState(row.citizen) === 'incomplete'
    ? '<span class="field-hint invalid-hint">กรอกไม่ครบ 13 หลัก</span>'
    : citizenState(row.citizen) === 'invalid'
      ? '<span class="field-hint invalid-hint">เลขไม่ผ่านการตรวจสอบ</span>'
      : '';
  const option = (value, label, current, recommendation = '') => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}${recommendation === value ? ' · แนะนำ' : ''}</option>`;
  const render = () => {
    const students = state.rows;
    $('#room-label').value = `${gradeLabel(state.grade)} / ${roomLabel(state.room)}`;
    $('#advisor-one').value = students[0]?.advisor_1 || '—';
    $('#advisor-two').value = students[0]?.advisor_2 || '—';
    $('#form-title').textContent = 'แบบตรวจข้อมูลสมัครธรรมศึกษา';
    $('#student-body').innerHTML = students.length ? students.map((row, index) => {
      const complete = rowComplete(row); const partial = Boolean(normalizeDigits(row.citizen) || row.exam_status || row.special_needs || row.notes); const code = levelCode[row.application_level] || 'tri'; const recommendation = recommendationFor(row);
      const rowKind = row.special_needs ? 'special' : row.exam_status === 'not_exam' ? 'not-exam' : row.exam_status === 'exam' ? 'exam-selected' : '';
      const noExamDisabled = !canSkipExam(row);
      return `<tr class="student-row ${complete ? 'complete' : partial ? 'partial' : 'empty'} ${rowKind}" data-number="${esc(row.number)}" data-application-level="${code}">
        <td>${index + 1}</td><td>${esc(row.number)}</td><td><button type="button" class="student-name-button" data-edit-number="${esc(row.number)}" title="กดเพื่อแก้ไขหรือกรอกข้อมูลรายคน">${esc(row.name)}</button></td>
        <td><div class="citizen-cell"><input class="citizen-input ${fieldClass(row)}" data-field="citizen" inputmode="numeric" maxlength="13" value="${esc(row.citizen || '')}" placeholder="เลข 13 หลัก" aria-label="เลขประชาชน ${esc(row.name)}" />${checkIcon(row)}</div></td>
        <td><div class="birth-cell"><button type="button" class="date-display" data-open-date aria-label="เลือกวันเดือนปีเกิด ${esc(row.name)}"><span data-be-date>${esc(formatThaiDate(row.birth_iso)) || 'ว/ด/ป พ.ศ.'}</span></button><input class="date-picker-input" data-field="birth_iso" type="date" value="${esc(row.birth_iso || '')}" aria-label="วันเดือนปีเกิด ${esc(row.name)}" /></div></td>
        <td>${esc(row.education)}</td>
        <td><div class="level-cell"><select data-field="application_level">${option('ตรี','ตรี',row.application_level,recommendation.level)}${option('โท','โท',row.application_level,recommendation.level)}${option('เอก','เอก',row.application_level,recommendation.level)}</select><span class="recommend-hint">${recommendation.level ? `ควรสอบ: ${recommendation.level}` : recommendation.basis}</span></div></td>
        <td><input data-field="previous" value="${esc(row.previous || '')}" placeholder="เลขเดิม" />${row.match_status === 'auto_matched' ? `<span class="match-hint">จับคู่แล้ว${row.legacy_level ? ` · เดิม${esc(row.legacy_level)}` : ''}</span>` : row.match_status === 'review' ? '<span class="match-hint review">ต้องตรวจ</span>' : ''}</td>
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
          if (field.dataset.field === 'citizen') { field.classList.remove('valid','invalid','incomplete'); const status = citizenState(field.value); if (status) field.classList.add(status); }
          if (field.dataset.field === 'birth_iso') tr.querySelector('[data-be-date]').textContent = formatThaiDate(field.value) || 'ว/ด/ป พ.ศ.';
          if (field.dataset.field === 'previous') syncExamCheckboxes(tr);
        });
        field.addEventListener('change', () => { if (field.dataset.field === 'exam_status' && field.checked) tr.querySelectorAll('[data-field="exam_status"]').forEach((other) => { if (other !== field) other.checked = false; }); updateRow(tr); });
      });
    });
    document.querySelectorAll('[data-edit-number]').forEach((button) => button.addEventListener('click', () => openRosterModal(button.dataset.editNumber)));
    document.querySelectorAll('[data-open-date]').forEach((button) => button.addEventListener('click', () => { const input = button.parentElement.querySelector('input[type="date"]'); if (input?.showPicker) input.showPicker(); else input?.click(); }));
  };
  const syncExamCheckboxes = (tr) => {
    const row = state.rows.find((item) => item.number === tr.dataset.number); if (!row) return;
    const noExam = tr.querySelector('[data-exam-value="not_exam"]');
    if (noExam) noExam.disabled = !(row.special_needs || String(tr.querySelector('[data-field="previous"]')?.value || '').trim());
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
    const hasPrevious = Boolean($('#edit-previous').value.trim());
    const special = $('#edit-special').checked;
    $('#edit-no-exam').disabled = !(hasPrevious || special);
    $('#edit-no-exam-note').textContent = special ? 'นักเรียนพิเศษจะถูกบันทึกเป็นไม่สอบ' : 'การเลือกไม่สอบต้องมีเลขใบประกาศเดิม';
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
    const special_needs = $('#edit-special').checked;
    const exam_status = special_needs ? 'not_exam' : $('#edit-exam').checked ? 'exam' : $('#edit-no-exam').checked && previous ? 'not_exam' : '';
    const updated = { number, name, grade:$('#edit-grade').value, room:$('#edit-room').value, citizen:$('#edit-citizen').value.trim(), birth_iso:$('#edit-birth').value, application_level:$('#edit-application-level').value, previous, exam_status, special_needs, advisor_1:$('#edit-advisor-one').value.trim(), advisor_2:$('#edit-advisor-two').value.trim() };
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
      const response = await fetch('data/roster-2569.json', { cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      rosterRows = Array.isArray(payload.rows) ? payload.rows : [];
      loadRows(); render(); setStatus(`รายชื่อปี 2569 · ${rosterRows.length.toLocaleString('th-TH')} คน`, '#167047');
    } catch (error) {
      setStatus(demoMode ? 'โหมดทดลอง · โหลดรายชื่อจริงไม่สำเร็จ' : 'เชื่อมต่อรายชื่อไม่สำเร็จ', '#a04b40');
    }
  };
  const exportExcel = () => {
    const escapeHtml = (value) => esc(value).replace(/\n/g, '<br>');
    const levelTitle = `ศ.${state.level === 'ตรี' ? '5' : '6'} ${state.level}`;
    const splitName = (name) => { const parts = String(name || '').trim().split(/\s+/); const prefix = ['เด็กชาย','เด็กหญิง','นาย','นางสาว','นาง'].includes(parts[0]) ? parts.shift() : ''; return [prefix, parts.shift() || '', parts.join(' ')]; };
    const isTri = state.level === 'ตรี';
    const officialRows = state.rows.map((row, index) => { const [prefix, firstName, lastName] = splitName(row.name); const examNote = row.special_needs ? 'นักเรียนพิเศษ ไม่ต้องสอบ' : row.exam_status === 'not_exam' ? `ไม่สอบ เลขใบประกาศเดิม ${row.previous}` : row.exam_status === 'exam' ? 'สอบ' : ''; const previousMatch = String(row.previous || '').match(/(\d{4}).*?(\d+)$/); const previousYear = previousMatch?.[1] || ''; const previousNumber = previousMatch?.[2] || ''; const currentCouncil = row.school_council || 'คณะจังหวัดนครปฐม'; const previousCouncil = row.previous_school_council || currentCouncil; const tail = isTri ? `<td>${escapeHtml(`${examNote}${row.notes ? ` · ${row.notes}` : ''}`)}</td>` : `<td>${escapeHtml(previousYear)}</td><td>${escapeHtml(previousNumber)}</td><td>${escapeHtml(previousCouncil)}</td><td>${escapeHtml(`${examNote}${row.notes ? ` · ${row.notes}` : ''}`)}</td>`; return `<tr><td>${index + 1}</td><td>${escapeHtml(prefix)}</td><td>${escapeHtml(firstName)}</td><td>${escapeHtml(lastName)}</td><td>${escapeHtml(row.citizen)}</td><td>${escapeHtml(row.application_level)}</td><td>ม.${state.grade} / ห้อง ${state.room}</td><td>${escapeHtml(formatThaiDate(row.birth_iso))}</td><td>${escapeHtml(row.organization_name)}</td><td>ไร่ขิง</td><td>สามพราน</td><td>นครปฐม</td><td>${escapeHtml(row.temple_affiliation)}</td><td></td><td></td><td>นครปฐม</td><td>${escapeHtml(currentCouncil)}</td>${tail}</tr>`; }).join('');
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
  const printCurrentRoom = () => {
    pendingPrint = 'room';
    $('#print-preview-title').textContent = `พิมพ์ ${gradeLabel(state.grade)} / ${roomLabel(state.room)}`;
    $('#print-preview-note').textContent = `จะแสดงเฉพาะนักเรียนใน ${gradeLabel(state.grade)} ${roomLabel(state.room)} พร้อมจัดหน้า A4 แนวนอน`;
    $('#print-preview-content').innerHTML = $('#print-area').cloneNode(true).outerHTML;
    $('#print-preview-modal').hidden = false;
  };
  const printAll = () => {
    if (!rosterRows.length) { setStatus('ยังไม่มีรายชื่อสำหรับพิมพ์ทั้งหมด','#a04b40'); return; }
    const rank = (value) => value === 'higher' ? 999 : Number(value);
    const rows = rosterRows.map(printableRow).sort((a, b) => rank(a.grade) - rank(b.grade) || rank(a.room) - rank(b.room) || String(a.number).localeCompare(String(b.number), 'th'));
    $('#all-print-sheet').innerHTML = `<h1>สรุปตรวจข้อมูลสมัครธรรมศึกษา ปี 2569</h1><p class="all-print-meta">โรงเรียนวัดไร่ขิงวิทยา · จำนวน ${rows.length.toLocaleString('th-TH')} คน</p><table><thead><tr><th>ที่</th><th>ชั้น / ห้อง</th><th>เลขประจำตัว</th><th>ชื่อ - สกุล</th><th>เลขประชาชน</th><th>วันเดือนปีเกิด (พ.ศ.)</th><th>ระดับสมัคร</th><th>ใบประกาศเดิม</th><th>สถานะ</th></tr></thead><tbody>${rows.map((row, index) => { const complete = rowComplete(row); const partial = Boolean(normalizeDigits(row.citizen) || row.exam_status || row.special_needs || row.notes); const status = row.special_needs ? 'พิเศษ' : complete ? 'กรอกแล้ว' : partial ? 'ข้อมูลไม่ครบ' : 'ยังไม่กรอก'; return `<tr><td>${index + 1}</td><td>${esc(gradeLabel(row.grade))} / ${esc(roomLabel(row.room))}</td><td>${esc(row.number)}</td><td>${esc(row.name)}</td><td>${esc(row.citizen || '')}</td><td>${esc(formatThaiDate(row.birth_iso))}</td><td>${esc(row.application_level || '')}</td><td>${esc(row.previous || '')}</td><td class="${complete ? 'complete' : partial ? 'partial' : 'empty'}">${status}</td></tr>`; }).join('')}</tbody></table>`;
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
  $('#grade-select').addEventListener('change', (event) => { state.grade = event.target.value; if (state.grade === 'higher') state.room = 'higher'; else if (state.room === 'higher') state.room = '1'; $('#room-select').value = state.room; loadRoom(); }); $('#room-select').addEventListener('change', (event) => { state.room = event.target.value; if (state.room === 'higher') state.grade = 'higher'; $('#grade-select').value = state.grade; loadRoom(); }); $('#print-button').addEventListener('click', printCurrentRoom); $('#print-all-button').addEventListener('click', printAll); document.querySelectorAll('[data-close-print-preview]').forEach((element) => element.addEventListener('click', closePrintPreview)); $('#confirm-print-button').addEventListener('click', confirmPrint);
  $('#roster-editor-button').addEventListener('click', () => openRosterModal()); $('#roster-form').addEventListener('submit', saveRosterEdit); document.querySelectorAll('[data-close-roster-modal]').forEach((element) => element.addEventListener('click', closeRosterModal)); $('#edit-previous').addEventListener('input', syncRosterExamOptions); $('#edit-exam').addEventListener('change', () => syncRosterExamChecks('exam')); $('#edit-no-exam').addEventListener('change', () => syncRosterExamChecks('no-exam')); $('#edit-special').addEventListener('change', () => syncRosterExamChecks('special'));
  $('#toggle-detail-columns').addEventListener('click', (event) => { document.body.classList.toggle('details-visible'); event.currentTarget.textContent = document.body.classList.contains('details-visible') ? 'ซ่อนข้อมูลประกอบ' : 'แสดงข้อมูลประกอบ'; });
  $('#font-upload').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (result) => { const style = document.createElement('style'); style.dataset.printFont = 'true'; style.textContent = `@font-face{font-family:UploadedPrintFont;src:url(${result.target.result})}@media print{body,.paper{font-family:UploadedPrintFont,Sarabun,sans-serif}}`; document.head.appendChild(style); setStatus('ใช้ฟอนต์นี้เฉพาะตอนพิมพ์','#167047'); }; reader.readAsDataURL(file); });
  setStatus('กำลังโหลดรายชื่อปี 2569…', '#765914'); loadRows(); render(); loadRosterData();
})();
