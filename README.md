# ระบบค้นเลขใบประกาศ

เว็บค้นหาเลขใบประกาศแบบ static สำหรับโฮสต์บน GitHub Pages โดยใช้ Firebase Realtime Database เป็นฐานข้อมูลหลัก และ Google Drive เป็นพื้นที่เก็บไฟล์ต้นฉบับ/เอกสารประกอบ

## โครงสร้างการเชื่อมต่อ

- GitHub Pages: โฮสต์ไฟล์หน้าเว็บ
- Firebase Realtime Database: เก็บข้อมูลที่พร้อมค้นหา เช่น `certificates/{certificateId}`
- Google Drive: เก็บไฟล์ PDF/ตารางต้นฉบับและไฟล์สำรอง โดยไม่เปิดเผย folder ID ใน Public repository
- การนำเข้าข้อมูล: ทำผ่านเครื่องมือ/สคริปต์ฝั่งผู้ดูแล ไม่เปิด service-account key ในหน้าเว็บ

## เริ่มต้นใช้งาน

1. คัดลอก `config.example.js` เป็น `config.js`
2. ใส่ Firebase Web App config ของ project ที่จะใช้
3. เปิด `index.html` ผ่าน local web server หรือ GitHub Pages
4. เติมข้อมูลตัวอย่างใน Realtime Database ตามรูปแบบใน `sample-data.json`

`config.js` เป็น Firebase Web config ที่จำเป็นต่อ GitHub Pages และสามารถเปิดเผยฝั่งเว็บได้ตามรูปแบบของ Firebase; ห้ามใส่ service-account key หรือ private key ลงในไฟล์นี้

## รูปแบบข้อมูล

ดูตัวอย่างที่ `sample-data.json` โดยเลขค้นหาจะถูกเก็บเป็น key ที่ normalize แล้ว เช่น เลขไทย/ขีด/ช่องว่างถูกแปลงให้ค้นหาได้สม่ำเสมอ

## ขั้นตอนถัดไป

- ยืนยัน Firebase project สำหรับระบบนี้และเปิด Realtime Database
- ตั้ง Security Rules ให้ผู้ใช้ทั่วไปอ่านได้เฉพาะข้อมูลประกาศ และให้เขียนได้เฉพาะผู้ดูแล
- เข้าสู่ GitHub แล้วสร้าง/เลือก repository สำหรับโปรเจกต์นี้
- เพิ่ม GitHub Actions สำหรับตรวจสอบไฟล์และ deploy ไป GitHub Pages
- สร้างขั้นตอนนำเข้าข้อมูลจาก Google Drive ไป Firebase โดยใช้ Apps Script หรือ backend ที่เก็บ secret ได้

ไฟล์ `database.rules.json` และ `database.schema.json` เป็นต้นแบบสำหรับ project ของบัญชี `tammawrk@gmail.com` เท่านั้น ห้ามนำไปใช้กับ project ของบัญชีอื่น
