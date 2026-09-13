# API contract: first rollout

หน้าเว็บจะไม่ใช้ service key และจะไม่เขียนฐานข้อมูลโดยตรง การเขียนทั้งหมดต้องผ่าน API ที่ตรวจสอบสิทธิ์และบันทึก audit log

## Resources

`academic-years`, `teachers`, `classrooms`, `students`, `legacy-certificates`, `certificate-matches`, `exam-registrations`, `exam-eligibility`, `exam-rooms`, `exam-seats`, `exam-results`, `import-batches`

## Staff report RPCs

- `school_report_rows(year)` returns the school tracking rows with grade, room, advisor(s), matching, registration, official eligibility, seat, result, and follow-up state.
- `mother_sangha_report_rows(year, level)` returns one level at a time for filling a copy of the unchanged Mother Sangha workbook.
- `apply_official_exam_import_batch(batch_id)` applies staff-reviewed official eligibility/seat/result staging rows idempotently; unmatched rows remain review.
- Both RPCs require Supabase Auth plus an active `staff_roles` row. They are never exposed to `anon`.

## Public registration preflight

- `public_student_lookup_options(year, student_number)` resolves one current-roster identity by student number before the final submit step.
- The response supplies the server-owned education band, grade, room, advisor(s), and non-binding historical progression guidance, including whether an ambiguous historical match needs staff review. It does not return raw certificate rows.
- If no exact identity is found, the RPC returns no row and the page must keep the user on the identity step.
- `submit_public_registration_v2(...)` remains the final authority: it rechecks the identity, registration window, band, and year-specific rule at write time.

### Identity correction

- `public_submit_student_correction(year, student_number, title, first_name, last_name, reason)` creates a pending correction request; it never edits the roster directly.
- `student_correction_review_rows(year)` and `review_student_correction(correction_id, decision, note)` are staff-only. Approval updates the current roster, marks existing certificate matches for recheck, and writes an audit entry.

## ข้อกำหนด

- ทุก list endpoint รองรับ pagination, search และ filter ตามปี/ระดับ/สถานะ
- การนำเข้าข้อมูลต้องทำซ้ำได้โดยไม่สร้างรายการซ้ำ และผูกกับ `import_batches`
- การจับคู่ต้องไม่เขียนทับข้อมูล Firebase เดิม
- การยืนยันหรือยกเลิกการจับคู่ต้องสร้าง `audit_logs`
- `exam_eligibility`, `exam_seats` และ `exam_results` ว่างได้จนกว่าจะมีข้อมูลประกาศจริง
- Public dashboard อ่านได้เฉพาะ aggregate ที่เปิดเผย
- Public lookup แสดงห้องสอบ/เลขที่สอบ/ผลสอบเฉพาะเมื่อข้อมูลถูกนำเข้าแล้ว
