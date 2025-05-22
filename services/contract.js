// services/contract.js - ตัวจัดการการเชื่อมต่อกับสัญญาอัจฉริยะ
const Web3 = require('web3');
const contractConfig = require('../config/blockchain');

// ABI ของสัญญา CryptoMembershipNFT
const contractABI = require('../config/contractABI.json');

// ตั้งค่า Web3 provider
let web3;
if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
  // เชื่อมต่อกับ MetaMask หรือ Provider ของเบราว์เซอร์
  web3 = new Web3(window.ethereum);
} else {
  // เชื่อมต่อกับ RPC provider (เช่น Infura)
  web3 = new Web3(new Web3.providers.HttpProvider(contractConfig.rpcUrl));
}

// สร้าง contract instance
const contractInstance = new web3.eth.Contract(
  contractABI,
  contractConfig.contractAddress
);

// ข้อความแจ้งเตือนสำหรับข้อผิดพลาดจากสัญญา
const errorMessages = {
  'AlreadyMember': 'คุณเป็นสมาชิกอยู่แล้ว',
  'CooldownActive': 'กรุณารอระยะเวลา Cooldown ก่อนดำเนินการอีกครั้ง',
  'ThirtyDayLock': 'คุณต้องรอ 30 วันก่อนออกจากการเป็นสมาชิก',
  'UplinePlanLow': 'แพลนของผู้แนะนำต่ำกว่าแพลนที่คุณเลือก',
  'UplineNotMember': 'ผู้แนะนำไม่ได้เป็นสมาชิก',
  'NextPlanOnly': 'คุณสามารถอัพเกรดได้เฉพาะแพลนถัดไปเท่านั้น',
  'Plan1Only': 'คุณสามารถสมัครได้เฉพาะแพลน 1 เท่านั้น',
  'LowOwnerBalance': 'ยอดเงินเจ้าของไม่เพียงพอ',
  'LowFeeBalance': 'ยอดเงินค่าธรรมเนียมไม่เพียงพอ',
  'LowFundBalance': 'ยอดเงินกองทุนไม่เพียงพอ',
  'InvalidPlanID': 'รหัสแพลนไม่ถูกต้อง',
  'InactivePlan': 'แพลนปิดใช้งาน',
  'Paused': 'ระบบหยุดทำงานชั่วคราว',
  'NotPaused': 'ระบบไม่ได้อยู่ในสถานะหยุดทำงาน',
  'NoRequest': 'ไม่มีคำขอถอนเงินฉุกเฉิน',
  'TimelockActive': 'ยังไม่ถึงเวลาที่กำหนดสำหรับการถอนเงินฉุกเฉิน',
  'ZeroBalance': 'ยอดเงินเป็นศูนย์',
  'ZeroAddress': 'ที่อยู่กระเป๋าไม่ถูกต้อง',
  'InvalidRequest': 'คำขอไม่ถูกต้อง',
  'InvalidRequests': 'คำขอหลายรายการไม่ถูกต้อง',
  'NotMember': 'คุณไม่ได้เป็นสมาชิก'
};

// จัดการข้อผิดพลาดจากสัญญา
const handleContractError = (error) => {
  const errorString = error.toString();
  
  for (const [code, message] of Object.entries(errorMessages)) {
    if (errorString.includes(code)) {
      return message;
    }
  }
  
  return 'เกิดข้อผิดพลาดในการทำธุรกรรม: ' + error.message;
};

/**
 * ตรวจสอบว่าที่อยู่กระเป๋าเป็นสมาชิกหรือไม่ (เช็คจาก Blockchain เท่านั้น)
 * @param {string} address ที่อยู่กระเป๋า
 * @returns {Promise<boolean>} สถานะการเป็นสมาชิก
 */
