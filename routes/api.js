// routes/api.js - API สำหรับ Decentralized System
const express = require('express');
const router = express.Router();
const { requireWalletAddress } = require('../middleware/auth');
const contractService = require('../services/contract');
const Web3 = require('web3');
const config = require('../config/blockchain');

// API ดึงข้อมูลแพลนทั้งหมด (จาก Smart Contract)
router.get('/plans', async (req, res) => {
  try {
    const plans = await contractService.getAllPlans();
    res.json(plans);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// API ดึงข้อมูลสมาชิกทั้งหมด (จาก Events)
router.get('/members', async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const members = await contractService.getAllMembers(parseInt(limit));
    
    res.json({
      members,
      totalPages: 1, // เนื่องจากเป็น decentralized ไม่มี pagination แบบเดิม
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// API ตรวจสอบสถานะสมาชิก
router.get('/members/check-member', async (req, res) => {
    try {
        const { address } = req.query;

        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({
                success: false,
                message: 'ที่อยู่กระเป๋าไม่ถูกต้อง'
            });
        }

        // ใช้ contract service แทนการสร้าง contract instance เอง
        const isMember = await contractService.isMember(address);

        res.json({
            success: true,
            isMember: isMember
        });
    } catch (error) {
        console.error('Error checking member status:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะสมาชิก'
        });
    }
});

// API ดึงข้อมูลสมาชิกรายบุคคล
router.get('/members/:address', requireWalletAddress, async (req, res) => {
  try {
    const { address } = req.params;
    
    // ตรวจสอบว่าเป็นสมาชิกหรือไม่
    const isMemberStatus = await contractService.isMember(address);
    if (!isMemberStatus) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // ดึงข้อมูลสมาชิก
    const memberInfo = await contractService.getMemberInfo(address);
    
    res.json({
      walletAddress: address,
      ...memberInfo
    });
  } catch (error) {
    console.error('Error fetching member details:', error);
    res.status(500).json({ error: 'Failed to fetch member details' });
  }
});

// API ดึงข้อมูล NFT ของสมาชิก
router.get('/members/:address/nft', requireWalletAddress, async (req, res) => {
  try {
    const { address } = req.params;
    
    // ตรวจสอบว่าเป็นสมาชิกหรือไม่
    const isMemberStatus = await contractService.isMember(address);
    if (!isMemberStatus) {
      return res.status(404).json({ error: 'Member not found' });
    }
    
    // ดึงข้อมูล NFT
    const nftData = await contractService.getTokenMetadata(address);
    
    res.json(nftData || {});
  } catch (error) {
    console.error('Error fetching NFT data:', error);
    res.status(500).json({ error: 'Failed to fetch NFT data' });
  }
});

// API ดึงประวัติธุรกรรมของสมาชิก (จาก Events)
router.get('/members/:address/transactions', requireWalletAddress, async (req, res) => {
  try {
    const { address } = req.params;
    
    // ดึงประวัติธุรกรรมจาก Events
    const transactions = await contractService.getMemberTransactions(address);
    
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching member transactions:', error);
    res.status(500).json({ error: 'Failed to fetch member transactions' });
  }
});

// API ดึงประวัติการแนะนำ (จาก Events)
router.get('/members/:address/referrals', requireWalletAddress, async (req, res) => {
  try {
    const { address } = req.params;
    
    // ดึงประวัติการแนะนำจาก Events
    const referrals = await contractService.getReferralHistory(address);
    
    res.json(referrals);
  } catch (error) {
    console.error('Error fetching referral history:', error);
    res.status(500).json({ error: 'Failed to fetch referral history' });
  }
});

// API ดึงสถิติระบบ (จาก Smart Contract)
router.get('/contract/stats', async (req, res) => {
  try {
    const stats = await contractService.getSystemStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// API ดึงสถิติสมาชิกวันนี้ (จาก Events)
router.get('/member-stats', async (req, res) => {
  try {
    const systemStats = await contractService.getSystemStats();
    const todayStats = await contractService.getTodayMemberStats();
    
    res.json({
      totalMembers: systemStats.totalMembers,
      ...todayStats
    });
  } catch (error) {
    console.error('Error fetching member stats:', error);
    res.status(500).json({ error: 'Failed to fetch member stats' });
  }
});

// API ดึงสถานะของแพลน
router.get('/plans/:planId/cycle', async (req, res) => {
  try {
    const { planId } = req.params;
    
    // ดึงข้อมูล cycle จาก Smart Contract
    const cycleInfo = await contractService.getPlanCycleInfo(parseInt(planId));
    
    res.json({
      planId: parseInt(planId),
      ...cycleInfo,
      isComplete: cycleInfo.membersInCurrentCycle >= cycleInfo.membersPerCycle
    });
  } catch (error) {
    console.error('Error checking cycle status:', error);
    res.status(500).json({ error: 'Failed to check cycle status' });
  }
});

// API ดึงข้อมูลสายอ้างอิง
router.get('/members/:address/referral-chain', requireWalletAddress, async (req, res) => {
  try {
    const { address } = req.params;
    
    // ดึงข้อมูลสายอ้างอิงจาก Smart Contract
    const referralChain = await contractService.getReferralChain(address);
    
    res.json({
      walletAddress: address,
      referralChain
    });
  } catch (error) {
    console.error('Error fetching referral chain:', error);
    res.status(500).json({ error: 'Failed to fetch referral chain' });
  }
});

// API ตรวจสอบความถูกต้องของยอดเงินในสัญญา
router.get('/contract/balance-validation', async (req, res) => {
  try {
    const validation = await contractService.validateContractBalance();
    res.json(validation);
  } catch (error) {
    console.error('Error validating contract balance:', error);
    res.status(500).json({ error: 'Failed to validate contract balance' });
  }
});

// API ดึงข้อมูลการเติบโตของสมาชิก (สำหรับกราฟ)
router.get('/member-growth', async (req, res) => {
  try {
    // เนื่องจากเป็น decentralized ต้องดึงจาก Events
    // ในที่นี้จะส่งข้อมูลตัวอย่างเพื่อให้กราฟทำงาน
    const currentStats = await contractService.getSystemStats();
    
    // สร้างข้อมูลตัวอย่างสำหรับกราฟ (ในระบบจริงควรดึงจาก Events)
    const totalMembers = parseInt(currentStats.totalMembers);
    const monthlyGrowth = Math.max(1, Math.floor(totalMembers / 6));
    
    res.json({
      labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'],
      data: [
        Math.max(0, totalMembers - (monthlyGrowth * 5)),
        Math.max(0, totalMembers - (monthlyGrowth * 4)),
        Math.max(0, totalMembers - (monthlyGrowth * 3)),
        Math.max(0, totalMembers - (monthlyGrowth * 2)),
        Math.max(0, totalMembers - monthlyGrowth),
        totalMembers
      ]
    });
  } catch (error) {
    console.error('Error fetching member growth data:', error);
    res.json({
      labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'],
      data: [0, 0, 0, 0, 0, 0]
    });
  }
});

// เชื่อมต่อกระเป๋า
router.post('/wallet/connect', async (req, res) => {
    try {
        const { address } = req.body;

        // ตรวจสอบรูปแบบที่อยู่กระเป๋า
        if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
            return res.status(400).json({
                success: false,
                message: 'ที่อยู่กระเป๋าไม่ถูกต้อง'
            });
        }

        // บันทึกที่อยู่กระเป๋าลงใน session
        req.session.walletAddress = address;

        res.json({
            success: true,
            message: 'เชื่อมต่อกระเป๋าสำเร็จ',
            address: address
        });
    } catch (error) {
        console.error('Error connecting wallet:', error);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกระเป๋า'
        });
    }
});

module.exports = router;