// app.js - เริ่มต้นแอปพลิเคชัน Express (Decentralized Version)
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const dotenv = require('dotenv');

// โหลดไฟล์ .env
dotenv.config();

// รวม routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const ownerRoutes = require('./routes/owner');
const apiRoutes = require('./routes/api');

// เชื่อมต่อกับฐานข้อมูล MySQL (เฉพาะ admin users)
require('./config/database');

const app = express();

// ตั้งค่า view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ตั้งค่า middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'crypto-membership-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));
app.use(flash());

// ตัวแปรสำหรับทุก view
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.role = req.session.role || 'guest';
  res.locals.walletAddress = req.session.walletAddress || null;
  res.locals.success_msg = req.flash('success_msg') || '';
  res.locals.error_msg = req.flash('error_msg') || '';
  next();
});

// ใช้งาน routes
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/owner', ownerRoutes);
app.use('/api', apiRoutes);

// Routes สำหรับผู้ใช้ทั่วไป (ไม่ต้องการ login - ใช้ wallet เท่านั้น)
app.get('/connect-wallet', (req, res) => {
  res.render('connect-wallet', {
    title: 'เชื่อมต่อกระเป๋า Metamask',
    walletAddress: req.session.walletAddress || null
  });
});

app.post('/connect-wallet', (req, res) => {
  const { walletAddress } = req.body;
  
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    req.flash('error_msg', 'รูปแบบที่อยู่กระเป๋าไม่ถูกต้อง');
    return res.redirect('/connect-wallet');
  }
  
  req.session.walletAddress = walletAddress;
  req.flash('success_msg', 'เชื่อมต่อกระเป๋าสำเร็จ');
  res.redirect('/dashboard');
});

app.post('/disconnect-wallet', (req, res) => {
  req.session.walletAddress = null;
  req.flash('success_msg', 'ยกเลิกการเชื่อมต่อกระเป๋าสำเร็จ');
  res.redirect('/');
});

