// config/blockchain.js - ตั้งค่าการเชื่อมต่อกับบล็อกเชน
require('dotenv').config();

module.exports = {
  // ที่อยู่สัญญา CryptoMembershipNFT
  contractAddress: process.env.CONTRACT_ADDRESS_TEST || '0xd0B795ce48108a8F2C668Dc13ab8184260374b2D',
  
  // ที่อยู่ Token USDT (BUSD ใน BSC)
  usdtAddress: process.env.USDT_CONTRACT_ADDRESS_TEST  || '0x9f66d548B94Ec9a24b7C89e899dA26F8388DF11a',
  
  // URL ของ RPC Provider
  rpcUrl: process.env.RPC_URL_TEST || 'https://bsc-testnet-dataseed.bnbchain.org',
  
  // URL ของ WebSocket Provider
  wsUrl: process.env.WS_URL_TEST || 'wss://bsc-testnet.nodereal.io/ws/v1/289b94cae365454c977080778cf40483',
  
  // ID ของเครือข่าย
  networkId: parseInt(process.env.NETWORK_ID) || 97, // BSC Testnet
  
  // ชื่อของเครือข่าย
  networkName: process.env.NETWORK_NAME || 'Binance Smart Chain Testnet',
  
  // จำนวนการยืนยันขั้นต่ำ
  minConfirmations: 1,
  
  // แก๊สลิมิตสำหรับธุรกรรมต่างๆ
  gasLimits: {
    registerMember: 300000,
    upgradePlan: 250000,
    exitMembership: 200000,
    withdrawBalance: 150000,
    emergencyWithdraw: 350000,
    requestEmergencyWithdraw: 100000,
    cancelEmergencyWithdraw: 100000,
    setPaused: 100000
  }
};