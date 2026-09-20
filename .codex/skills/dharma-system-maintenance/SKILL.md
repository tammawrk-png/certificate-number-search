---
name: dharma-system-maintenance
description: Maintain the Dharma education registration system with minimal, evidence-based changes that preserve working UI, data rules, security, matching, printing, and Supabase-to-Google-Sheets synchronization.
metadata:
  short-description: Safe incremental maintenance for the Dharma education system
---

# Dharma System Maintenance Skill

ใช้ skill นี้กับทุกงานที่ตรวจ แก้บั๊ก พัฒนา UI/data flow, matching, Supabase, Google Sheets, worker, การพิมพ์ หรือการ deploy ของระบบนี้

## ต้องอ่านก่อนเริ่ม

อ่าน `AGENTS.md` และ `PROJECT_RULES.md` ที่ project root ก่อนเสมอ จากนั้นอ่านเฉพาะเอกสาร/โค้ดที่เกี่ยวข้องกับงานปัจจุบัน ห้ามเริ่มจากการแก้ไฟล์ทันที

## ขั้นตอนบังคับ

1. ตรวจ `git status`, branch และ diff ปัจจุบัน
2. ระบุพฤติกรรมที่ผู้ใช้บอกว่าดีแล้ว และทำรายการ “ห้ามแตะ”
3. ค้นหา entry point, function, migration, CSS breakpoint หรือ workflow ที่เกี่ยวข้อง
4. สร้างแผนเปลี่ยนแปลงเล็กที่สุด โดยไม่รื้อระบบเดิม
5. แก้ด้วย patch ที่ตรวจสอบย้อนกลับได้
6. ทดสอบเฉพาะจุดและ regression ที่อาจได้รับผลกระทบ
7. ตรวจ diff และความปลอดภัยก่อนเสนอ push/deploy

## กติกาข้อมูลและสิทธิ์

- Supabase เป็น source of truth; Google Sheets เป็น synchronized report
- ใช้ stable student/registration identifiers ไม่ใช้เลขแถวเป็น identity
- หน้าเว็บไม่เก็บหรือส่ง secret ของ Google/Supabase service role
- PII เช่น เลขประชาชนและวันเกิดต้องจำกัดตาม role และไม่อยู่ใน public surface
- ห้ามทำ direct browser CRUD ไป Google Sheets
- งานซิงก์ต้อง idempotent, ไม่ append ซ้ำ, รองรับ update/add/remove และมี queue/lock หากทำแบบ immediate sync
- หากแก้ชีทโดยตรง ต้องถือว่าเป็นรายงานชั่วคราวและอาจถูกเขียนทับในการซิงก์รอบถัดไป เว้นแต่มีระบบนำเข้าที่อนุมัติแยกต่างหาก

## UI/UX ที่ต้องรักษา

- Desktop table, print layout, column order, matching display และ validation ที่ผู้ใช้ยืนยันแล้วห้ามเปลี่ยนโดยไม่เกี่ยวข้อง
- Mobile ควรใช้ card/modal รายคน ไม่บังคับ horizontal scrolling หากงานที่แก้คือ mobile UX
- ห้ามซ่อนค่าที่ผู้ใช้กำลังกรอก โดยเฉพาะเลขประชาชนที่กรอกไม่ครบ
- ตรวจทั้งสถานะกรอกแล้ว/ยังไม่กรอก/ข้อมูลไม่ครบ/พิเศษ/สอบ/ไม่สอบ

## การตรวจงานซิงก์

เมื่อแก้ worker, RPC, mapping หรือ workflow ให้ตรวจทั้งเส้นทาง:

`หน้าเว็บ → Supabase → sync queue → worker/endpoint → Google Sheets`

ยืนยันว่า:

- บันทึกคนเดิมเป็น update ไม่ใช่แถวซ้ำ
- เพิ่ม/ลบ/เปลี่ยนสถานะสะท้อนในรายงานตามกติกา
- ไม่สอบและนักเรียนพิเศษไม่ถูกส่งไปไฟล์ส่งสอบตามข้อกำหนด
- location mapping และระดับ ศ.5/ศ.6 ยังตรงฟอร์ม
- workflow สำเร็จและไม่มีข้อมูลลับใน log

## เกณฑ์หยุด

หยุดและถามผู้ใช้ก่อน หากการแก้จำเป็นต้องเปลี่ยนสิทธิ์ข้อมูล, เพิ่ม credential, เปลี่ยนฐานข้อมูลหลัก, ทำ two-way sync, ลบข้อมูลจริง หรือทำให้ส่วนที่ยืนยันแล้วต้องเปลี่ยนพฤติกรรม

## สรุปเมื่อจบงาน

รายงานสั้น ๆ ว่าแก้อะไร, ข้ามอะไรเพราะทำงานดีแล้ว, ทดสอบอะไร, มีข้อจำกัดอะไร และ deploy/push แล้วหรือยัง
