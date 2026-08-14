// คัดลอกไฟล์นี้เป็น config.js แล้วเติมค่าจาก Firebase Console > Project settings > Your apps
window.APP_CONFIG = {
  firebase: {
    apiKey: "เติมค่า-apiKey",
    authDomain: "เติมค่า.firebaseapp.com",
    databaseURL: "https://เติมค่า-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "เติมค่า",
    storageBucket: "เติมค่า.firebasestorage.app",
    messagingSenderId: "เติมค่า",
    appId: "เติมค่า"
  },
  // โฟลเดอร์งานที่ตรวจพบใน Google Drive
  // เก็บรหัสโฟลเดอร์ Drive ไว้ในระบบฝั่งเซิร์ฟเวอร์/ตัวแปรลับเท่านั้น
  googleDriveFolderId: null
};
