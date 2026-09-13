# API contract: first rollout

หน้าเว็บจะไม่ใช้ service key และจะไม่เขียนฐานข้อมูลโดยตรง การเขียนทั้งหมดต้องผ่าน API ที่ตรวจสอบสิทธิ์และบันทึก audit log

## Resources

`academic-years`, `teachers`, `classrooms`, `students`, `legacy-certificates`, `certificate-matches`, `exam-registrations`, `exam-eligibility`, `exam-rooms`, `exam-seats`, `exam-results`, `import-batches`

## ข้อกำหนด

- ทุก list endpoint รองรับ pagination, search และ filter ตามปี/ระดับ/สถานะ
- การนำเข้าข้อมูลต้องทำซ้ำได้โดยไม่สร้างรายการซ้ำ และผูกกับ `import_batches`
- การจับคู่ต้องไม่เขียนทับข้อมูล Firebase เดิม
- การยืนยันหรือยกเลิกการจับคู่ต้องสร้าง `audit_logs`
- `exam_eligibility`, `exam_seats` และ `exam_results` ว่างได้จนกว่าจะมีข้อมูลประกาศจริง
- Public dashboard อ่านได้เฉพาะ aggregate ที่เปิดเผย
- Public lookup แสดงห้องสอบ/เลขที่สอบ/ผลสอบเฉพาะเมื่อข้อมูลถูกนำเข้าแล้ว
