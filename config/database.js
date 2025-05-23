// config/database.js - ตั้งค่าการเชื่อมต่อกับฐานข้อมูล MySQL (Minimal)
const mysql = require('mysql2/promise');
require('dotenv').config();

// สร้าง connection pool สำหรับ MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crypto_membership_minimal',
  waitForConnections: true,
  connectionLimit: 5, // ลดลงเพราะใช้น้อย
  queueLimit: 0
});

// ฟังก์ชันสร้างตารางในฐานข้อมูล (เฉพาะ admin_users)
const initDB = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`MySQL Connected: ${connection.threadId}`);

    // สร้างตาราง admin_users ถ้ายังไม่มี (เฉพาะ admin และ owner)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'owner') NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME NULL,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // สร้างข้อมูลเริ่มต้น (admin, owner) ถ้าไม่มี
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM admin_users');
    if (rows[0].count === 0) {
      // เพิ่มผู้ใช้เริ่มต้น (รหัสผ่านเป็น bcrypt hash)
      await connection.query(`
        INSERT INTO admin_users (username, password_hash, role) VALUES 
        ('admin', '$2a$04$xAnC35wFxRdK01IJ8m..c.8CAcRXZNx9.AYq5XLyKgZbZpZ56PJN6', 'admin'),
        ('owner', '$2a$04$xAnC35wFxRdK01IJ8m..c.8CAcRXZNx9.AYq5XLyKgZbZpZ56PJN6', 'owner')
      `);
      console.log('Default admin/owner users created');
    }

    connection.release();
    console.log('Minimal database initialized successfully');
  } catch (error) {
    console.error(`Error initializing database: ${error.message}`);
    process.exit(1);
  }
};

// execute database ตอนเริ่มแอพพลิเคชัน
initDB();

module.exports = pool;