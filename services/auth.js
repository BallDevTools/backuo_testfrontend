// services/auth.js - ตัวจัดการข้อมูล Admin/Owner เท่านั้น
const db = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * ดึงข้อมูล Admin/Owner จากชื่อผู้ใช้
 * @param {string} username ชื่อผู้ใช้
 * @returns {Promise<Object>} ข้อมูล Admin/Owner
 */
const getAdminByUsername = async (username) => {
  try {
    const [rows] = await db.query('SELECT * FROM admin_users WHERE username = ? AND is_active = TRUE', [username]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting admin by username:', error);
    throw error;
  }
};

/**
 * สร้าง Admin ใหม่ (เฉพาะ owner สามารถสร้าง admin ได้)
 * @param {string} username ชื่อผู้ใช้
 * @param {string} password รหัสผ่าน
 * @param {string} role บทบาท ('admin' หรือ 'owner' เท่านั้น)
 * @returns {Promise<Object>} ข้อมูล Admin ที่สร้าง
 */
const createAdmin = async (username, password, role) => {
  try {
    // ตรวจสอบว่า role เป็น admin หรือ owner เท่านั้น
    if (role !== 'admin' && role !== 'owner') {
      throw new Error('Role must be admin or owner only');
    }
    
    // เข้ารหัสรหัสผ่าน
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // เพิ่ม Admin ใหม่
    const [result] = await db.query(
      'INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role]
    );
    
    return {
      id: result.insertId,
      username,
      role
    };
  } catch (error) {
    console.error('Error creating admin:', error);
    throw error;
  }
};

/**
 * เปลี่ยนรหัสผ่าน Admin
 * @param {number} adminId รหัส Admin
 * @param {string} newPassword รหัสผ่านใหม่
 * @returns {Promise<boolean>} สถานะการเปลี่ยนรหัสผ่าน
 */
const changeAdminPassword = async (adminId, newPassword) => {
  try {
    // เข้ารหัสรหัสผ่านใหม่
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // อัพเดทรหัสผ่าน
    const [result] = await db.query(
      'UPDATE admin_users SET password_hash = ? WHERE id = ?',
      [hashedPassword, adminId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error changing admin password:', error);
    throw error;
  }
};

/**
 * ตรวจสอบรหัสผ่าน Admin
 * @param {string} password รหัสผ่านที่ผู้ใช้ป้อน
 * @param {string} hashedPassword รหัสผ่านที่เข้ารหัสแล้วจากฐานข้อมูล
 * @returns {Promise<boolean>} ผลการตรวจสอบรหัสผ่าน
 */
const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    console.error('Error comparing password:', error);
    throw error;
  }
};

/**
 * อัพเดทเวลาการล็อกอิน
 * @param {number} adminId รหัส Admin
 * @returns {Promise<boolean>} สถานะการอัพเดท
 */
const updateLastLogin = async (adminId) => {
  try {
    const [result] = await db.query(
      'UPDATE admin_users SET last_login = NOW() WHERE id = ?',
      [adminId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating last login:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูล Admin ทั้งหมด
 * @returns {Promise<Array>} รายการ Admin ทั้งหมด
 */
const getAllAdmins = async () => {
  try {
    const [rows] = await db.query('SELECT id, username, role, created_at, last_login, is_active FROM admin_users ORDER BY created_at');
    return rows;
  } catch (error) {
    console.error('Error getting all admins:', error);
    throw error;
  }
};

module.exports = {
  getAdminByUsername,
  createAdmin,
  changeAdminPassword,
  comparePassword,
  updateLastLogin,
  getAllAdmins
};