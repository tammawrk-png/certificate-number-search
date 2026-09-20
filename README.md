# ระบบกิจกรรมธรรมศึกษา โรงเรียนวัดไร่ขิงวิทยา

ระบบนี้ต่อยอดจากหน้าค้นเลขใบประกาศเดิม โดยแยกงานกิจกรรมธรรมศึกษาใหม่ออกเป็นส่วนรับสมัคร ตรวจจับคู่ประวัติ รายงาน และตรวจสอบประกาศทางการ

## ขอบเขตระบบ

- หน้า `index.html` คงการค้นเลขใบประกาศเดิมและอ่าน Firebase แบบ read-only
- หน้า `dharma/` เป็นแดชบอร์ดสาธารณะ รับสมัคร และตรวจสอบสถานะประกาศ
- หน้า `dharma/?admin=1` เป็นพื้นที่เจ้าหน้าที่หลังยืนยัน Google และตรวจสิทธิ์ `staff_roles`
- Supabase/PostgreSQL เป็นฐานข้อมูลหลักของ roster, matching, registration, eligibility, seat, result และ audit log
- Google Sheets ใช้เป็นพื้นที่ staging/review ที่ควบคุมสิทธิ์ ไม่ใช่ฐานข้อมูลหลัก
- Google Drive เก็บต้นฉบับฟอร์มแม่กองธรรมและรายงานในโฟลเดอร์โครงการที่กำหนด
- GitHub เก็บ source code, migration, test และ workflow deploy เท่านั้น

## กติกาข้อมูลสำคัญ

- ห้ามเขียนกลับ Firebase และห้ามทำ dual-write
- ห้ามใส่ service-role key, Google credential หรือข้อมูลลับใน frontend และ repository
- ไม่รวม room 16 และไม่แตะนักเรียนที่ออกแล้ว
- ระดับธรรมศึกษา ตรี โท เอก และสาย ม.ต้น/ม.ปลายต้องแยกกัน
- ห้องสอบ เลขที่สอบ และผลสอบจะแสดงเมื่อมีข้อมูลประกาศทางการและเจ้าหน้าที่นำเข้าแล้วเท่านั้น
- ต้นฉบับ `.xls` แม่กองธรรมทั้งสามระดับต้องคงรูปแบบเดิม ห้ามรวมชั้นหรือปรับตำแหน่งช่อง
- การสร้างไฟล์ส่งจริงใช้ `scripts/fill-mother-sangha-form.py` เติมลงในสำเนาเท่านั้น โดยตรวจหัวฟอร์ม/merged cells ก่อนเขียนและแปลงกลับเป็น `.xls`; ห้ามส่งไฟล์ต้นฉบับเข้าโปรแกรมเพื่อเขียนทับ

## ลำดับ migration

รันใน Supabase SQL Editor ตามลำดับนี้ และตรวจผลแต่ละไฟล์ก่อนทำไฟล์ถัดไป:

`0001` → `0002` → `0003` → `0004` → `0006` → `0007` → `0008` → `0009` → `0010` → `0011` → `0012` → `0013` → `0014` → `0015` → `0016` → `0017` → `0018` → `0019` → `0020` → `0021` → `0022` → `0023` → `0024` → `0025` → `0026` → `0027` → `0028` → `0029` → `0030` → `0031` → `0032` → `0033` → `0034` → `0035` → `0036` → `0037`

รายละเอียดการเปิดใช้งานอยู่ที่ [`docs/supabase-activation-runbook.md`](docs/supabase-activation-runbook.md)

## การพัฒนาต่อจากเครื่องอื่น

1. เปิด repository นี้ผ่าน VS Code
2. ใช้ Chrome profile `Tamma` และบัญชี `tammawrk@gmail.com` สำหรับ Google/Supabase/GitHub
3. ตรวจ `git status` ก่อนแก้ไข และห้ามนำไฟล์ข้อมูลดิบหรือ credential เข้า Git
4. อ่าน `skills/dharma-education-system/SKILL.md` และเอกสารใน `docs/` ที่เกี่ยวข้องก่อนทำงาน
5. รันชุดทดสอบก่อน push:

```bash
node --test scripts/public-surface-smoke.mjs scripts/migration-contract.test.mjs scripts/roster-policy.test.mjs
```

การ deploy ใช้ GitHub Pages ผ่าน `.github/workflows/deploy.yml` โดย `SUPABASE_PUBLISHABLE_KEY` ต้องอยู่ใน GitHub Actions secret เท่านั้น ระบบจะเติมค่าเฉพาะระหว่าง deploy

เมื่อตั้งค่า Supabase แล้ว ให้ตรวจ API จริงโดยไม่เขียนข้อมูลด้วยคำสั่งนี้ (ห้ามใส่คีย์ในคำสั่งหรือไฟล์):

```bash
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_PUBLISHABLE_KEY="<publishable-key>" \
node scripts/supabase-live-smoke.mjs
```

สคริปต์เรียกเฉพาะ public RPC ด้วยค่าทดสอบที่ไม่ใช่ข้อมูลนักเรียน และไม่พิมพ์ response หรือคีย์ออกมา

## เอกสารหลัก

- [`docs/architecture-and-rollout.md`](docs/architecture-and-rollout.md)
- [`docs/api-contract.md`](docs/api-contract.md)
- [`docs/registration-ux-flow.md`](docs/registration-ux-flow.md)
- [`docs/report-contract.md`](docs/report-contract.md)
- [`docs/google-sheet-contract.md`](docs/google-sheet-contract.md)
- [`docs/supabase-activation-runbook.md`](docs/supabase-activation-runbook.md)
