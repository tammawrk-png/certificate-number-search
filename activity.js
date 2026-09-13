(() => {
  const $ = (selector) => document.querySelector(selector);
  $('#registration-form').addEventListener('submit', (event) => {
    event.preventDefault();
    $('#registration-message').textContent = 'แบบฟอร์มพร้อมส่งเข้าระบบ เมื่อเปิดรับสมัครและเชื่อม API แล้ว';
  });
  $('#lookup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = $('#lookup-input').value.trim();
    $('#lookup-result').textContent = query ? 'ยังไม่พบประกาศทางการสำหรับการค้นหานี้ ระบบจะแสดงข้อมูลเมื่อเจ้าหน้าที่นำเข้าประกาศแล้ว' : 'กรุณากรอกเลขประจำตัวหรือชื่อ-นามสกุล';
  });
})();
