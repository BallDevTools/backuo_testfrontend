// public/js/admin.js - สคริปต์สำหรับหน้าแอดมิน

document.addEventListener('DOMContentLoaded', function() {
  // จัดการการตั้งค่าแพลน
  setupPlanManagement();
  
  // จัดการการตั้งค่าระบบ
  setupSystemSettings();
});

// ฟังก์ชันจัดการการตั้งค่าแพลน
function setupPlanManagement() {
  const togglePlanStatusBtns = document.querySelectorAll('.toggle-plan-status');
  
  togglePlanStatusBtns.forEach(btn => {
    btn.addEventListener('click', async function() {
      const planId = this.dataset.planId;
      const isActive = this.dataset.isActive === 'true';
      
      // แสดงการยืนยันก่อนเปลี่ยนสถานะ
      if (confirm(`คุณต้องการ${isActive ? 'ปิด' : 'เปิด'}การใช้งานแพลน ${planId} ใช่หรือไม่?`)) {
        try {
          const formData = new FormData();
          formData.append('planId', planId);
          formData.append('isActive', !isActive);
          
          const response = await fetch('/admin/plans/update-status', {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            window.location.reload();
          } else {
            alert('เกิดข้อผิดพลาดในการอัพเดทสถานะแพลน');
          }
        } catch (error) {
          console.error('Error updating plan status:', error);
          alert('เกิดข้อผิดพลาดในการอัพเดทสถานะแพลน');
        }
      }
    });
  });
}

// ฟังก์ชันจัดการการตั้งค่าระบบ
function setupSystemSettings() {
  const setPausedForm = document.getElementById('set-paused-form');
  if (setPausedForm) {
    setPausedForm.addEventListener('submit', function(e) {
      if (!confirm('คุณแน่ใจหรือไม่ที่จะเปลี่ยนสถานะการทำงานของสัญญา?')) {
        e.preventDefault();
      }
    });
  }
}