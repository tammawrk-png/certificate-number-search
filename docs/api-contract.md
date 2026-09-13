# API contract: first rollout

หน้าเว็บจะไม่ใช้ service key และจะไม่เขียนฐานข้อมูลโดยตรง การเขียนทั้งหมดต้องผ่าน API ที่ตรวจสอบสิทธิ์และบันทึก audit log

## Resources

`academic-years`, `teachers`, `classrooms`, `students`, `legacy-certificates`, `certificate-matches`, `exam-registrations`, `exam-eligibility`, `exam-rooms`, `exam-seats`, `exam-results`, `import-batches`

## Staff report RPCs

- `school_report_rows(year)` returns the school tracking rows with grade, room, advisor(s), matching, registration, official eligibility, seat, result, and follow-up state.
- `mother_sangha_report_rows(year, level)` returns one level at a time for filling a copy of the unchanged Mother Sangha workbook.
- `apply_official_exam_import_batch(batch_id)` applies staff-reviewed official eligibility/seat/result staging rows idempotently; unmatched rows remain review.
- Both RPCs require Supabase Auth plus an active `staff_roles` row. They are never exposed to `anon`.

## ข้อกำหนด

- ทุก list endpoint รองรับ pagination, search และ filter ตามปี/ระดับ/สถานะ
- การนำเข้าข้อมูลต้องทำซ้ำได้โดยไม่สร้างรายการซ้ำ และผูกกับ `import_batches`
- การจับคู่ต้องไม่เขียนทับข้อมูล Firebase เดิม
- การยืนยันหรือยกเลิกการจับคู่ต้องสร้าง `audit_logs`
- `exam_eligibility`, `exam_seats` และ `exam_results` ว่างได้จนกว่าจะมีข้อมูลประกาศจริง
- Public dashboard อ่านได้เฉพาะ aggregate ที่เปิดเผย
- Public lookup แสดงห้องสอบ/เลขที่สอบ/ผลสอบเฉพาะเมื่อข้อมูลถูกนำเข้าแล้ว