// หน้าแดชบอร์ดสำหรับผู้ใช้ทั่วไป (ใช้ wallet address)
app.get('/dashboard', async (req, res) => {
  try {
    const walletAddress = req.session.walletAddress;
    
    if (!walletAddress) {
      req.flash('error_msg', 'กรุณาเชื่อมต่อกระเป๋าก่อนเข้าใช้งาน');
      return res.redirect('/connect-wallet');
    }
    
    const contractService = require('./services/contract');
    
    // ตรวจสอบสถานะสมาชิกจาก Smart Contract
    const isMemberStatus = await contractService.isMember(walletAddress);
    
    if (!isMemberStatus) {
      req.flash('error_msg', 'คุณยังไม่ได้เป็นสมาชิก กรุณาสมัครสมาชิกก่อน');
      return res.redirect('/register');
    }
    
    // ดึงข้อมูลสมาชิกจาก Smart Contract
    const memberInfo = await contractService.getMemberInfo(walletAddress);
    const tokenMetadata = await contractService.getTokenMetadata(walletAddress);
    const plans = await contractService.getAllPlans();
    
    const currentPlan = plans.find(plan => plan.id === memberInfo.planId);
    const nextPlan = plans.find(plan => plan.id === memberInfo.planId + 1);
    
    res.render('user/dashboard', {
      title: 'แดชบอร์ดสมาชิก',
      memberInfo,
      tokenMetadata,
      currentPlan,
      nextPlan,
      walletAddress,
      referralLink: `${req.protocol}://${req.get('host')}/register?ref=${walletAddress}`
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/connect-wallet');
  }
});

// หน้าโปรไฟล์
app.get('/profile', async (req, res) => {
  try {
    const walletAddress = req.session.walletAddress;
    
    if (!walletAddress) {
      req.flash('error_msg', 'กรุณาเชื่อมต่อกระเป๋าก่อนเข้าใช้งาน');
      return res.redirect('/connect-wallet');
    }
    
    const contractService = require('./services/contract');
    
    // ตรวจสอบสถานะสมาชิก
    const isMemberStatus = await contractService.isMember(walletAddress);
    if (!isMemberStatus) {
      req.flash('error_msg', 'คุณยังไม่ได้เป็นสมาชิก');
      return res.redirect('/register');
    }
    
    // ดึงข้อมูลสมาชิก
    const memberInfo = await contractService.getMemberInfo(walletAddress);
    const plans = await contractService.getAllPlans();
    const currentPlan = plans.find(plan => plan.id === memberInfo.planId);
    const referralChain = await contractService.getReferralChain(walletAddress);
    
    res.render('user/profile', {
      title: 'โปรไฟล์',
      memberInfo,
      currentPlan,
      referralChain,
      walletAddress
    });
  } catch (error) {
    console.error('Error fetching profile data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/dashboard');
  }
});

// หน้าอัพเกรดแพลน
app.get('/upgrade', async (req, res) => {
  try {
    const walletAddress = req.session.walletAddress;
    
    if (!walletAddress) {
      req.flash('error_msg', 'กรุณาเชื่อมต่อกระเป๋าก่อนเข้าใช้งาน');
      return res.redirect('/connect-wallet');
    }
    
    const contractService = require('./services/contract');
    
    // ตรวจสอบสถานะสมาชิก
    const isMemberStatus = await contractService.isMember(walletAddress);
    if (!isMemberStatus) {
      req.flash('error_msg', 'คุณยังไม่ได้เป็นสมาชิก');
      return res.redirect('/register');
    }
    
    // ดึงข้อมูลสมาชิก
    const memberInfo = await contractService.getMemberInfo(walletAddress);
    const plans = await contractService.getAllPlans();
    const currentPlan = plans.find(plan => plan.id === memberInfo.planId);
    const nextPlan = plans.find(plan => plan.id === memberInfo.planId + 1);
    
    res.render('user/upgrade', {
      title: 'อัพเกรดแพลน',
      memberInfo,
      currentPlan,
      nextPlan,
      walletAddress
    });
  } catch (error) {
    console.error('Error fetching upgrade data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/dashboard');
  }
});

// หน้าการแนะนำ
app.get('/referrals', async (req, res) => {
  try {
    const walletAddress = req.session.walletAddress;
    
    if (!walletAddress) {
      req.flash('error_msg', 'กรุณาเชื่อมต่อกระเป๋าก่อนเข้าใช้งาน');
      return res.redirect('/connect-wallet');
    }
    
    const contractService = require('./services/contract');
    
    // ตรวจสอบสถานะสมาชิก
    const isMemberStatus = await contractService.isMember(walletAddress);
    if (!isMemberStatus) {
      req.flash('error_msg', 'คุณยังไม่ได้เป็นสมาชิก');
      return res.redirect('/register');
    }
    
    // ดึงข้อมูลการแนะนำ
    const memberInfo = await contractService.getMemberInfo(walletAddress);
    const referrals = await contractService.getReferralHistory(walletAddress);
    
    res.render('user/referrals', {
      title: 'การแนะนำ',
      memberInfo,
      referrals,
      referralLink: `${req.protocol}://${req.get('host')}/register?ref=${walletAddress}`,
      walletAddress
    });
  } catch (error) {
    console.error('Error fetching referral data:', error);
    req.flash('error_msg', 'เกิดข้อผิดพลาดในการดึงข้อมูล: ' + error.message);
    res.redirect('/dashboard');
  }
});

// จัดการ 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// จัดการข้อผิดพลาด
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('500', { title: 'Server Error' });
});

// เริ่มต้นการเชื่อมต่อกับบล็อกเชนและการติดตามอีเวนต์ (ถ้าต้องการ)
if (process.env.USE_WEBSOCKET === 'true') {
  const listener = require('./services/listener');
  
  console.log('Initializing WebSocket connection to blockchain...');
  
  // เริ่มต้นระบบและตรวจสอบการเชื่อมต่อ
  listener.initialize();
  
  // เริ่มต้นการติดตามอีเวนต์หลังจากเริ่มแอป
  setTimeout(() => {
    listener.startEventListeners().catch(error => {
      console.error('Failed to start event listeners:', error);
    });
  }, 5000);
  
  // ตั้งเวลาตรวจสอบการเชื่อมต่อทุก 60 วินาที
  setInterval(() => {
    try {
      listener.checkConnection();
    } catch (error) {
      console.error('Error checking WebSocket connection:', error);
    }
  }, 60000);
  
  // เมื่อแอปพลิเคชันปิด ให้หยุดการติดตามอีเวนต์
  process.on('SIGINT', async () => {
    try {
      await listener.stopEventListeners();
      console.log('Event listeners stopped gracefully');
      process.exit(0);
    } catch (error) {
      console.error('Error stopping event listeners:', error);
      process.exit(1);
    }
  });
}

// เริ่มต้นเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('🚀 Decentralized Membership System Started');
  console.log(`📊 Admin Panel: http://localhost:${PORT}/auth/login`);
  console.log(`🔗 Member Dashboard: http://localhost:${PORT}/connect-wallet`);
});

module.exports = app;