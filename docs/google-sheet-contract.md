# Google Sheet contract

Google Sheets เป็นพื้นที่ตรวจสอบและแลกเปลี่ยนไฟล์กับเจ้าหน้าที่ ไม่ใช่ฐานข้อมูลหลัก ระบบจริงยังยึด Supabase และ Firebase ยังคงอ่านอย่างเดียว

## ชุดไฟล์และแท็บที่แนะนำ

สร้างในโฟลเดอร์ `02_นำเข้าและตรวจสอบ` หรือ `03_รายงานส่งออก` ตามหน้าที่ และไม่สร้างไฟล์ไว้ที่ My Drive root

### 1. `รายชื่อนักเรียน_2569`

แท็บ `roster_staging` ใช้ตรวจข้อมูลก่อน import: `academic_year`, `student_number`, `first_name`, `last_name`, `full_name`, `grade_level`, `education_band`, `room_no`, `advisor_text`, `source_file_name`, `source_sheet_name`

กติกา: ห้ามมีเลขนักเรียนซ้ำ, ห้อง ม.ต้นไม่เกิน 15, ห้อง ม.ปลายไม่เกิน 12, ไม่รวม room 16 และนักเรียนที่ออกแล้ว

### 2. `ตรวจจับคู่ประวัติ_2569`

แท็บ `match_review` ใช้ตรวจ `student_number`, `current_full_name`, `grade_level`, `room_no`, `legacy_firebase_key`, `certificate_no`, `legacy_full_name`, `level`, `exam_year_be`, `status`, `confidence`, `matching_basis`

สถานะที่อนุญาต: `auto_matched`, `review`, `confirmed`, `rejected`, `unmatched` การจับคู่ชื่อซ้ำต้องมีคนตรวจ ไม่ใช้เป็นการยืนยันอัตโนมัติ

### 3. `สมัครสอบ_2569`

แท็บ `registration_review` ใช้ติดตาม `student_number`, `full_name`, `education_band`, `grade_level`, `room_no`, `advisor_1`, `advisor_2`, `dhamma_level`, `application_status`, `reference_code`, `follow_up_status`

### 4. `ประกาศทางการ_2569`

แท็บ `official_import_staging` ใช้รับข้อมูลจากประกาศจริง: `record_key`, `record_type`, `academic_year`, `student_number`, `full_name`, `dhamma_level`, `eligibility_status`, `room_name`, `building`, `capacity`, `seat_no`, `result_status`, `score`, `official_reference`, `source_file_name`, `source_sheet_name`, `process_status`, `process_note`

`record_type` มีเฉพาะ `eligibility`, `seat`, `result` และต้องมี source file/official reference ตามที่หาได้ ห้ามกรอกห้องสอบ เลขที่สอบ หรือผลสอบจากการคาดเดา

## การควบคุมการเขียน

- นำเข้าจาก Sheet เข้า staging ก่อน แล้วให้เจ้าหน้าที่ apply ผ่าน Supabase
- ไม่ให้สูตรหรือผู้ใช้ใน Sheet เขียนกลับ Firebase
- ไม่ใช้ Sheet เป็น public API และไม่เปิดสิทธิ์สาธารณะ
- รายงานจาก Sheet ต้องเก็บในโฟลเดอร์ที่กำหนดและใช้ชื่อไฟล์มีปี/ระดับชัดเจน
