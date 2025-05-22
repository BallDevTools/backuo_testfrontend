// routes/admin.js - เส้นทางสำหรับแอดมิน
const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin, hasWallet } = require('../middleware/auth');
const contractService = require('../services/contract');

// แสดงแดชบอร์ดแอดมิน
router.get('/dashboard', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    // ดึงข้อมูลสถิติของระบบ
    const systemStats = await contractService.getSystemStats();
    
    // ดึงข้อมูลสถานะของสัญญา
    const contractStatus = await contractService.getContractStatus();
    
    res.render('admin/dashboard', {
      title: 'แดชบอร์ดแอดมิน',
      systemStats,
      contractStatus,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/');
  }
});

// แสดงหน้าจัดการแพลน
router.get('/plans', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    // ดึงข้อมูลแพลนทั้งหมด
    const plans = await contractService.getAllPlans();
    
    res.render('admin/plans', {
      title: 'จัดการแพลน',
      plans,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching plans data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/admin/dashboard');
  }
});

// API เปลี่ยนสถานะแพลน
router.post('/plans/update-status', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    const { planId, isActive } = req.body;
    
    // เปลี่ยนสถานะแพลน
    await contractService.setPlanStatus(req.session.walletAddress, parseInt(planId), isActive === 'true');
    
    req.flash('success_msg', 'อัพเดทสถานะแพลนสำเร็จ');
    res.redirect('/admin/plans');
  } catch (error) {
    console.error('Error updating plan status:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการอัพเดทสถานะแพลน: ' + error.message);
    res.redirect('/admin/plans');
  }
});

// API อัพเดทรูปภาพแพลน
router.post('/plans/update-image', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    const { planId, imageURI } = req.body;
    
    // อัพเดทรูปภาพแพลน
    await contractService.setPlanDefaultImage(req.session.walletAddress, parseInt(planId), imageURI);
    
    req.flash('success_msg', 'อัพเดทรูปภาพแพลนสำเร็จ');
    res.redirect('/admin/plans');
  } catch (error) {
    console.error('Error updating plan image:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการอัพเดทรูปภาพแพลน: ' + error.message);
    res.redirect('/admin/plans');
  }
});

// API อัพเดทจำนวนสมาชิกต่อรอบ
router.post('/plans/update-members-per-cycle', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    const { planId, membersPerCycle } = req.body;
    
    // อัพเดทจำนวนสมาชิกต่อรอบ
    await contractService.updateMembersPerCycle(req.session.walletAddress, parseInt(planId), parseInt(membersPerCycle));
    
    req.flash('success_msg', 'อัพเดทจำนวนสมาชิกต่อรอบสำเร็จ');
    res.redirect('/admin/plans');
  } catch (error) {
    console.error('Error updating members per cycle:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการอัพเดทจำนวนสมาชิกต่อรอบ: ' + error.message);
    res.redirect('/admin/plans');
  }
});

// แสดงหน้าจัดการสมาชิก
router.get('/members', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    // ตรงนี้ต้องมีบริการเพิ่มเติมในการดึงข้อมูลสมาชิกทั้งหมด
    // เราสามารถใช้ event logs หรือเก็บข้อมูลใน backend database เพิ่มเติม
    
    res.render('admin/members', {
      title: 'จัดการสมาชิก',
      members: [], // ตัวอย่างเท่านั้น
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching members data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/admin/dashboard');
  }
});

// แสดงหน้าจัดการการเงิน
router.get('/finance', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    // ดึงข้อมูลสถิติของระบบ
    const systemStats = await contractService.getSystemStats();
    
    // ตรวจสอบยอดเงินในสัญญา
    const balanceValidation = await contractService.validateContractBalance();
    
    res.render('admin/finance', {
      title: 'จัดการการเงิน',
      systemStats,
      balanceValidation,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching finance data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/admin/dashboard');
  }
});

// แสดงหน้าตั้งค่าระบบ
router.get('/settings', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    // ดึงข้อมูลสถานะของสัญญา
    const contractStatus = await contractService.getContractStatus();
    
    res.render('admin/settings', {
      title: 'ตั้งค่าระบบ',
      contractStatus,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching settings data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/admin/dashboard');
  }
});

// API ตั้งค่าสถานะการหยุดทำงานของสัญญา
router.post('/settings/set-paused', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    const { isPaused } = req.body;
    
    // เปลี่ยนสถานะการหยุดทำงานของสัญญา
    await contractService.setPaused(req.session.walletAddress, isPaused === 'true');
    
    req.flash('success_msg', 'อัพเดทสถานะการหยุดทำงานของสัญญาสำเร็จ');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error updating contract paused status:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการอัพเดทสถานะการหยุดทำงานของสัญญา: ' + error.message);
    res.redirect('/admin/settings');
  }
});

// API ตั้งค่า Base URI
router.post('/settings/set-base-uri', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    const { baseURI } = req.body;
    
    // ตั้งค่า Base URI
    await contractService.setBaseURI(req.session.walletAddress, baseURI);
    
    req.flash('success_msg', 'อัพเดท Base URI สำเร็จ');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error updating base URI:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการอัพเดท Base URI: ' + error.message);
    res.redirect('/admin/settings');
  }
});

// API ตั้งค่า Price Feed
router.post('/settings/set-price-feed', isAuthenticated, isAdmin, hasWallet, async (req, res) => {
  try {
    const { priceFeedAddress } = req.body;
    
    // ตั้งค่า Price Feed
    await contractService.setPriceFeed(req.session.walletAddress, priceFeedAddress);
    
    req.flash('success_msg', 'อัพเดท Price Feed สำเร็จ');
    res.redirect('/admin/settings');
  } catch (error) {
    console.error('Error updating price feed:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการอัพเดท Price Feed: ' + error.message);
    res.redirect('/admin/settings');
  }
});

module.exports = router;