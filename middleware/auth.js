// middleware/auth.js - ตรวจสอบสิทธิ์การเข้าถึง (Minimal Version)
const contractService = require('../services/contract');

// ตรวจสอบว่าผู้ใช้ล็อกอินแล้วหรือไม่ (เฉพาะ Admin/Owner)
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error_msg', 'กรุณาเข้าสู่ระบบก่อนดำเนินการ');
  res.redirect('/auth/login');
};

// ตรวจสอบบทบาทว่าเป็นแอดมินหรือเจ้าของระบบ
const isAdmin = (req, res, next) => {
  if (req.session.user && (req.session.role === 'admin' || req.session.role === 'owner')) {
    return next();
  }
  req.flash('error_msg', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
  res.redirect('/');
};

// ตรวจสอบบทบาทว่าเป็นเจ้าของระบบ
const isOwner = (req, res, next) => {
  if (req.session.user && req.session.role === 'owner') {
    return next();
  }
  req.flash('error_msg', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
  res.redirect('/');
};

// ตรวจสอบการเชื่อมต่อกระเป๋า Metamask (เฉพาะสำหรับ Admin/Owner)
const hasWallet = (req, res, next) => {
  if (req.session.walletAddress) {
    return next();
  }
  req.flash('error_msg', 'กรุณาเชื่อมต่อกระเป๋า Metamask ก่อนดำเนินการ');
  res.redirect('/connect-wallet');
};

// ตรวจสอบว่าเป็นสมาชิกหรือไม่จาก blockchain (สำหรับผู้ใช้ทั่วไป)
const isMember = async (req, res, next) => {
  try {
    // ตรวจสอบว่ามี wallet address หรือไม่
    const walletAddress = req.session.walletAddress || req.query.address || req.body.walletAddress;
    
    if (!walletAddress) {
      req.flash('error_msg', 'กรุณาเชื่อมต่อกระเป๋าก่อนดำเนินการ');
      return res.redirect('/connect-wallet');
    }

    // ตรวจสอบจาก Smart Contract โดยตรง
    const isUserMember = await contractService.isMember(walletAddress);
    
    if (isUserMember) {
      req.memberWallet = walletAddress; // เก็บไว้ใช้ใน route
      return next();
    }
    
    req.flash('error_msg', 'คุณยังไม่ได้เป็นสมาชิก กรุณาสมัครสมาชิกก่อน');
    res.redirect('/register');
  } catch (error) {
    console.error('Error checking membership:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการตรวจสอบสถานะสมาชิก: ' + error.message);
    res.redirect('/');
  }
};

// ตรวจสอบว่าเป็น admin/owner หรือเจ้าของ wallet นี้
const isAdminOrWalletOwner = async (req, res, next) => {
  try {
    // ถ้าเป็น admin/owner ให้ผ่านไปได้เลย
    if (req.session.user && (req.session.role === 'admin' || req.session.role === 'owner')) {
      return next();
    }
    
    // ถ้าไม่ใช่ admin/owner ให้ตรวจสอบว่าเป็นเจ้าของ wallet หรือไม่
    const walletAddress = req.params.address || req.query.address || req.body.walletAddress;
    const userWallet = req.session.walletAddress || req.query.wallet;
    
    if (walletAddress && userWallet && walletAddress.toLowerCase() === userWallet.toLowerCase()) {
      return next();
    }
    
    req.flash('error_msg', 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้');
    res.redirect('/');
  } catch (error) {
    console.error('Error checking wallet ownership:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ' + error.message);
    res.redirect('/');
  }
};

// ตรวจสอบว่า wallet address มีรูปแบบถูกต้องหรือไม่
const isValidWalletAddress = (req, res, next) => {
  const walletAddress = req.params.address || req.query.address || req.body.walletAddress;
  
  if (!walletAddress) {
    req.flash('error_msg', 'ไม่พบที่อยู่กระเป๋า');
    return res.redirect('/');
  }
  
  // ตรวจสอบรูปแบบ Ethereum address
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    req.flash('error_msg', 'รูปแบบที่อยู่กระเป๋าไม่ถูกต้อง');
    return res.redirect('/');
  }
  
  next();
};

// Middleware สำหรับ API routes ที่ต้องการ wallet address
const requireWalletAddress = (req, res, next) => {
  const walletAddress = req.params.address || req.query.address || req.body.walletAddress;
  
  if (!walletAddress) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }
  
  req.walletAddress = walletAddress;
  next();
};

module.exports = {
  isAuthenticated,
  isAdmin,
  isOwner,
  hasWallet,
  isMember,
  isAdminOrWalletOwner,
  isValidWalletAddress,
  requireWalletAddress
};