// routes/user.js - เส้นทางสำหรับผู้ใช้ทั่วไป
const express = require('express');
const router = express.Router();
const { isAuthenticated, hasWallet, isMember } = require('../middleware/auth');
const contractService = require('../services/contract');
const contractConfig = require('../config/blockchain');

// ตรวจสอบบทบาทว่าเป็นผู้ใช้ทั่วไป
const isUser = (req, res, next) => {
  // ถือว่าผู้ใช้ที่ล็อกอินแล้วและไม่ใช่ admin/owner เป็น user
  if (req.session.user && req.session.role !== 'admin' && req.session.role !== 'owner') {
    return next();
  }
  req.flash('error_msg', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
  res.redirect('/');
};

// แสดงแดชบอร์ดผู้ใช้
router.get('/dashboard', isAuthenticated, isUser, hasWallet, isMember, async (req, res) => {
  try {
    // ดึงข้อมูลสมาชิก
    const memberInfo = await contractService.getMemberInfo(req.session.walletAddress);
    
    // ดึงข้อมูล NFT
    const tokenMetadata = await contractService.getTokenMetadata(req.session.walletAddress);
    
    // ดึงข้อมูลแพลนทั้งหมด
    const plans = await contractService.getAllPlans();
    
    // ดึงข้อมูลแพลนปัจจุบัน
    const currentPlan = plans.find(plan => plan.id === memberInfo.planId);
    
    // ดึงข้อมูลแพลนถัดไป
    const nextPlan = plans.find(plan => plan.id === memberInfo.planId + 1);
    
    res.render('user/dashboard', {
      title: 'แดชบอร์ดสมาชิก',
      memberInfo,
      tokenMetadata,
      currentPlan,
      nextPlan,
      walletAddress: req.session.walletAddress,
      referralLink: `${req.protocol}://${req.get('host')}/register?ref=${req.session.walletAddress}`
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/');
  }
});

// แสดงหน้าโปรไฟล์
router.get('/profile', isAuthenticated, isUser, hasWallet, isMember, async (req, res) => {
  try {
    // ดึงข้อมูลสมาชิก
    const memberInfo = await contractService.getMemberInfo(req.session.walletAddress);
    
    // ดึงข้อมูลแพลนทั้งหมด
    const plans = await contractService.getAllPlans();
    
    // ดึงข้อมูลแพลนปัจจุบัน
    const currentPlan = plans.find(plan => plan.id === memberInfo.planId);
    
    // ดึงข้อมูลสายอ้างอิง
    const referralChain = await contractService.getReferralChain(req.session.walletAddress);
    
    res.render('user/profile', {
      title: 'โปรไฟล์',
      memberInfo,
      currentPlan,
      referralChain,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching profile data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/user/dashboard');
  }
});

// แสดงหน้าอัพเกรดแพลน
router.get('/upgrade', isAuthenticated, isUser, hasWallet, isMember, async (req, res) => {
  try {
    // ดึงข้อมูลสมาชิก
    const memberInfo = await contractService.getMemberInfo(req.session.walletAddress);
    
    // ดึงข้อมูลแพลนทั้งหมด
    const plans = await contractService.getAllPlans();
    
    // ดึงข้อมูลแพลนปัจจุบัน
    const currentPlan = plans.find(plan => plan.id === memberInfo.planId);
    
    // ดึงข้อมูลแพลนถัดไป
    const nextPlan = plans.find(plan => plan.id === memberInfo.planId + 1);
    
    res.render('user/upgrade', {
      title: 'อัพเกรดแพลน',
      memberInfo,
      currentPlan,
      nextPlan,
      contractAddress: contractConfig.contractAddress,
      usdtAddress: contractConfig.usdtAddress,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching upgrade data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/user/dashboard');
  }
});

// API อัพเกรดแพลน
router.post('/upgrade', isAuthenticated, isUser, hasWallet, isMember, async (req, res) => {
  try {
    const { newPlanId } = req.body;
    
    // ดึงข้อมูลสมาชิก
    const memberInfo = await contractService.getMemberInfo(req.session.walletAddress);
    
    // ตรวจสอบว่าเป็นแพลนถัดไปหรือไม่
    if (parseInt(newPlanId) !== memberInfo.planId + 1) {
      req.flash('error_msg', 'สามารถอัพเกรดได้เฉพาะแพลนถัดไปเท่านั้น');
      return res.redirect('/user/upgrade');
    }
    
    // ดำเนินการอัพเกรด
    const result = await contractService.upgradePlan(req.session.walletAddress, parseInt(newPlanId));
    
    req.flash('success_msg', 'อัพเกรดแพลนสำเร็จ');
    res.redirect('/user/dashboard');
  } catch (error) {
    console.error('Error upgrading plan:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการอัพเกรดแพลน: ' + error.message);
    res.redirect('/user/upgrade');
  }
});

// แสดงหน้าการแนะนำ
router.get('/referrals', isAuthenticated, isUser, hasWallet, isMember, async (req, res) => {
  try {
    // ดึงข้อมูลสมาชิก
    const memberInfo = await contractService.getMemberInfo(req.session.walletAddress);
    
    // ดึงข้อมูลการแนะนำจากฐานข้อมูล
    // สมมติให้มีฟังก์ชันดึงข้อมูลการแนะนำ
    const referrals = [];
    
    res.render('user/referrals', {
      title: 'การแนะนำ',
      memberInfo,
      referrals,
      referralLink: `${req.protocol}://${req.get('host')}/register?ref=${req.session.walletAddress}`,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching referral data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/user/dashboard');
  }
});

// API ออกจากการเป็นสมาชิก
router.post('/exit-membership', isAuthenticated, isUser, hasWallet, isMember, async (req, res) => {
  try {
    // ดำเนินการออกจากการเป็นสมาชิก
    const result = await contractService.exitMembership(req.session.walletAddress);
    
    req.flash('success_msg', 'ออกจากการเป็นสมาชิกสำเร็จ คุณได้รับเงินคืน 30% ของราคาแพลน');
    res.redirect('/');
  } catch (error) {
    console.error('Error exiting membership:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการออกจากการเป็นสมาชิก: ' + error.message);
    res.redirect('/user/dashboard');
  }
});

// แสดงหน้าเชื่อมต่อกระเป๋า
router.get('/connect-wallet', isAuthenticated, isUser, async (req, res) => {
  try {
    res.render('user/connect-wallet', {
      title: 'เชื่อมต่อกระเป๋า Metamask',
      walletAddress: req.session.walletAddress || null,
      networkName: contractConfig.networkName || 'Binance Smart Chain',
      networkId: contractConfig.networkId || 56,
      rpcUrl: contractConfig.rpcUrl || 'https://bsc-dataseed.binance.org'
    });
  } catch (error) {
    console.error('Error rendering connect wallet page:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาด: ' + error.message);
    res.redirect('/');
  }
});

// API เชื่อมต่อกระเป๋า
router.post('/connect-wallet', isAuthenticated, isUser, async (req, res) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      req.flash('error_msg', 'ที่อยู่กระเป๋าไม่ถูกต้อง');
      return res.redirect('/user/connect-wallet');
    }
    
    req.session.walletAddress = walletAddress;
    req.flash('success_msg', 'เชื่อมต่อกระเป๋าสำเร็จ');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error connecting wallet:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการเชื่อมต่อกระเป๋า: ' + error.message);
    res.redirect('/user/connect-wallet');
  }
});

// API ยกเลิกการเชื่อมต่อกระเป๋า
router.post('/disconnect-wallet', isAuthenticated, isUser, async (req, res) => {
  try {
    req.session.walletAddress = null;
    req.flash('success_msg', 'ยกเลิกการเชื่อมต่อกระเป๋าสำเร็จ');
    res.redirect('/user/connect-wallet');
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการยกเลิกการเชื่อมต่อกระเป๋า: ' + error.message);
    res.redirect('/user/connect-wallet');
  }
});

// API อัพเดทโปรไฟล์
router.post('/update-profile', isAuthenticated, isUser, async (req, res) => {
  try {
    const { password, password2 } = req.body;
    
    // ตรวจสอบรหัสผ่าน
    if (password && password !== password2) {
      req.flash('error_msg', 'รหัสผ่านไม่ตรงกัน');
      return res.redirect('/user/profile');
    }
    
    // อัพเดทรหัสผ่าน
    if (password) {
      const userService = require('../services/user');
      await userService.changePassword(req.session.user.id, password);
      req.flash('success_msg', 'อัพเดทโปรไฟล์สำเร็จ');
    }
    
    res.redirect('/user/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการอัพเดทโปรไฟล์: ' + error.message);
    res.redirect('/user/profile');
  }
});

// แสดงหน้าการแจ้งเตือนของผู้ใช้
router.get('/notifications', isAuthenticated, isUser, async (req, res) => {
  try {
    const notificationService = require('../services/notifications');
    const notifications = await notificationService.getUserNotifications(req.session.user.id, 20, false);
    
    res.render('user/notifications', {
      title: 'การแจ้งเตือน',
      notifications,
      walletAddress: req.session.walletAddress
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน: ' + error.message);
    res.redirect('/user/dashboard');
  }
});

module.exports = router;