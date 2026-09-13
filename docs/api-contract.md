# API contract: first rollout

หน้าเว็บจะไม่ใช้ service key และจะไม่เขียนฐานข้อมูลโดยตรง การเขียนทั้งหมดต้องผ่าน API ที่ตรวจสอบสิทธิ์และบันทึก audit log

## Resources

`academic-years`, `teachers`, `classrooms`, `students`, `legacy-certificates`, `certificate-matches`, `exam-registrations`, `exam-eligibility`, `exam-rooms`, `exam-seats`, `exam-results`, `import-batches`

## Staff report RPCs

- `school_report_rows(year)` returns the school tracking rows with grade, room, advisor(s), matching, registration, official eligibility, seat, result, and follow-up state.
- `mother_sangha_report_rows(year, level)` returns one level at a time for filling a copy of the unchanged Mother Sangha workbook.
- `mother_sangha_form_rows_v3(year, level)` returns the complete exact per-level field contract, including organization and temple location columns, prior certificate fields required by the โท/เอก forms, notes, and current student number. Temple-location fields remain null until an authoritative value is available. It is staff-only and returns submitted/verified registrations.
- `apply_official_exam_import_batch(batch_id)` applies staff-reviewed official eligibility/seat/result staging rows idempotently; unmatched rows remain review.
- `certificate_pickup_report_rows_v2(year)` returns historical certificates still awaiting pickup with the current student's grade, room, and advisors; it is staff-only.
- `update_certificate_pickup_status(certificate_id, status, note)` records an audited staff status change (`pending`, `notified`, `claimed`, or `not_applicable`). It never writes to Firebase.
- Both RPCs require Supabase Auth plus an active `staff_roles` row. They are never exposed to `anon`.

## Public registration preflight

- `public_student_lookup_options(year, student_number)` resolves one current-roster identity by student number before the final submit step.
- The response supplies the server-owned education band, grade, room, advisor(s), and non-binding historical progression guidance, including whether an ambiguous historical match needs staff review. It does not return raw certificate rows.
- If no exact identity is found, the RPC returns no row and the page must keep the user on the identity step.
- `submit_public_registration_v2(...)` remains the final authority: it rechecks the identity, registration window, band, and year-specific rule at write time. The server also requires a reviewed historical prerequisite for โท/เอก (ตรี before โท, โท before เอก); M.1 and M.4 remain governed by the required ตรี rule.
- `public_student_registration_status(year, student_number)` returns existing non-cancelled applications by level. The UI uses it to label the next action as a new application or an update; the database unique key remains the final duplicate guard.

### Identity review and self-update

- `public_student_identity(year, student_number)` returns the personal fields needed for self-review.
- `public_update_student_self(year, student_number, current_full_name, title, first_name, last_name, citizen_id, birth_date_be)` validates the current name and saves personal fields immediately. Student number, class, room and advisors remain server-owned.
- A self-update writes an audit log and moves existing automatic/confirmed certificate matches to `review`, so a changed name cannot silently keep an unverified match.
- The old correction-request RPC remains for staff compatibility; the public UI no longer asks students to submit a correction request.
- `student_correction_review_rows(year)` and `review_student_correction(correction_id, decision, note)` are staff-only. Approval updates the current roster, marks existing certificate matches for recheck, and writes an audit entry.

## ข้อกำหนด

- ทุก list endpoint รองรับ pagination, search และ filter ตามปี/ระดับ/สถานะ
- การนำเข้าข้อมูลต้องทำซ้ำได้โดยไม่สร้างรายการซ้ำ และผูกกับ `import_batches`
- การจับคู่ต้องไม่เขียนทับข้อมูล Firebase เดิม
- การยืนยันหรือยกเลิกการจับคู่ต้องสร้าง `audit_logs`
- `exam_eligibility`, `exam_seats` และ `exam_results` ว่างได้จนกว่าจะมีข้อมูลประกาศจริง
- Public dashboard อ่านได้เฉพาะ aggregate ที่เปิดเผย
- Public lookup แสดงห้องสอบ/เลขที่สอบ/ผลสอบเฉพาะเมื่อข้อมูลถูกนำเข้าแล้ว