const isMember = async (address) => {
  try {
    // ตรวจสอบว่าเป็น owner ของสัญญาหรือไม่
    const contractOwner = await contractInstance.methods.owner().call();
    if (address.toLowerCase() === contractOwner.toLowerCase()) {
      return true;
    }
    
    // ตรวจสอบว่ามี NFT หรือไม่
    const balance = await contractInstance.methods.balanceOf(address).call();
    return parseInt(balance) > 0;
  } catch (error) {
    console.error('Error checking membership:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูลสมาชิกจาก Smart Contract
 * @param {string} address ที่อยู่กระเป๋า
 * @returns {Promise<Object>} ข้อมูลสมาชิก
 */
const getMemberInfo = async (address) => {
  try {
    const memberInfo = await contractInstance.methods.members(address).call();
    return {
      upline: memberInfo.upline,
      totalReferrals: parseInt(memberInfo.totalReferrals),
      totalEarnings: web3.utils.fromWei(memberInfo.totalEarnings, 'ether'),
      planId: parseInt(memberInfo.planId),
      cycleNumber: parseInt(memberInfo.cycleNumber),
      registeredAt: new Date(memberInfo.registeredAt * 1000),
    };
  } catch (error) {
    console.error('Error getting member info:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูลสมาชิกทั้งหมดจาก Events (แทนการเก็บใน DB)
 * @param {number} limit จำนวนสมาชิกที่ต้องการ
 * @returns {Promise<Array>} รายการสมาชิก
 */
const getAllMembers = async (limit = 20) => {
  try {
    // ดึง Event MemberRegistered จาก blockchain
    const memberEvents = await contractInstance.getPastEvents('MemberRegistered', {
      fromBlock: 0,
      toBlock: 'latest'
    });

    // เรียงตามบล็อกล่าสุด
    const sortedEvents = memberEvents
      .sort((a, b) => b.blockNumber - a.blockNumber)
      .slice(0, limit);

    const members = [];
    
    for (const event of sortedEvents) {
      const { member, planId, cycleNumber } = event.returnValues;
      
      try {
        // ดึงข้อมูลสมาชิกปัจจุบัน
        const memberInfo = await getMemberInfo(member);
        
        members.push({
          walletAddress: member,
          planId: parseInt(planId),
          cycleNumber: parseInt(cycleNumber),
          registeredAt: memberInfo.registeredAt,
          totalReferrals: memberInfo.totalReferrals,
          totalEarnings: memberInfo.totalEarnings,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash
        });
      } catch (error) {
        console.error(`Error getting info for member ${member}:`, error);
      }
    }

    return members;
  } catch (error) {
    console.error('Error getting all members:', error);
    throw error;
  }
};

/**
 * ดึงประวัติการแนะนำจาก Events
 * @param {string} referrerAddress ที่อยู่ผู้แนะนำ
 * @returns {Promise<Array>} ประวัติการแนะนำ
 */
const getReferralHistory = async (referrerAddress) => {
  try {
    // ดึง Event ReferralPaid
    const referralEvents = await contractInstance.getPastEvents('ReferralPaid', {
      filter: { to: referrerAddress },
      fromBlock: 0,
      toBlock: 'latest'
    });

    const referrals = referralEvents.map(event => ({
      from: event.returnValues.from,
      to: event.returnValues.to,
      amount: web3.utils.fromWei(event.returnValues.amount, 'ether'),
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: null // จะต้องดึงจาก block timestamp ถ้าต้องการ
    }));

    return referrals;
  } catch (error) {
    console.error('Error getting referral history:', error);
    throw error;
  }
};

/**
 * ดึงประวัติธุรกรรมของสมาชิกจาก Events
 * @param {string} walletAddress ที่อยู่กระเป๋า
 * @returns {Promise<Array>} ประวัติธุรกรรม
 */
const getMemberTransactions = async (walletAddress) => {
  try {
    const transactions = [];
    
    // ดึง Event การสมัครสมาชิก
    const registerEvents = await contractInstance.getPastEvents('MemberRegistered', {
      filter: { member: walletAddress },
      fromBlock: 0,
      toBlock: 'latest'
    });

    registerEvents.forEach(event => {
      transactions.push({
        type: 'register',
        planId: parseInt(event.returnValues.planId),
        cycleNumber: parseInt(event.returnValues.cycleNumber),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
    });

    // ดึง Event การอัพเกรด
    const upgradeEvents = await contractInstance.getPastEvents('PlanUpgraded', {
      filter: { member: walletAddress },
      fromBlock: 0,
      toBlock: 'latest'
    });

    upgradeEvents.forEach(event => {
      transactions.push({
        type: 'upgrade',
        oldPlanId: parseInt(event.returnValues.oldPlanId),
        newPlanId: parseInt(event.returnValues.newPlanId),
        cycleNumber: parseInt(event.returnValues.cycleNumber),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
    });

    // ดึง Event การออกจากการเป็นสมาชิก
    const exitEvents = await contractInstance.getPastEvents('MemberExited', {
      filter: { member: walletAddress },
      fromBlock: 0,
      toBlock: 'latest'
    });

    exitEvents.forEach(event => {
      transactions.push({
        type: 'exit',
        refundAmount: web3.utils.fromWei(event.returnValues.refundAmount, 'ether'),
        transactionHash: event.transactionHash,
        blockNumber: event.blockNumber
      });
    });

    // เรียงตามบล็อกล่าสุด
    return transactions.sort((a, b) => b.blockNumber - a.blockNumber);
  } catch (error) {
    console.error('Error getting member transactions:', error);
    throw error;
  }
};

/**
 * ดึงข้อมูลแพลนทั้งหมด
 * @returns {Promise<Array>} รายการแพลนทั้งหมด
 */
const getAllPlans = async () => {
  try {
    // ในสัญญาของคุณ ไม่มีฟังก์ชัน state ที่สามารถใช้ได้ตรงๆ
    // แทนที่จะใช้ state.planCount ให้เราดึงข้อมูลจากตัวแปร planCount โดยตรง
    
    // เนื่องจากไม่สามารถเข้าถึงตัวแปร state ได้โดยตรง 
    // เราจะดึงข้อมูลแพลนโดยลองตั้งแต่ ID 1 ถึง 16 (ตามที่เห็นในสัญญา) 
    // และจับข้อผิดพลาดถ้าแพลนไม่มีอยู่
    
    const plans = [];
    let planCount = 16; // กำหนดค่าตั้งต้นตามที่เห็นในสัญญา
    
    for (let i = 1; i <= planCount; i++) {
      try {
        const plan = await contractInstance.methods.plans(i).call();
        const cycleInfo = await contractInstance.methods.getPlanCycleInfo(i).call();
        
        // ดึงรูปภาพแพลน
        let imageUri = '';
        try {
          imageUri = await contractInstance.methods.planDefaultImages(i).call();
        } catch (err) {
          console.warn(`Error fetching plan image for plan ${i}:`, err.message);
        }
        
        plans.push({
          id: i,
          name: plan.name,
          price: web3.utils.fromWei(plan.price, 'ether'),
          membersPerCycle: parseInt(plan.membersPerCycle),
          isActive: plan.isActive,
          currentCycle: parseInt(cycleInfo.currentCycle),
          membersInCurrentCycle: parseInt(cycleInfo.membersInCurrentCycle),
          imageUri: imageUri
        });
      } catch (error) {
        // ถ้าเป็น error จาก plans ที่ไม่มีอยู่ให้หยุดลูป
        if (error.message.includes('invalid opcode') ||
            error.message.includes('revert') ||
            error.message.includes('out of gas')) {
          break;
        }
        // ถ้าเป็น error อื่นๆ ให้ข้ามไปแพลนถัดไป
        console.warn(`Error fetching plan ${i}:`, error.message);
        continue;
      }
    }

    return plans;
  } catch (error) {
    console.error('Error getting all plans:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * สมัครสมาชิกใหม่
 * @param {string} address ที่อยู่กระเป๋า
 * @param {number} planId รหัสแพลน
 * @param {string} upline ที่อยู่ผู้แนะนำ
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const registerMember = async (address, planId, upline) => {
  try {
    // สร้าง transaction
    const tx = contractInstance.methods.registerMember(planId, upline);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: address });
    
    const result = await tx.send({
      from: address,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error registering member:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * อัพเกรดแพลน
 * @param {string} address ที่อยู่กระเป๋า
 * @param {number} newPlanId รหัสแพลนใหม่
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const upgradePlan = async (address, newPlanId) => {
  try {
    // สร้าง transaction
    const tx = contractInstance.methods.upgradePlan(newPlanId);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: address });
    
    const result = await tx.send({
      from: address,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error upgrading plan:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ดึงสถิติระบบจาก Smart Contract เท่านั้น
 * @returns {Promise<Object>} สถิติระบบ
 */
const getSystemStats = async () => {
  try {
    const stats = await contractInstance.methods.getSystemStats().call();
    
    return {
      totalMembers: parseInt(stats.totalMembers),
      totalRevenue: web3.utils.fromWei(stats.totalRevenue, 'ether'),
      totalCommission: web3.utils.fromWei(stats.totalCommission, 'ether'),
      ownerFunds: web3.utils.fromWei(stats.ownerFunds, 'ether'),
      feeFunds: web3.utils.fromWei(stats.feeFunds, 'ether'),
      fundFunds: web3.utils.fromWei(stats.fundFunds, 'ether')
    };
  } catch (error) {
    console.error('Error getting system stats:', error);
    throw error;
  }
};

/**
 * ดึงสถิติสมาชิกใหม่ในวันนี้จาก Events
 * @returns {Promise<Object>} สถิติสมาชิกใหม่
 */
const getTodayMemberStats = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Math.floor(today.getTime() / 1000);

    // คำนวณ block number โดยประมาณสำหรับวันนี้
    // BSC มี block time ประมาณ 3 วินาที
    const currentBlock = await web3.eth.getBlockNumber();
    const blocksPerDay = Math.floor(24 * 60 * 60 / 3); // ประมาณ 28,800 blocks ต่อวัน
    const startBlock = Math.max(0, currentBlock - blocksPerDay);

    // ดึง Events ตั้งแต่เริ่มวัน
    const registerEvents = await contractInstance.getPastEvents('MemberRegistered', {
      fromBlock: startBlock,
      toBlock: 'latest'
    });

    const upgradeEvents = await contractInstance.getPastEvents('PlanUpgraded', {
      fromBlock: startBlock,
      toBlock: 'latest'
    });

    const exitEvents = await contractInstance.getPastEvents('MemberExited', {
      fromBlock: startBlock,
      toBlock: 'latest'
    });

    return {
      newMembersToday: registerEvents.length,
      upgradesToday: upgradeEvents.length,
      exitsToday: exitEvents.length
    };
  } catch (error) {
    console.error('Error getting today member stats:', error);
    return {
      newMembersToday: 0,
      upgradesToday: 0,
      exitsToday: 0
    };
  }
};

/**
 * ดึงข้อมูลสถานะของสัญญา
 * @returns {Promise<Object>} ข้อมูลสถานะของสัญญา
 */
const getContractStatus = async () => {
  try {
    const status = await contractInstance.methods.getContractStatus().call();
    
    return {
      isPaused: status.isPaused,
      totalBalance: web3.utils.fromWei(status.totalBalance, 'ether'),
      memberCount: parseInt(status.memberCount),
      currentPlanCount: parseInt(status.currentPlanCount),
      hasEmergencyRequest: status.hasEmergencyRequest,
      emergencyTimeRemaining: parseInt(status.emergencyTimeRemaining)
    };
  } catch (error) {
    console.error('Error getting contract status:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * เจ้าของระบบถอนเงิน
 * @param {string} ownerAddress ที่อยู่เจ้าของระบบ
 * @param {number} amount จำนวนเงิน
 * @param {number} balanceType ประเภทเงิน (0=owner, 1=fee, 2=fund)
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const withdrawBalance = async (ownerAddress, amount, balanceType) => {
  try {
    let tx;
    
    // เลือกฟังก์ชันถอนเงินตามประเภท
    if (balanceType === 0) {
      tx = contractInstance.methods.withdrawOwnerBalance(web3.utils.toWei(amount.toString(), 'ether'));
    } else if (balanceType === 1) {
      tx = contractInstance.methods.withdrawFeeSystemBalance(web3.utils.toWei(amount.toString(), 'ether'));
    } else if (balanceType === 2) {
      tx = contractInstance.methods.withdrawFundBalance(web3.utils.toWei(amount.toString(), 'ether'));
    } else {
      throw new Error('ประเภทเงินไม่ถูกต้อง');
    }
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: ownerAddress });
    
    const result = await tx.send({
      from: ownerAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error withdrawing balance:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ถอนเงินแบบกลุ่ม
 * @param {string} ownerAddress ที่อยู่เจ้าของระบบ
 * @param {Array} requests รายการคำขอถอนเงิน
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const batchWithdraw = async (ownerAddress, requests) => {
  try {
    // แปลงคำขอให้ตรงกับฟอร์แมทของสัญญา
    const withdrawalRequests = requests.map(req => {
      return {
        recipient: req.recipient,
        amount: web3.utils.toWei(req.amount.toString(), 'ether'),
        balanceType: parseInt(req.balanceType)
      };
    });
    
    const tx = contractInstance.methods.batchWithdraw(withdrawalRequests);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: ownerAddress });
    
    const result = await tx.send({
      from: ownerAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error batch withdrawing:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ร้องขอถอนเงินฉุกเฉิน
 * @param {string} ownerAddress ที่อยู่เจ้าของระบบ
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const requestEmergencyWithdraw = async (ownerAddress) => {
  try {
    const tx = contractInstance.methods.requestEmergencyWithdraw();
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: ownerAddress });
    
    const result = await tx.send({
      from: ownerAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error requesting emergency withdrawal:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ดำเนินการถอนเงินฉุกเฉิน
 * @param {string} ownerAddress ที่อยู่เจ้าของระบบ
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const emergencyWithdraw = async (ownerAddress) => {
  try {
    const tx = contractInstance.methods.emergencyWithdraw();
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: ownerAddress });
    
    const result = await tx.send({
      from: ownerAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error performing emergency withdrawal:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ยกเลิกการร้องขอถอนเงินฉุกเฉิน
 * @param {string} ownerAddress ที่อยู่เจ้าของระบบ
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const cancelEmergencyWithdraw = async (ownerAddress) => {
  try {
    const tx = contractInstance.methods.cancelEmergencyWithdraw();
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: ownerAddress });
    
    const result = await tx.send({
      from: ownerAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error canceling emergency withdrawal:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ตั้งค่าสถานะการหยุดทำงานของสัญญา
 * @param {string} ownerAddress ที่อยู่เจ้าของระบบ
 * @param {boolean} paused สถานะการหยุดทำงาน
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const setPaused = async (ownerAddress, paused) => {
  try {
    const tx = contractInstance.methods.setPaused(paused);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: ownerAddress });
    
    const result = await tx.send({
      from: ownerAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error setting paused status:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ตั้งค่าสถานะของแพลน
 * @param {string} adminAddress ที่อยู่แอดมิน
 * @param {number} planId รหัสแพลน
 * @param {boolean} isActive สถานะแพลน
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const setPlanStatus = async (adminAddress, planId, isActive) => {
  try {
    const tx = contractInstance.methods.setPlanStatus(planId, isActive);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: adminAddress });
    
    const result = await tx.send({
      from: adminAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error setting plan status:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ตั้งค่ารูปภาพแพลน
 * @param {string} adminAddress ที่อยู่แอดมิน
 * @param {number} planId รหัสแพลน
 * @param {string} imageURI URI ของรูปภาพ
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const setPlanDefaultImage = async (adminAddress, planId, imageURI) => {
  try {
    const tx = contractInstance.methods.setPlanDefaultImage(planId, imageURI);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: adminAddress });
    
    const result = await tx.send({
      from: adminAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error setting plan default image:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ตั้งค่า base URI
 * @param {string} adminAddress ที่อยู่แอดมิน
 * @param {string} baseURI URI พื้นฐาน
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const setBaseURI = async (adminAddress, baseURI) => {
  try {
    const tx = contractInstance.methods.setBaseURI(baseURI);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: adminAddress });
    
    const result = await tx.send({
      from: adminAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error setting base URI:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * อัพเดทจำนวนสมาชิกต่อรอบ
 * @param {string} adminAddress ที่อยู่แอดมิน
 * @param {number} planId รหัสแพลน
 * @param {number} newMembersPerCycle จำนวนสมาชิกต่อรอบใหม่
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const updateMembersPerCycle = async (adminAddress, planId, newMembersPerCycle) => {
  try {
    const tx = contractInstance.methods.updateMembersPerCycle(planId, newMembersPerCycle);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: adminAddress });
    
    const result = await tx.send({
      from: adminAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error updating members per cycle:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ตั้งค่า price feed
 * @param {string} adminAddress ที่อยู่แอดมิน
 * @param {string} priceFeedAddress ที่อยู่ price feed
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const setPriceFeed = async (adminAddress, priceFeedAddress) => {
  try {
    const tx = contractInstance.methods.setPriceFeed(priceFeedAddress);
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: adminAddress });
    
    const result = await tx.send({
      from: adminAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error setting price feed:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ดึง NFT Image ของสมาชิก
 * @param {number} tokenId รหัส Token
 * @returns {Promise<Object>} ข้อมูล NFT Image
 */
const getNFTImage = async (tokenId) => {
  try {
    const imageInfo = await contractInstance.methods.getNFTImage(tokenId).call();
    
    return {
      imageURI: imageInfo.imageURI,
      name: imageInfo.name,
      description: imageInfo.description,
      planId: parseInt(imageInfo.planId),
      createdAt: new Date(imageInfo.createdAt * 1000)
    };
  } catch (error) {
    console.error('Error getting NFT image:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ดึงรหัส token ของเจ้าของ
 * @param {string} address ที่อยู่กระเป๋า
 * @returns {Promise<number>} รหัส token
 */
const getTokenId = async (address) => {
  try {
    const tokenId = await contractInstance.methods.tokenOfOwnerByIndex(address, 0).call();
    return parseInt(tokenId);
  } catch (error) {
    console.error('Error getting token ID:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ดึงข้อมูล token metadata
 * @param {string} walletAddress ที่อยู่กระเป๋า
 * @returns {Promise<Object>} ข้อมูล metadata ของ token
 */
const getTokenMetadata = async (walletAddress) => {
  try {
    // ดึง token ID
    const tokenId = await getTokenId(walletAddress);
    if (!tokenId) return null;
    
    // ดึงข้อมูล NFT
    const nftImage = await getNFTImage(tokenId);
    
    return {
      tokenId,
      ...nftImage
    };
  } catch (error) {
    console.error('Error getting token metadata:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ออกจากการเป็นสมาชิก
 * @param {string} memberAddress ที่อยู่สมาชิก
 * @returns {Promise<Object>} ผลลัพธ์การทำธุรกรรม
 */
const exitMembership = async (memberAddress) => {
  try {
    const tx = contractInstance.methods.exitMembership();
    
    // ส่ง transaction
    const gasEstimate = await tx.estimateGas({ from: memberAddress });
    
    const result = await tx.send({
      from: memberAddress,
      gas: Math.floor(gasEstimate * 1.2), // เพิ่ม gas 20%
    });
    
    return result;
  } catch (error) {
    console.error('Error exiting membership:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ดึงข้อมูลสายอ้างอิง
 * @param {string} memberAddress ที่อยู่สมาชิก
 * @returns {Promise<Array>} สายอ้างอิง
 */
const getReferralChain = async (memberAddress) => {
  try {
    const chain = await contractInstance.methods.getReferralChain(memberAddress).call();
    return chain;
  } catch (error) {
    console.error('Error getting referral chain:', error);
    throw new Error(handleContractError(error));
  }
};

/**
 * ตรวจสอบความถูกต้องของยอดเงินในสัญญา
 * @returns {Promise<Object>} ผลการตรวจสอบ
 */
const validateContractBalance = async () => {
  try {
    const result = await contractInstance.methods.validateContractBalance().call();
    return {
      isValid: result[0],
      expectedBalance: web3.utils.fromWei(result[1], 'ether'),
      actualBalance: web3.utils.fromWei(result[2], 'ether')
    };
  } catch (error) {
    console.error('Error validating contract balance:', error);
    throw new Error(handleContractError(error));
  }
};

module.exports = {
  // Member functions
  isMember,
  getMemberInfo,
  getAllMembers,
  getReferralHistory,
  getMemberTransactions,
  
  // System functions
  getSystemStats,
  getTodayMemberStats,
  
  getAllPlans: require('./contract').getAllPlans,

  registerMember: require('./contract').registerMember,
  upgradePlan: require('./contract').upgradePlan,
  exitMembership: require('./contract').exitMembership,

  getContractStatus: require('./contract').getContractStatus,
  withdrawBalance: require('./contract').withdrawBalance,
  batchWithdraw: require('./contract').batchWithdraw,
  requestEmergencyWithdraw: require('./contract').requestEmergencyWithdraw,
  emergencyWithdraw: require('./contract').emergencyWithdraw,
  cancelEmergencyWithdraw: require('./contract').cancelEmergencyWithdraw,
  setPaused: require('./contract').setPaused,
  setPlanStatus: require('./contract').setPlanStatus,
  setPlanDefaultImage: require('./contract').setPlanDefaultImage,
  setBaseURI: require('./contract').setBaseURI,
  updateMembersPerCycle: require('./contract').updateMembersPerCycle,
  setPriceFeed: require('./contract').setPriceFeed,
  getNFTImage: require('./contract').getNFTImage,
  getTokenId: require('./contract').getTokenId,
  getTokenMetadata: require('./contract').getTokenMetadata,
  
  getReferralChain: require('./contract').getReferralChain,
  validateContractBalance: require('./contract').validateContractBalance
};