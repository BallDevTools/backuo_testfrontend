// public/js/dashboard.js - สคริปต์สำหรับหน้าแดชบอร์ด

document.addEventListener('DOMContentLoaded', function() {
  // สร้างกราฟต่างๆ ในแดชบอร์ด
  createCharts();

  // อัพเดทข้อมูลแบบเรียลไทม์
  setupRealTimeUpdates();
});

// ฟังก์ชันสร้างกราฟต่างๆ
async function createCharts() {
  try {
      // ดึงข้อมูลสำหรับกราฟการเติบโตของสมาชิก
      const membersGrowthData = await fetchMemberGrowthData();
      
      // สร้างกราฟการเติบโตของสมาชิก (ถ้ามี)
      const membersGrowthChart = document.getElementById('membersGrowthChart');
      if (membersGrowthChart) {
          const ctx = membersGrowthChart.getContext('2d');
          new Chart(ctx, {
              type: 'line',
              data: {
                  labels: membersGrowthData.labels,
                  datasets: [{
                      label: 'จำนวนสมาชิกใหม่',
                      data: membersGrowthData.data,
                      backgroundColor: 'rgba(52, 152, 219, 0.2)',
                      borderColor: '#3498db',
                      borderWidth: 2,
                      tension: 0.4
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                      y: {
                          beginAtZero: true
                      }
                  }
              }
          });
      }

      // ดึงข้อมูลสำหรับกราฟภาพรวมการเงิน
      const financialData = await fetchFinancialData();
      
      // สร้างกราฟภาพรวมการเงิน (ถ้ามี)
      const financialChart = document.getElementById('financialChart');
      if (financialChart) {
          const ctx = financialChart.getContext('2d');
          new Chart(ctx, {
              type: 'doughnut',
              data: {
                  labels: ['เงินเจ้าของ', 'เงินค่าธรรมเนียม', 'เงินกองทุน', 'ค่าคอมมิชชั่น'],
                  datasets: [{
                      data: [
                          financialData.ownerFunds,
                          financialData.feeFunds,
                          financialData.fundFunds,
                          financialData.totalCommission
                      ],
                      backgroundColor: [
                          '#3498db',
                          '#2ecc71',
                          '#f39c12',
                          '#e74c3c'
                      ]
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false
              }
          });
      }
  } catch (error) {
      console.error('Error creating charts:', error);
  }
}

// ฟังก์ชันดึงข้อมูลการเติบโตของสมาชิก
async function fetchMemberGrowthData() {
  try {
      const response = await fetch('/api/member-growth');
      const data = await response.json();
      return data;
  } catch (error) {
      console.error('Error fetching member growth data:', error);
      
      // ถ้าเกิดข้อผิดพลาด ส่งข้อมูลตัวอย่างกลับไป
      return {
          labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.'],
          data: [0, 0, 0, 0, 0, 0]
      };
  }
}

// ฟังก์ชันดึงข้อมูลการเงิน
async function fetchFinancialData() {
  try {
      const response = await fetch('/api/contract/stats');
      const data = await response.json();
      return {
          ownerFunds: parseFloat(data.ownerFunds),
          feeFunds: parseFloat(data.feeFunds),
          fundFunds: parseFloat(data.fundFunds),
          totalCommission: parseFloat(data.totalCommission)
      };
  } catch (error) {
      console.error('Error fetching financial data:', error);
      
      // ถ้าเกิดข้อผิดพลาด ส่งข้อมูลตัวอย่างกลับไป
      return {
          ownerFunds: 0,
          feeFunds: 0,
          fundFunds: 0,
          totalCommission: 0
      };
  }
}

// ฟังก์ชันอัพเดทข้อมูลแบบเรียลไทม์
function setupRealTimeUpdates() {
  // อัพเดทข้อมูลแพลน
  setInterval(async () => {
      try {
          const plansTableBody = document.getElementById('plans-table-body');
          if (plansTableBody) {
              const response = await fetch('/api/plans');
              const plans = await response.json();
              
              plansTableBody.innerHTML = '';
              
              plans.forEach(plan => {
                  const row = document.createElement('tr');
                  
                  row.innerHTML = `
                      <td>${plan.id}</td>
                      <td>${plan.name}</td>
                      <td>${plan.price} USDT</td>
                      <td>${plan.membersPerCycle}</td>
                      <td>${plan.currentCycle}</td>
                      <td>${plan.membersInCurrentCycle} / ${plan.membersPerCycle}</td>
                      <td>
                          <span class="badge badge-${plan.isActive ? 'success' : 'danger'}">
                              ${plan.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          </span>
                      </td>
                  `;
                  
                  plansTableBody.appendChild(row);
              });
          }
          
          // อัพเดทข้อมูลสถิติของระบบ (ถ้ามี)
          const systemStats = document.querySelectorAll('.dashboard-stat-value');
          if (systemStats.length > 0) {
              const response = await fetch('/api/contract/stats');
              const stats = await response.json();
              
              document.querySelectorAll('[data-stat="totalMembers"]').forEach(el => {
                  el.textContent = stats.totalMembers;
              });
              
              document.querySelectorAll('[data-stat="totalRevenue"]').forEach(el => {
                  el.textContent = stats.totalRevenue + ' USDT';
              });
              
              document.querySelectorAll('[data-stat="totalCommission"]').forEach(el => {
                  el.textContent = stats.totalCommission + ' USDT';
              });
              
              document.querySelectorAll('[data-stat="ownerFunds"]').forEach(el => {
                  el.textContent = stats.ownerFunds + ' USDT';
              });
              
              document.querySelectorAll('[data-stat="feeFunds"]').forEach(el => {
                  el.textContent = stats.feeFunds + ' USDT';
              });
              
              document.querySelectorAll('[data-stat="fundFunds"]').forEach(el => {
                  el.textContent = stats.fundFunds + ' USDT';
              });
          }
      } catch (error) {
          console.error('Error updating dashboard data:', error);
      }
  }, 60000); // อัพเดททุก 1 นาที
}