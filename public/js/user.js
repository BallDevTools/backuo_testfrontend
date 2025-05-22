// public/js/user.js - สคริปต์สำหรับหน้าผู้ใช้

document.addEventListener('DOMContentLoaded', function() {
  // จัดการการอัพเกรดแพลน
  setupPlanUpgrade();
  
  // จัดการการออกจากการเป็นสมาชิก
  setupMembershipExit();
  
  // จัดการลิงก์แนะนำ
  setupReferralLink();
});

// ฟังก์ชันจัดการการอัพเกรดแพลน
function setupPlanUpgrade() {
  const upgradeForm = document.getElementById('upgrade-form');
  if (upgradeForm) {
    upgradeForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const planId = this.querySelector('input[name="newPlanId"]').value;
      const priceDifference = this.querySelector('input[name="priceDifference"]').value;
      
      // ตรวจสอบการอนุญาต USDT
      const contractAddress = document.querySelector('meta[name="contract-address"]').content;
      const usdtAddress = document.querySelector('meta[name="usdt-address"]').content;
      
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      
      try {
        const allowance = await window.app.checkAllowance(usdtAddress, userAddress, contractAddress);
        const requiredAmount = window.app.toWei(priceDifference, 6); // USDT ใช้ทศนิยม 6 ตำแหน่ง
        
        if (BigInt(allowance) < BigInt(requiredAmount)) {
          // ยังไม่ได้อนุญาต
          const approveResult = await window.app.approveToken(usdtAddress, contractAddress, requiredAmount);
          
          if (!approveResult) {
            alert('การอนุญาตโทเคนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
            return;
          }
        }
        
        // ส่งฟอร์ม
        this.submit();
      } catch (error) {
        console.error('Error in plan upgrade:', error);
        alert('เกิดข้อผิดพลาดในการอัพเกรดแพลน: ' + error.message);
      }
    });
  }
}

// ฟังก์ชันจัดการการออกจากการเป็นสมาชิก
function setupMembershipExit() {
  const exitForm = document.getElementById('exit-membership-form');
  if (exitForm) {
    exitForm.addEventListener('submit', function(e) {
      if (!confirm('คุณแน่ใจหรือไม่ที่จะออกจากการเป็นสมาชิก? การกระทำนี้ไม่สามารถยกเลิกได้')) {
        e.preventDefault();
      }
    });
  }
}

// ฟังก์ชันจัดการลิงก์แนะนำ
function setupReferralLink() {
  const copyReferralBtn = document.getElementById('copy-referral-btn');
  if (copyReferralBtn) {
    copyReferralBtn.addEventListener('click', function() {
      const referralLink = document.getElementById('referral-link');
      navigator.clipboard.writeText(referralLink.value).then(function() {
        alert('คัดลอกลิงก์อ้างอิงเรียบร้อยแล้ว');
      }, function(err) {
        console.error('Error copying text: ', err);
      });
    });
  }
}