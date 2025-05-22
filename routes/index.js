// routes/index.js - เส้นทางหลัก
const express = require('express');
const router = express.Router();
const contractService = require('../services/contract');

// แสดงหน้าแรก
router.get('/', async (req, res) => {
  try {
    // ดึงข้อมูลแพลนทั้งหมด
    const plans = await contractService.getAllPlans();
    
    res.render('index', {
      title: 'หน้าแรก',
      plans
    });
  } catch (error) {
    console.error('Error fetching home page data:', error);
    res.render('index', {
      title: 'หน้าแรก',
      plans: []
    });
  }
});

// แสดงหน้าแพลน
router.get('/plans', async (req, res) => {
  try {
    // ดึงข้อมูลแพลนทั้งหมด
    const plans = await contractService.getAllPlans();
    
    res.render('plans', {
      title: 'แพลนทั้งหมด',
      plans
    });
  } catch (error) {
    console.error('Error fetching plans data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล');
    res.redirect('/');
  }
});

// แสดงหน้าลงทะเบียนสมาชิก
router.get('/register', async (req, res) => {
  try {
    // ดึงข้อมูลแพลน 1 (แพลนเริ่มต้น)
    const plans = await contractService.getAllPlans();
    const startPlan = plans.find(plan => plan.id === 1);
    
    // ดึงค่า referral จาก query string
    const ref = req.query.ref || '';
    
    res.render('register', {
      title: 'สมัครสมาชิก',
      startPlan,
      ref
    });
  } catch (error) {
    console.error('Error fetching registration data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล');
    res.redirect('/');
  }
});

// API ลงทะเบียนสมาชิก
router.post('/register', async (req, res) => {
  try {
    const { walletAddress, upline } = req.body;
    
    // ตรวจสอบว่ามีกระเป๋าหรือไม่
    if (!walletAddress) {
      req.flash('error_msg', 'กรุณาเชื่อมต่อกระเป๋า Metamask ก่อนสมัครสมาชิก');
      return res.redirect('/register');
    }
    
    // ส่งข้อมูลไปยัง blockchain โดยตรง
    // ไม่ต้องเก็บข้อมูลลงฐานข้อมูล
    
    res.json({
      success: true,
      message: 'กรุณาสมัครสมาชิกด้วยตัวเองโดยใช้ MetaMask',
      walletAddress,
      upline
    });
  } catch (error) {
    console.error('Error processing registration:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการสมัครสมาชิก: ' + error.message);
    res.redirect('/register');
  }
});

// แสดงหน้าเกี่ยวกับเรา
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'เกี่ยวกับเรา'
  });
});

// แสดงหน้าติดต่อเรา
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'ติดต่อเรา'
  });
});

module.exports = router;