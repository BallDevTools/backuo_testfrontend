// routes/owner.js - เส้นทางสำหรับเจ้าของระบบ
const express = require('express');
const router = express.Router();
const { isAuthenticated, isOwner, hasWallet } = require('../middleware/auth');
const contractService = require('../services/contract');
const contractConfig = require('../config/blockchain');

// แสดงแดชบอร์ดเจ้าของระบบ
router.get('/dashboard', isAuthenticated, isOwner, hasWallet, async (req, res) => {
  try {
    // ดึงข้อมูลสถิติของระบบ
    const systemStats = await contractService.getSystemStats();
    
    // ดึงข้อมูลสถานะของสัญญา
    const contractStatus = await contractService.getContractStatus();
    
    // ตรวจสอบยอดเงินในสัญญา
    const balanceValidation = await contractService.validateContractBalance();
    
    res.render('owner/dashboard', {
      title: 'แดชบอร์ดเจ้าของระบบ',
      systemStats,
      contractStatus,
      balanceValidation,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching owner dashboard data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/');
  }
});

// แสดงหน้าจัดการการถอนเงิน
router.get('/withdrawals', isAuthenticated, isOwner, hasWallet, async (req, res) => {
  try {
    // ดึงข้อมูลสถิติของระบบ
    const systemStats = await contractService.getSystemStats();
    
    // ดึงข้อมูลการถอนเงินจากฐานข้อมูล (ถ้ามี)
    // สมมติว่ามีฟังก์ชัน getWithdrawalsHistory
    const withdrawals = []; // ควรดึงจากฐานข้อมูลจริง
    
    res.render('owner/withdrawals', {
      title: 'จัดการการถอนเงิน',
      systemStats,
      withdrawals,
      contractAddress: contractConfig.contractAddress,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching withdrawal data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/owner/dashboard');
  }
});

// API ถอนเงินจากส่วนต่างๆ
router.post('/withdrawals/withdraw', isAuthenticated, isOwner, hasWallet, async (req, res) => {
  try {
    const { amount, balanceType } = req.body;
    
    // ถอนเงิน
    await contractService.withdrawBalance(
      req.session.walletAddress, 
      parseFloat(amount), 
      parseInt(balanceType)
    );
    
    req.flash('success_msg', 'ถอนเงินสำเร็จ');
    res.redirect('/owner/withdrawals');
  } catch (error) {
    console.error('Error withdrawing funds:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการถอนเงิน: ' + error.message);
    res.redirect('/owner/withdrawals');
  }
});

// API ถอนเงินแบบกลุ่ม
router.post('/withdrawals/batch-withdraw', isAuthenticated, isOwner, hasWallet, async (req, res) => {
  try {
    // แปลงข้อมูลคำขอจากฟอร์มให้เป็นแบบที่ถูกต้อง
    const recipients = Array.isArray(req.body.recipients) ? req.body.recipients : [req.body.recipients];
    const amounts = Array.isArray(req.body.amounts) ? req.body.amounts : [req.body.amounts];
    const balanceTypes = Array.isArray(req.body.balanceTypes) ? req.body.balanceTypes : [req.body.balanceTypes];
    
    const requests = [];
    for (let i = 0; i < recipients.length; i++) {
      requests.push({
        recipient: recipients[i],
        amount: parseFloat(amounts[i]),
        balanceType: parseInt(balanceTypes[i])
      });
    }
    
    // ถอนเงินแบบกลุ่ม
    await contractService.batchWithdraw(req.session.walletAddress, requests);
    
    req.flash('success_msg', 'ถอนเงินแบบกลุ่มสำเร็จ');
    res.redirect('/owner/withdrawals');
  } catch (error) {
    console.error('Error batch withdrawing funds:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการถอนเงินแบบกลุ่ม: ' + error.message);
    res.redirect('/owner/withdrawals');
  }
});

// แสดงหน้าฟังก์ชันฉุกเฉิน
router.get('/emergency', isAuthenticated, isOwner, hasWallet, async (req, res) => {
  try {
    // ดึงข้อมูลสถานะของสัญญา
    const contractStatus = await contractService.getContractStatus();
    
    // ตรวจสอบยอดเงินในสัญญา
    const balanceValidation = await contractService.validateContractBalance();
    
    res.render('owner/emergency', {
      title: 'ฟังก์ชันฉุกเฉิน',
      contractStatus,
      balanceValidation,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching emergency data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/owner/dashboard');
  }
});

// API ร้องขอถอนเงินฉุกเฉิน
router.post('/emergency/request', isAuthenticated, isOwner, hasWallet, async (req, res) => {
  try {
    // ร้องขอถอนเงินฉุกเฉิน
    await contractService.requestEmergencyWithdraw(req.session.walletAddress);
    
    req.flash('success_msg', 'ร้องขอถอนเงินฉุกเฉินสำเร็จ');
    res.redirect('/owner/emergency');
  } catch (error) {
    console.error('Error requesting emergency withdrawal:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการร้องขอถอนเงินฉุกเฉิน: ' + error.message);
    res.redirect('/owner/emergency');
  }
});

// API ยกเลิกการร้องขอถอนเงินฉุกเฉิน
router.post('/emergency/cancel', isAuthenticated, isOwner, hasWallet, async (req, res) => {
  try {
    // ยกเลิกการร้องขอถอนเงินฉุกเฉิน
    await contractService.cancelEmergencyWithdraw(req.session.walletAddress);
    
    req.flash('success_msg', 'ยกเลิกการร้องขอถอนเงินฉุกเฉินสำเร็จ');
    res.redirect('/owner/emergency');
  } catch (error) {
    console.error('Error canceling emergency withdrawal request:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการยกเลิกการร้องขอถอนเงินฉุกเฉิน: ' + error.message);
    res.redirect('/owner/emergency');
  }
});

// API ดำเนินการถอนเงินฉุกเฉิน
router.post('/emergency/withdraw', isAuthenticated, isOwner, hasWallet, async (req, res) => {
  try {
    // ดำเนินการถอนเงินฉุกเฉิน
    await contractService.emergencyWithdraw(req.session.walletAddress);
    
    req.flash('success_msg', 'ถอนเงินฉุกเฉินสำเร็จ');
    res.redirect('/owner/emergency');
  } catch (error) {
    console.error('Error performing emergency withdrawal:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการถอนเงินฉุกเฉิน: ' + error.message);
    res.redirect('/owner/emergency');
  }
});

module.exports = router;