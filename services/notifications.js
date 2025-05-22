// services/notifications.js - ตัวจัดการการแจ้งเตือน
const db = require('../config/database');

/**
 * สร้างการแจ้งเตือนใหม่
 * @param {Object} notification ข้อมูลการแจ้งเตือน
 * @returns {Promise<number>} ID ของการแจ้งเตือน
 */
const createNotification = async (notification) => {
  try {
    const { userId, type, title, message, data = null, isRead = false } = notification;
    
    // สร้างตาราง notifications ถ้ายังไม่มี
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSON,
        isRead BOOLEAN DEFAULT FALSE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    
    const [result] = await db.query(`
      INSERT INTO notifications 
      (userId, type, title, message, data, isRead) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      userId,
      type,
      title,
      message,
      data ? JSON.stringify(data) : null,
      isRead ? 1 : 0
    ]);
    
    return result.insertId;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

/**
 * ดึงการแจ้งเตือนของผู้ใช้
 * @param {number} userId รหัสผู้ใช้
 * @param {number} limit จำนวนที่ต้องการดึง
 * @param {boolean} onlyUnread ดึงเฉพาะที่ยังไม่ได้อ่าน
 * @returns {Promise<Array>} รายการแจ้งเตือน
 */
const getUserNotifications = async (userId, limit = 10, onlyUnread = false) => {
  try {
    let query = `
      SELECT * FROM notifications 
      WHERE userId = ?
    `;
    
    if (onlyUnread) {
      query += ' AND isRead = 0';
    }
    
    query += ' ORDER BY createdAt DESC LIMIT ?';
    
    const [rows] = await db.query(query, [userId, limit]);
    
    return rows.map(row => ({
      ...row,
      data: row.data ? JSON.parse(row.data) : null
    }));
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * อ่านการแจ้งเตือน
 * @param {number} notificationId รหัสการแจ้งเตือน
 * @param {number} userId รหัสผู้ใช้
 * @returns {Promise<boolean>} สถานะการอัพเดท
 */
const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const [result] = await db.query(
      'UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?',
      [notificationId, userId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * อ่านการแจ้งเตือนทั้งหมด
 * @param {number} userId รหัสผู้ใช้
 * @returns {Promise<boolean>} สถานะการอัพเดท
 */
const markAllNotificationsAsRead = async (userId) => {
  try {
    const [result] = await db.query(
      'UPDATE notifications SET isRead = 1 WHERE userId = ?',
      [userId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};

/**
 * สร้างการแจ้งเตือนเมื่อรอบเสร็จสิ้น
 * @param {number} planId รหัสแพลน
 * @param {number} cycleNumber หมายเลขรอบ
 * @returns {Promise<void>}
 */
const notifyCycleCompleted = async (planId, cycleNumber) => {
  try {
    // หาผู้ใช้ที่อยู่ในแพลนนี้และรอบนี้
    const [members] = await db.query(`
      SELECT u.id, m.planId, m.cycleNumber, m.walletAddress, m.totalReferrals
      FROM users u
      JOIN members m ON u.walletAddress = m.walletAddress
      WHERE m.planId = ? AND m.cycleNumber = ?
    `, [planId, cycleNumber]);
    
    // สร้างการแจ้งเตือนสำหรับแต่ละสมาชิก
    for (const member of members) {
      await createNotification({
        userId: member.id,
        type: 'cycle_completed',
        title: 'รอบของคุณเสร็จสิ้นแล้ว',
        message: `รอบที่ ${cycleNumber} ของแพลน ${planId} เสร็จสิ้นแล้ว มีสมาชิกครบตามจำนวน`,
        data: {
          planId,
          cycleNumber,
          memberId: member.id,
          walletAddress: member.walletAddress
        }
      });
    }
    
    // แจ้งเตือนแอดมิน
    const [admins] = await db.query(`
      SELECT id FROM users WHERE role IN ('admin', 'owner')
    `);
    
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'admin_cycle_completed',
        title: 'รอบเสร็จสิ้น',
        message: `รอบที่ ${cycleNumber} ของแพลน ${planId} เสร็จสิ้นแล้ว มีสมาชิกครบตามจำนวน`,
        data: {
          planId,
          cycleNumber,
          memberCount: members.length
        }
      });
    }
  } catch (error) {
    console.error('Error creating cycle completed notifications:', error);
    throw error;
  }
};

/**
 * สร้างการแจ้งเตือนเมื่อได้รับการแนะนำ
 * @param {string} referrerWallet ที่อยู่กระเป๋าผู้แนะนำ
 * @param {string} refereeWallet ที่อยู่กระเป๋าผู้ถูกแนะนำ
 * @param {number} planId รหัสแพลน
 * @param {string} commission จำนวนค่าคอมมิชชั่น
 * @returns {Promise<void>}
 */
const notifyReferralCommission = async (referrerWallet, refereeWallet, planId, commission) => {
  try {
    // หาผู้ใช้จากที่อยู่กระเป๋า
    const [referrer] = await db.query(`
      SELECT id, username FROM users WHERE walletAddress = ?
    `, [referrerWallet]);
    
    if (referrer.length === 0) {
      return;
    }
    
    // สร้างการแจ้งเตือน
    await createNotification({
      userId: referrer[0].id,
      type: 'referral_commission',
      title: 'ได้รับค่าคอมมิชชั่น',
      message: `คุณได้รับค่าคอมมิชชั่น ${commission} USDT จากการแนะนำสมาชิกใหม่`,
      data: {
        referrerWallet,
        refereeWallet,
        planId,
        commission
      }
    });
  } catch (error) {
    console.error('Error creating referral commission notification:', error);
    throw error;
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  notifyCycleCompleted,
  notifyReferralCommission
};