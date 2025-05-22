// public/js/app.js - สคริปต์หลักของแอปพลิเคชัน

// ตรวจสอบว่ามี Metamask หรือไม่
const isMetaMaskInstalled = () => {
  return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
};

// เชื่อมต่อกับ Metamask
const connectMetaMask = async () => {
  if (!isMetaMaskInstalled()) {
    alert('กรุณาติดตั้ง MetaMask ก่อนใช้งาน');
    window.open('https://metamask.io/download.html', '_blank');
    return null;
  }

  try {
    // ขอสิทธิ์เข้าถึงบัญชี
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  } catch (error) {
    console.error('Error connecting to MetaMask:', error);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับ MetaMask: ' + error.message);
    return null;
  }
};

// ตรวจสอบเครือข่ายที่ถูกต้อง
const checkNetwork = async (networkId) => {
  if (!isMetaMaskInstalled()) {
    return false;
  }

  try {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    const currentNetworkId = parseInt(currentChainId, 16);
    
    if (currentNetworkId !== networkId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + networkId.toString(16) }],
        });
        return true;
      } catch (switchError) {
        // ถ้าเครือข่ายไม่ได้เพิ่มในกระเป๋า
        if (switchError.code === 4902) {
          alert('เครือข่ายนี้ยังไม่ได้ถูกเพิ่มใน MetaMask ของคุณ');
        }
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
};

// อนุญาต Token (USDT)
const approveToken = async (tokenAddress, spenderAddress, amount) => {
  if (!isMetaMaskInstalled()) {
    alert('กรุณาติดตั้ง MetaMask ก่อนใช้งาน');
    return false;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const userAddress = accounts[0];
    
    // ABI สำหรับฟังก์ชัน approve ของ ERC20
    const tokenABI = [
      {
        "constant": false,
        "inputs": [
          {
            "name": "spender",
            "type": "address"
          },
          {
            "name": "amount",
            "type": "uint256"
          }
        ],
        "name": "approve",
        "outputs": [
          {
            "name": "",
            "type": "bool"
          }
        ],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];
    
    // สร้าง Web3 object
    const web3 = new Web3(window.ethereum);
    
    // สร้าง Contract instance
    const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
    
    // เรียกใช้ฟังก์ชัน approve
    const result = await tokenContract.methods.approve(spenderAddress, amount).send({
      from: userAddress
    });
    
    return result.status;
  } catch (error) {
    console.error('Error approving token:', error);
    alert('เกิดข้อผิดพลาดในการอนุญาตโทเคน: ' + error.message);
    return false;
  }
};

// ตรวจสอบการอนุญาต Token
const checkAllowance = async (tokenAddress, ownerAddress, spenderAddress) => {
  if (!isMetaMaskInstalled()) {
    return 0;
  }

  try {
    // ABI สำหรับฟังก์ชัน allowance ของ ERC20
    const tokenABI = [
      {
        "constant": true,
        "inputs": [
          {
            "name": "owner",
            "type": "address"
          },
          {
            "name": "spender",
            "type": "address"
          }
        ],
        "name": "allowance",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "stateMutability": "view",
        "type": "function"
      }
    ];
    
    // สร้าง Web3 object
    const web3 = new Web3(window.ethereum);
    
    // สร้าง Contract instance
    const tokenContract = new web3.eth.Contract(tokenABI, tokenAddress);
    
    // เรียกใช้ฟังก์ชัน allowance
    const allowance = await tokenContract.methods.allowance(ownerAddress, spenderAddress).call();
    
    return allowance;
  } catch (error) {
    console.error('Error checking allowance:', error);
    return 0;
  }
};

// แปลงค่าหน่วยของ Token
const toWei = (amount, decimals = 18) => {
  const web3 = new Web3(window.ethereum);
  return web3.utils.toWei(amount.toString(), 'ether');
};

const fromWei = (amount, decimals = 18) => {
  const web3 = new Web3(window.ethereum);
  return web3.utils.fromWei(amount.toString(), 'ether');
};

// ตรวจสอบการเปลี่ยนบัญชีใน MetaMask
const checkAccountChange = (callback) => {
  if (isMetaMaskInstalled()) {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length === 0) {
        // ผู้ใช้ล็อกเอาท์จาก MetaMask
        callback(null);
      } else {
        // บัญชีถูกเปลี่ยน
        callback(accounts[0]);
      }
    });
  }
};

