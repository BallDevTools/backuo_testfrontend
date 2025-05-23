// services/user.js - ตัวจัดการข้อมูลผู้ใช้ (เฉพาะ admin/owner)
const db = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * ดึงข้อมูลผู้ใช้จากชื่อผู้ใช้
 * @param {string} username ชื่อผู้ใช้
 * @returns {Promise<Object>} ข้อมูลผู้ใช้
 */
const getUserByUsername = async (username) => {
  try {
    const [rows] = await db.query('SELECT * FROM admin_users WHERE username = ?', [username]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting user by username:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูลผู้ใช้จากที่อยู่กระเป๋า
 * @param {string} walletAddress ที่อยู่กระเป๋า
 * @returns {Promise<Object>} ข้อมูลผู้ใช้
 */
const getUserByWalletAddress = async (walletAddress) => {
  try {
    const [rows] = await db.query('SELECT * FROM admin_users WHERE walletAddress = ?', [walletAddress]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting user by wallet address:', error);
    throw error;
  }
};

/**
 * สร้างผู้ใช้ใหม่ (เฉพาะ admin/owner)
 * @param {string} username ชื่อผู้ใช้
 * @param {string} password รหัสผ่าน
 * @param {string} role บทบาท ('admin' หรือ 'owner' เท่านั้น)
 * @returns {Promise<Object>} ข้อมูลผู้ใช้ที่สร้าง
 */
const createUser = async (username, password, role) => {
  try {
    // ตรวจสอบว่า role เป็น admin หรือ owner เท่านั้น
    if (role !== 'admin' && role !== 'owner') {
      throw new Error('Role must be admin or owner only');
    }
    
    // เข้ารหัสรหัสผ่าน
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // เพิ่มผู้ใช้ใหม่
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
    console.error('Error creating user:', error);
    throw error;
  }
};

/**
 * อัพเดทที่อยู่กระเป๋าของผู้ใช้
 * @param {number} userId รหัสผู้ใช้
 * @param {string} walletAddress ที่อยู่กระเป๋า
 * @returns {Promise<boolean>} สถานะการอัพเดท
 */
const updateWalletAddress = async (userId, walletAddress) => {
  try {
    const [result] = await db.query(
      'UPDATE admin_users SET walletAddress = ? WHERE id = ?',
      [walletAddress, userId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating wallet address:', error);
    throw error;
  }
};

/**
 * เปลี่ยนรหัสผ่านของผู้ใช้
 * @param {number} userId รหัสผู้ใช้
 * @param {string} newPassword รหัสผ่านใหม่
 * @returns {Promise<boolean>} สถานะการเปลี่ยนรหัสผ่าน
 */
const changePassword = async (userId, newPassword) => {
  try {
    // เข้ารหัสรหัสผ่านใหม่
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // อัพเดทรหัสผ่าน
    const [result] = await db.query(
      'UPDATE admin_users SET password_hash = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

/**
 * ตรวจสอบรหัสผ่าน
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
 * ดึงข้อมูลผู้ใช้ทั้งหมด (admin/owner)
 * @returns {Promise<Array>} รายการผู้ใช้ทั้งหมด
 */
const getAllUsers = async () => {
  try {
    const [rows] = await db.query('SELECT id, username, role, walletAddress, created_at FROM admin_users');
    return rows;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

module.exports = {
  getUserByUsername,
  getUserByWalletAddress,
  createUser,
  updateWalletAddress,
  changePassword,
  comparePassword,
  getAllUsers
};