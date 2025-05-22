// services/plan.js - ตัวจัดการข้อมูลแพลน
const db = require('../config/database');
const contractService = require('./contract');

/**
 * บันทึกข้อมูลแพลนจากบล็อกเชนลงฐานข้อมูล
 * @returns {Promise<void>}
 */
const syncPlansFromBlockchain = async () => {
  try {
    // ดึงข้อมูลแพลนจากบล็อกเชน
    const plans = await contractService.getAllPlans();
    
    // สร้างตาราง plans ถ้ายังไม่มี
    await db.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id INT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(18, 6) NOT NULL,
        membersPerCycle INT NOT NULL,
        currentCycle INT NOT NULL,
        membersInCurrentCycle INT NOT NULL,
        isActive BOOLEAN NOT NULL,
        imageURI VARCHAR(255),
        lastSynced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // อัพเดทข้อมูลแพลนในฐานข้อมูล
    for (const plan of plans) {
      await db.query(`
        INSERT INTO plans 
        (id, name, price, membersPerCycle, currentCycle, membersInCurrentCycle, isActive) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        price = VALUES(price),
        membersPerCycle = VALUES(membersPerCycle),
        currentCycle = VALUES(currentCycle),
        membersInCurrentCycle = VALUES(membersInCurrentCycle),
        isActive = VALUES(isActive),
        lastSynced = CURRENT_TIMESTAMP
      `, [
        plan.id,
        plan.name,
        plan.price,
        plan.membersPerCycle,
        plan.currentCycle,
        plan.membersInCurrentCycle,
        plan.isActive ? 1 : 0
      ]);
    }
    
    console.log('Plans synced from blockchain successfully');
  } catch (error) {
    console.error('Error syncing plans from blockchain:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูลแพลนทั้งหมดจากฐานข้อมูล
 * @returns {Promise<Array>} รายการแพลนทั้งหมด
 */
const getAllPlansFromDB = async () => {
  try {
    const [rows] = await db.query('SELECT * FROM plans ORDER BY id');
    return rows;
  } catch (error) {
    console.error('Error getting plans from database:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูลแพลนจากรหัสแพลน
 * @param {number} planId รหัสแพลน
 * @returns {Promise<Object>} ข้อมูลแพลน
 */
const getPlanById = async (planId) => {
  try {
    const [rows] = await db.query('SELECT * FROM plans WHERE id = ?', [planId]);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error getting plan by id:', error);
    throw error;
  }
};

/**
 * อัพเดทสถานะแพลนในฐานข้อมูล
 * @param {number} planId รหัสแพลน
 * @param {boolean} isActive สถานะแพลน
 * @returns {Promise<boolean>} สถานะการอัพเดท
 */
const updatePlanStatus = async (planId, isActive) => {
  try {
    const [result] = await db.query(
      'UPDATE plans SET isActive = ?, lastSynced = CURRENT_TIMESTAMP WHERE id = ?',
      [isActive ? 1 : 0, planId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating plan status:', error);
    throw error;
  }
};

/**
 * อัพเดท URI รูปภาพของแพลน
 * @param {number} planId รหัสแพลน
 * @param {string} imageURI URI ของรูปภาพ
 * @returns {Promise<boolean>} สถานะการอัพเดท
 */
const updatePlanImageURI = async (planId, imageURI) => {
  try {
    const [result] = await db.query(
      'UPDATE plans SET imageURI = ?, lastSynced = CURRENT_TIMESTAMP WHERE id = ?',
      [imageURI, planId]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error updating plan image URI:', error);
    throw error;
  }
};

/**
 * บันทึกข้อมูลธุรกรรมการสมัครหรืออัพเกรดแพลน
 * @param {number} userId รหัสผู้ใช้
 * @param {string} walletAddress ที่อยู่กระเป๋า
 * @param {string} transactionType ประเภทธุรกรรม (register, upgrade)
 * @param {number} planId รหัสแพลน
 * @param {number} amount จำนวนเงิน
 * @param {string} txHash แฮชของธุรกรรม
 * @returns {Promise<Object>} ข้อมูลธุรกรรม
 */
const recordPlanTransaction = async (userId, walletAddress, transactionType, planId, amount, txHash = null) => {
  try {
    const [result] = await db.query(`
      INSERT INTO transactions 
      (userId, walletAddress, transactionType, planId, amount, txHash, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      walletAddress,
      transactionType,
      planId,
      amount,
      txHash,
      txHash ? 'completed' : 'pending'
    ]);
    
    return {
      id: result.insertId,
      userId,
      walletAddress,
      transactionType,
      planId,
      amount,
      txHash,
      status: txHash ? 'completed' : 'pending',
      createdAt: new Date()
    };
  } catch (error) {
    console.error('Error recording plan transaction:', error);
    throw error;
  }
};

module.exports = {
  syncPlansFromBlockchain,
  getAllPlansFromDB,
  getPlanById,
  updatePlanStatus,
  updatePlanImageURI,
  recordPlanTransaction
};