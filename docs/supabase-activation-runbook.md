# Runbook เปิดใช้งานระบบหลังบ้าน

เอกสารนี้ใช้ต่อจากเครื่องอื่นได้ โดยให้เปิด repository ผ่าน VS Code และใช้ Chrome profile `Tamma` กับบัญชี `tammawrk@gmail.com` เท่านั้น

## ก่อนเริ่ม

1. ตรวจว่า Supabase project เป็น `dharma-education-system` และ URL ใน `config.js` ตรงกับ project เดียวกัน
2. เมื่อได้ public/publishable key แล้ว ให้ตั้ง GitHub Actions secret ชื่อ `SUPABASE_PUBLISHABLE_KEY` ใน repository เท่านั้น ระบบ deploy จะเติมค่าให้ `config.js` ชั่วคราวระหว่าง build โดยไม่ commit key ลง Git
3. ตรวจ `git status` และอย่า stage `firebase-import.json` หรือไฟล์ CSV/SQL ที่มี PII
4. ตรวจ Google Drive profile ก่อนเขียนทุกครั้ง และใช้เฉพาะโฟลเดอร์งานที่ผู้ดูแลกำหนด
5. ต้นฉบับ `.xls` ใน `00_ต้นฉบับฟอร์มแม่กองธรรม` เป็น read-only ห้าม rename, overwrite, merge หรือปรับรูปแบบ

## ลำดับ migration

รันใน Supabase SQL Editor ตามลำดับชื่อไฟล์ หลังจากตรวจว่า migration ก่อนหน้าสำเร็จแล้ว:

`0001` → `0002` → `0003` → `0004` → `0006` → `0007` → `0008` → `0009` → `0010` → `0011` → `0012` → `0013` → `0014` → `0015` → `0016` → `0017` → `0018` → `0019` → `0020` → `0021` → `0022` → `0023`

ห้ามใช้คำสั่ง drop/recreate เพื่อแก้ warning ของ SQL Editor และห้ามรันซ้ำบางส่วนแบบเดาสุ่ม แม้ migration ส่วนใหญ่จะเขียนให้ทำซ้ำได้ก็ตาม

## ตรวจหลัง migration

- ตรวจว่ามีปีการศึกษา 2569 หนึ่งแถว
- ตรวจรายชื่อปัจจุบัน 3,155 คน, ห้อง 81 ห้อง และครูที่ปรึกษา 148 รายการจาก roster ที่ผ่าน policy
- ตรวจว่าไม่มีห้อง 16 และไม่มีห้อง ม.ปลายเกิน 12
- เรียก `public_dashboard_metrics_v2()` และยืนยันตัวเลขเป็น aggregate เท่านั้น
- เรียก `public_registration_window_status('2569')` และยืนยันว่าค่าเริ่มต้นยังปิดรับสมัคร
- เรียก `public_student_lookup_options('2569', เลขประจำตัว)` ด้วยข้อมูลทดสอบที่ได้รับอนุญาต และยืนยันว่าระบบคืนชื่อ/สาย/ชั้น/ห้อง/ครูที่ปรึกษาจากทะเบียน ไม่ให้ผู้สมัครกรอกทับเอง
- ทดสอบ `public_submit_student_correction(...)` ว่าบันทึกเป็นคำขอ `pending` เท่านั้น จากนั้นใช้บัญชี staff ทดสอบ `student_correction_review_rows` และอนุมัติ/ปฏิเสธผ่าน `review_student_correction(...)`
- เรียก `lookup_public_exam_status` ก่อน official import ต้องได้ผลลัพธ์ว่างหรือสถานะรอข้อมูล ไม่สร้างค่าห้องสอบ/ผลสอบขึ้นเอง
- ทดสอบรายงาน `certificate_pickup_report_rows_v2` และปุ่ม staff เปลี่ยนสถานะใบประกาศเป็น `notified`/`claimed`; การเปลี่ยนสถานะต้องมี audit log และต้องไม่เขียนกลับ Firebase

## ตั้งเจ้าหน้าที่

ให้ผู้ดูแลสร้าง/ยืนยันผู้ใช้ผ่าน Supabase Auth ก่อน แล้วเพิ่มเฉพาะ UUID ของผู้ใช้ที่ได้รับอนุญาตลง `staff_roles` พร้อม role ที่เหมาะสม (`admin`, `coordinator`, `reviewer`, `advisor`) และ `active = true` ห้ามใส่ service-role key ในหน้าเว็บหรือ repository

หลังจากนั้นเปิด Google provider ใน Supabase Auth และตั้ง callback URL เป็น `https://tammawrk-png.github.io/certificate-number-search/staff.html` จากนั้นทดสอบหน้า `staff.html` ด้วยปุ่ม Google: อีเมลที่ไม่ลงท้าย `@wrk.ac.th` ต้องถูกปฏิเสธ และบัญชีองค์กรที่ยังไม่มีแถว active ใน `staff_roles` ต้องไม่เห็นแถวรายงาน

## นำเข้าและจับคู่

1. อ่าน Firebase แบบ read-only และบันทึกจำนวนจาก live source เป็น import batch
2. อ่าน roster ปัจจุบันผ่าน `audit-roster-xlsx.py` ก่อนสร้าง SQL import
3. ตรวจ duplicate student number, room boundary และนักเรียนที่ออกแล้วก่อนวาง SQL ใน authenticated SQL Editor
4. รัน `refresh_certificate_matches_staff()` แล้วส่ง ambiguous matches เข้า review เท่านั้น
5. ห้ามถือ name-only match เป็นการยืนยันถาวรจนกว่าจะมีเจ้าหน้าที่ตรวจ

## เปิดรับสมัคร

ตรวจ roster, registration rules และระบบ staff ก่อน แล้วค่อยเปิด `registration_windows.is_open` ตามกำหนดการจริง หน้า public จะอ่านสถานะจาก RPC และการ submit จะถูกตรวจซ้ำที่ฐานข้อมูล

## รายงาน

- รายงานโรงเรียนใช้ `school_report_rows(year)` และ export จากพื้นที่ staff
- รายงานแม่กองธรรมใช้ `mother_sangha_report_rows(year, level)` แยกทีละ ตรี/โท/เอก
- นำแถวไปเติมในสำเนาของ template ระดับเดียวกันเท่านั้น และตรวจ layout/merged cells/field positions ก่อนส่ง
- เก็บต้นฉบับไว้ ไม่เขียนทับ และเก็บไฟล์ผลลัพธ์ในโฟลเดอร์รายงานที่กำหนดเท่านั้น
