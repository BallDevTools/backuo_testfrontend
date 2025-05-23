// routes/auth.js - เส้นทางสำหรับการยืนยันตัวตน (เฉพาะ admin/owner)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const userService = require('../services/user');

// แสดงหน้าล็อกอิน
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('login', { title: 'เข้าสู่ระบบ' });
});

// ประมวลผลการล็อกอิน
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // ตรวจสอบว่ามีผู้ใช้นี้หรือไม่ในฐานข้อมูล
    const user = await userService.getUserByUsername(username);
    
    if (!user) {
      req.flash('error_msg', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return res.redirect('/auth/login');
    }
    
    // ตรวจสอบรหัสผ่าน
    const isMatch = await userService.comparePassword(password, user.password_hash);
    
    if (!isMatch) {
      req.flash('error_msg', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return res.redirect('/auth/login');
    }
    
    // บันทึกข้อมูลผู้ใช้ลงใน session
    req.session.user = {
      id: user.id,
      username: user.username
    };
    req.session.role = user.role;
    
    // บันทึกที่อยู่กระเป๋าลงใน session ถ้ามี
    if (user.walletAddress) {
      req.session.walletAddress = user.walletAddress;
    }
    
    // เปลี่ยนเส้นทางตามบทบาท
    if (user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else if (user.role === 'owner') {
      res.redirect('/owner/dashboard');
    } else {
      res.redirect('/');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    res.redirect('/auth/login');
  }
});

// แสดงหน้าเพิ่มผู้ดูแลระบบใหม่ (เฉพาะ owner สามารถเพิ่ม admin ได้)
router.get('/add-admin', isAuthenticated, isAdmin, (req, res) => {
  res.render('auth/add-admin', { title: 'เพิ่มผู้ดูแลระบบ' });
});

// ประมวลผลการเพิ่มผู้ดูแลระบบใหม่
router.post('/add-admin', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { username, password, password2 } = req.body;
    
    // ตรวจสอบว่ามีผู้ใช้นี้อยู่แล้วหรือไม่
    const existingUser = await userService.getUserByUsername(username);
    
    if (existingUser) {
      req.flash('error_msg', 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
      return res.redirect('/auth/add-admin');
    }
    
    // ตรวจสอบรหัสผ่าน
    if (password !== password2) {
      req.flash('error_msg', 'รหัสผ่านไม่ตรงกัน');
      return res.redirect('/auth/add-admin');
    }
    
    // สร้างผู้ใช้ใหม่ (เฉพาะ admin เท่านั้น)
    await userService.createUser(username, password, 'admin');
    
    req.flash('success_msg', 'เพิ่มผู้ดูแลระบบสำเร็จ');
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error adding admin:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการเพิ่มผู้ดูแลระบบ');
    res.redirect('/auth/add-admin');
  }
});

// ล็อกเอาท์
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;