// ตรวจสอบการเปลี่ยนเครือข่ายใน MetaMask
const checkNetworkChange = (callback) => {
  if (isMetaMaskInstalled()) {
    window.ethereum.on('chainChanged', (chainId) => {
      const networkId = parseInt(chainId, 16);
      callback(networkId);
    });
  }
};

// ตรวจสอบการเชื่อมต่อที่หน้าโหลด
document.addEventListener('DOMContentLoaded', async () => {
  // ตรวจสอบเมื่อหน้าเว็บโหลด
  if (isMetaMaskInstalled()) {
    try {
      // ตรวจสอบบัญชีที่เชื่อมต่ออยู่แล้ว
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        const userAddress = accounts[0];
        
        // อัพเดทข้อมูลในหน้าเว็บถ้าจำเป็น
        if (document.getElementById('wallet-address')) {
          document.getElementById('wallet-address').textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        }
        
        if (document.getElementById('connect-wallet-btn')) {
          document.getElementById('connect-wallet-btn').textContent = 'กระเป๋าเชื่อมต่อแล้ว';
          document.getElementById('connect-wallet-btn').classList.add('connected');
        }
        
        // เรียกฟังก์ชันสำหรับอัพเดทข้อมูลอื่นๆ ที่เกี่ยวข้องกับกระเป๋า
        if (typeof updateWalletInfo === 'function') {
          updateWalletInfo(userAddress);
        }
      }
    } catch (error) {
      console.error('Error checking connected account:', error);
    }
  }
  
  // เพิ่ม event listener สำหรับปุ่มเชื่อมต่อกระเป๋า
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  if (connectWalletBtn) {
    connectWalletBtn.addEventListener('click', async () => {
      const address = await connectMetaMask();
      
      if (address) {
        // อัพเดทหน้าเว็บเมื่อเชื่อมต่อสำเร็จ
        connectWalletBtn.textContent = 'กระเป๋าเชื่อมต่อแล้ว';
        connectWalletBtn.classList.add('connected');
        
        if (document.getElementById('wallet-address')) {
          document.getElementById('wallet-address').textContent = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        }
        
        // ถ้ามีฟอร์มใส่ที่อยู่กระเป๋า ให้อัพเดท
        if (document.getElementById('walletAddress')) {
          document.getElementById('walletAddress').value = address;
        }
        
        // เรียกฟังก์ชันสำหรับอัพเดทข้อมูลอื่นๆ ที่เกี่ยวข้องกับกระเป๋า
        if (typeof updateWalletInfo === 'function') {
          updateWalletInfo(address);
        }
        
        // ตรวจสอบว่าเป็นฟอร์มลงทะเบียนหรืออัพเกรดหรือไม่
        if (document.getElementById('register-form') || document.getElementById('upgrade-form')) {
          // ตรวจสอบ network id
          const networkId = await window.ethereum.request({ method: 'eth_chainId' });
          const currentNetworkId = parseInt(networkId, 16);
          
          // ดึงค่า network id ที่ต้องการจาก data attribute หรือตั้งค่าเริ่มต้น
          const requiredNetworkId = parseInt(document.querySelector('meta[name="network-id"]')?.content || '1');
          
          // ตรวจสอบเครือข่าย
          if (currentNetworkId !== requiredNetworkId) {
            alert(`กรุณาเปลี่ยนเครือข่ายใน MetaMask เป็น ${document.querySelector('meta[name="network-name"]')?.content || 'Ethereum Mainnet'}`);
          }
        }
      }
    });
  }
  
  // จัดการ sidebar toggle ในหน้า dashboard
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.dashboard-sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('show');
    });
  }
});

// ฟังก์ชันคัดลอกลิงก์อ้างอิง
function copyReferralLink() {
  const referralLink = document.getElementById('referral-link');
  if (referralLink) {
    navigator.clipboard.writeText(referralLink.value).then(() => {
      alert('คัดลอกลิงก์อ้างอิงเรียบร้อยแล้ว');
    }, (err) => {
      console.error('Error copying text: ', err);
    });
  }
}

// นำฟังก์ชันไปใช้ในหน้าต่างๆ ของเว็บไซต์
window.app = {
  isMetaMaskInstalled,
  connectMetaMask,
  checkNetwork,
  approveToken,
  checkAllowance,
  toWei,
  fromWei,
  copyReferralLink
};