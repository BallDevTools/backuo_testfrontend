// services/listener.js - ระบบติดตามอีเวนต์จากบล็อกเชน
const Web3 = require("web3");
const contractConfig = require("../config/blockchain");
const contractABI = require("../config/contractABI.json");
const transactionService = require("./transaction");
const notificationService = require("./notifications");
const userService = require("./user");
const planService = require("./plan");
const db = require("../config/database");

// บันทึกการเชื่อมต่อและสถานะ contract instance
let web3 = null;
let contractInstance = null;
let isInitialized = false;
let reconnectTimer = null;
let eventSubscriptions = [];

// รายชื่อ WebSocket providers ที่จะลองใช้
const wsProviders = [
  contractConfig.wsUrl || "wss://bsc-mainnet.nodereal.io/ws/v1/7e7a30b1480b470f99e3adaa329f4942",
  // "wss://bsc-ws.getblock.io/mainnet/",
  // "wss://bsc-mainnet.nodereal.io/ws/v1/7e7a30b1480b470f99e3adaa329f4942",
  // "wss://bsc.getblock.io/mainnet/",
  // "wss://apis.ankr.com/wss/v2/bsc/full/main",
  // "wss://binance.nodereal.io/ws/v1/"
];

// ตำแหน่งปัจจุบันใน providers
let currentProviderIndex = 0;

/**
 * สร้าง WebSocket provider ใหม่
 * @returns {Object} WebSocket provider
 */
const createWebsocketProvider = () => {
  const provider = new Web3.providers.WebsocketProvider(wsProviders[currentProviderIndex], {
    reconnect: {
      auto: true,
      delay: 5000,
      maxAttempts: 10,
      onTimeout: true
    },
    timeout: 30000,
    clientConfig: {
      maxReceivedFrameSize: 100000000,
      maxReceivedMessageSize: 100000000,
      keepalive: true,
      keepaliveInterval: 30000
    }
  });

  provider.on('connect', () => {
    console.log(`WebSocket connected to ${wsProviders[currentProviderIndex]}`);
  });

  provider.on('error', (err) => {
    // ย่อข้อความ error ให้สั้นลง
    const errorMessage = err.message || 'Unknown error';
    console.error(`WebSocket provider error: ${errorMessage.split('\n')[0]}`);
  });

  provider.on('end', (err) => {
    // ย่อข้อความ error ให้สั้นลง
    const errorMessage = err ? (err.message || 'Unknown reason') : 'Unknown reason';
    console.error(`WebSocket connection ended: ${errorMessage.split('\n')[0]}`);
    handleDisconnect();
  });

  provider.on('close', (err) => {
    // ย่อข้อความ error ให้สั้นลง
    const errorMessage = err ? (err.message || 'Unknown reason') : 'Unknown reason';
    console.error(`WebSocket connection closed: ${errorMessage.split('\n')[0]}`);
    handleDisconnect();
  });

  return provider;
};

/**
 * จัดการกรณีการเชื่อมต่อถูกตัด
 */
const handleDisconnect = () => {
  // ถ้ามี timer รอ reconnect อยู่แล้ว ไม่ต้องทำอะไร
  if (reconnectTimer) {
    return;
  }

  // ตั้ง timer เพื่อสลับ provider และลองเชื่อมต่อใหม่
  reconnectTimer = setTimeout(() => {
    console.log("Attempting to reconnect WebSocket...");
    switchProvider();
    reconnectTimer = null;
  }, 5000);
};

/**
 * สลับไปใช้ provider ถัดไป
 */
const switchProvider = () => {
  // ล้างการเชื่อมต่อเก่า
  if (web3 && web3.currentProvider) {
    try {
      web3.currentProvider.disconnect();
    } catch (error) {
      console.error("Error disconnecting current provider");
    }
  }

  // สลับไปยัง provider ถัดไป
  currentProviderIndex = (currentProviderIndex + 1) % wsProviders.length;
  console.log(`Switching to WebSocket provider: ${wsProviders[currentProviderIndex]}`);

  // สร้าง provider ใหม่
  const provider = createWebsocketProvider();
  
  // สร้าง web3 instance ใหม่
  web3 = new Web3(provider);
  
  // สร้าง contract instance ใหม่
  contractInstance = new web3.eth.Contract(
    contractABI,
    contractConfig.contractAddress
  );

  // ตรวจสอบการเชื่อมต่อโดยลองดึงเลขบล็อกล่าสุด
  web3.eth.getBlockNumber()
    .then((blockNumber) => {
      console.log(`Connected to blockchain. Latest block: ${blockNumber}`);
      // เริ่มการติดตามอีเวนต์ใหม่หลังจากเชื่อมต่อสำเร็จ
      if (isInitialized) {
        startEventListeners().catch(error => {
          console.error("Failed to restart event listeners");
        });
      }
    })
    .catch((error) => {
      // ย่อข้อความ error ให้สั้นลง
      console.error("Failed to connect to blockchain");
      // ลองสลับไปยัง provider ถัดไปอีกรอบ
      handleDisconnect();
    });
};

/**
 * ตรวจสอบการเชื่อมต่อและสลับ provider ถ้าจำเป็น
 */
const checkConnection = () => {
  // ถ้ายังไม่ได้สร้าง web3 หรือ ยังไม่ได้เริ่มต้น
  if (!web3 || !isInitialized) {
    return;
  }

  // ตรวจสอบเลขบล็อกล่าสุดเพื่อดูว่าการเชื่อมต่อยังใช้งานได้หรือไม่
  web3.eth.getBlockNumber()
    .then((blockNumber) => {
      console.log(`Connection check OK. Latest block: ${blockNumber}`);
    })
    .catch((error) => {
      console.error("Connection check failed. Switching provider...");
      switchProvider();
    });
};

/**
 * เริ่มต้นระบบติดตามอีเวนต์
 */
const initialize = () => {
  if (isInitialized) {
    return;
  }

  try {
    // สร้าง provider และ web3 instance
    const provider = createWebsocketProvider();
    web3 = new Web3(provider);
    
    // สร้าง contract instance
    contractInstance = new web3.eth.Contract(
      contractABI,
      contractConfig.contractAddress
    );

    isInitialized = true;
    console.log("WebSocket listener initialized successfully");
  } catch (error) {
    console.error("Failed to initialize WebSocket listener");
  }
};

/**
 * ล้างการติดตามอีเวนต์ทั้งหมด
 */
const clearEventSubscriptions = () => {
  // ล้างการติดตามอีเวนต์เดิมทั้งหมด
  eventSubscriptions.forEach(subscription => {
    try {
      if (subscription && subscription.removeAllListeners) {
        subscription.removeAllListeners();
      }
    } catch (error) {
      console.error("Error removing event listeners");
    }
  });
  eventSubscriptions = [];
};

/**
 * เริ่มต้นการติดตามอีเวนต์
 */
const startEventListeners = async () => {
  try {
    console.log('Starting event listeners...');
    
    // ตรวจสอบว่าได้เริ่มต้นระบบแล้วหรือยัง
    if (!isInitialized) {
      initialize();
    }
    
    // ตรวจสอบการเชื่อมต่อก่อน
    if (!web3 || !contractInstance) {
      console.error('Web3 or contract instance not initialized');
      return;
    }

    // ล้างการติดตามอีเวนต์เดิมทั้งหมด
    clearEventSubscriptions();
    
    // ลองดึงเลขบล็อกล่าสุดเพื่อตรวจสอบการเชื่อมต่อ
    try {
      const latestBlock = await web3.eth.getBlockNumber();
      console.log(`Connected to blockchain. Latest block: ${latestBlock}`);
    } catch (error) {
      console.error('Error checking blockchain connection');
      console.log('Switching to alternative provider...');
      switchProvider();
      return; // ออกจากฟังก์ชันเพื่อรอให้ switchProvider เสร็จและเรียก startEventListeners ใหม่
    }
    
    // ใช้ try-catch แยกสำหรับแต่ละอีเวนต์เพื่อให้ถ้าอันใดล้มเหลวจะไม่กระทบอันอื่น
    
    try {
      // ติดตามอีเวนต์ MemberRegistered
      const memberRegisteredEvent = contractInstance.events.MemberRegistered({
        fromBlock: "latest"
      })
      .on("data", async (event) => {
        try {
          console.log("MemberRegistered event:", event.returnValues);

          const { member, upline, planId, cycleNumber } = event.returnValues;

          // บันทึกข้อมูลลงฐานข้อมูล
          const [userResult] = await db.query(
            "SELECT id FROM users WHERE walletAddress = ?",
            [member]
          );

          if (userResult.length > 0) {
            const userId = userResult[0].id;

            // บันทึกธุรกรรม
            await transactionService.recordTransaction({
              userId,
              walletAddress: member,
              transactionType: "register",
              planId: parseInt(planId),
              txHash: event.transactionHash,
              status: "completed",
            });

            // สร้างการแจ้งเตือน
            await notificationService.createNotification({
              userId,
              type: "member_registered",
              title: "สมัครสมาชิกสำเร็จ",
              message: `คุณได้สมัครสมาชิกแพลน ${planId} สำเร็จแล้ว`,
              data: {
                planId: parseInt(planId),
                cycleNumber: parseInt(cycleNumber),
                upline,
              },
            });
          }

          // ตรวจสอบสถานะของรอบ
          const cycleStatus = await transactionService.checkCycleStatus(
            parseInt(planId)
          );

          if (cycleStatus.isComplete) {
            // แจ้งเตือนเมื่อรอบเสร็จสิ้น
            await notificationService.notifyCycleCompleted(
              parseInt(planId),
              parseInt(cycleNumber)
            );
          }
        } catch (error) {
          console.error("Error processing MemberRegistered event");
        }
      })
      .on("error", (error) => {
        console.error("Error in MemberRegistered event listener");
      });
      
      eventSubscriptions.push(memberRegisteredEvent);
    } catch (error) {
      console.error('Failed to set up MemberRegistered event listener');
    }
    
    try {
      // ติดตามอีเวนต์ PlanUpgraded
      const planUpgradedEvent = contractInstance.events.PlanUpgraded({
        fromBlock: "latest",
      })
      .on("data", async (event) => {
        try {
          console.log("PlanUpgraded event:", event.returnValues);

          const { member, oldPlanId, newPlanId, cycleNumber } =
            event.returnValues;

          // บันทึกข้อมูลลงฐานข้อมูล
          const [userResult] = await db.query(
            "SELECT id FROM users WHERE walletAddress = ?",
            [member]
          );

          if (userResult.length > 0) {
            const userId = userResult[0].id;

            // บันทึกธุรกรรม
            await transactionService.recordTransaction({
              userId,
              walletAddress: member,
              transactionType: "upgrade",
              planId: parseInt(newPlanId),
              txHash: event.transactionHash,
              status: "completed",
            });

            // สร้างการแจ้งเตือน
            await notificationService.createNotification({
              userId,
              type: "plan_upgraded",
              title: "อัพเกรดแพลนสำเร็จ",
              message: `คุณได้อัพเกรดจากแพลน ${oldPlanId} เป็นแพลน ${newPlanId} สำเร็จแล้ว`,
              data: {
                oldPlanId: parseInt(oldPlanId),
                newPlanId: parseInt(newPlanId),
                cycleNumber: parseInt(cycleNumber),
              },
            });
          }

          // ตรวจสอบสถานะของรอบ
          const cycleStatus = await transactionService.checkCycleStatus(
            parseInt(newPlanId)
          );

          if (cycleStatus.isComplete) {
            // แจ้งเตือนเมื่อรอบเสร็จสิ้น
            await notificationService.notifyCycleCompleted(
              parseInt(newPlanId),
              parseInt(cycleNumber)
            );
          }
        } catch (error) {
          console.error("Error processing PlanUpgraded event");
        }
      })
      .on("error", (error) => {
        console.error("Error in PlanUpgraded event listener");
      });
      
      eventSubscriptions.push(planUpgradedEvent);
    } catch (error) {
      console.error('Failed to set up PlanUpgraded event listener');
    }
    
    try {
      // ติดตามอีเวนต์ ReferralPaid
      const referralPaidEvent = contractInstance.events.ReferralPaid({
        fromBlock: "latest",
      })
      .on("data", async (event) => {
        try {
          console.log("ReferralPaid event:", event.returnValues);

          const { from, to, amount } = event.returnValues;

          // ดึงข้อมูลแพลนของผู้ถูกแนะนำ
          const memberInfo = await contractInstance.methods
            .members(from)
            .call();
          const planId = parseInt(memberInfo.planId);

          // แปลงจำนวนเงินเป็นหน่วยที่อ่านได้
          const commission = web3.utils.fromWei(amount, "ether");

          // บันทึกข้อมูลลงฐานข้อมูล
          const [referrerResult] = await db.query(
            "SELECT id FROM users WHERE walletAddress = ?",
            [to]
          );
          const [refereeResult] = await db.query(
            "SELECT id FROM users WHERE walletAddress = ?",
            [from]
          );

          if (referrerResult.length > 0 && refereeResult.length > 0) {
            const referrerId = referrerResult[0].id;
            const refereeId = refereeResult[0].id;

            // บันทึกข้อมูลการแนะนำ
            await db.query(
              `
              INSERT INTO referrals 
              (referrerId, refereeId, referrerWallet, refereeWallet, planId, commission, txHash) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
              [
                referrerId,
                refereeId,
                to,
                from,
                planId,
                commission,
                event.transactionHash,
              ]
            );
            // บันทึกธุรกรรม
            await transactionService.recordTransaction({
              userId: referrerId,
              walletAddress: to,
              transactionType: "referral",
              planId,
              amount: commission,
              txHash: event.transactionHash,
              status: "completed",
            });

            // สร้างการแจ้งเตือน
            await notificationService.notifyReferralCommission(
              to,
              from,
              planId,
              commission
            );
          }
        } catch (error) {
          console.error("Error processing ReferralPaid event");
        }
      })
      .on("error", (error) => {
        console.error("Error in ReferralPaid event listener");
      });
      
      eventSubscriptions.push(referralPaidEvent);
    } catch (error) {
      console.error('Failed to set up ReferralPaid event listener');
    }
    
    try {
      // ติดตามอีเวนต์ MemberExited
      const memberExitedEvent = contractInstance.events.MemberExited({
        fromBlock: "latest",
      })
      .on("data", async (event) => {
        try {
          console.log("MemberExited event:", event.returnValues);

          const { member, refundAmount } = event.returnValues;

          // บันทึกข้อมูลลงฐานข้อมูล
          const [userResult] = await db.query(
            "SELECT id FROM users WHERE walletAddress = ?",
            [member]
          );

          if (userResult.length > 0) {
            const userId = userResult[0].id;

            // บันทึกธุรกรรม
            await transactionService.recordTransaction({
              userId,
              walletAddress: member,
              transactionType: "exit",
              amount: web3.utils.fromWei(refundAmount, "ether"),
              txHash: event.transactionHash,
              status: "completed",
            });

            // สร้างการแจ้งเตือน
            await notificationService.createNotification({
              userId,
              type: "member_exited",
              title: "ออกจากการเป็นสมาชิกสำเร็จ",
              message: `คุณได้ออกจากการเป็นสมาชิกและได้รับเงินคืน ${web3.utils.fromWei(
                refundAmount,
                "ether"
              )} USDT`,
              data: {
                refundAmount: web3.utils.fromWei(refundAmount, "ether"),
              },
            });
          }
        } catch (error) {
          console.error("Error processing MemberExited event");
        }
      })
      .on("error", (error) => {
        console.error("Error in MemberExited event listener");
      });
      
      eventSubscriptions.push(memberExitedEvent);
    } catch (error) {
      console.error('Failed to set up MemberExited event listener');
    }
    
    try {
      // ติดตามอีเวนต์ NewCycleStarted
      const newCycleStartedEvent = contractInstance.events.NewCycleStarted({
        fromBlock: "latest",
      })
      .on("data", async (event) => {
        try {
          console.log("NewCycleStarted event:", event.returnValues);

          const { planId, cycleNumber } = event.returnValues;

          // อัพเดทข้อมูลรอบในฐานข้อมูล
          await planService.updatePlanCycle(
            parseInt(planId),
            parseInt(cycleNumber)
          );

          // แจ้งเตือนแอดมิน
          const [admins] = await db.query(`
            SELECT id FROM users WHERE role IN ('admin', 'owner')
          `);

          for (const admin of admins) {
            await notificationService.createNotification({
              userId: admin.id,
              type: "new_cycle",
              title: "รอบใหม่เริ่มต้น",
              message: `รอบที่ ${cycleNumber} ของแพลน ${planId} เริ่มต้นแล้ว`,
              data: {
                planId: parseInt(planId),
                cycleNumber: parseInt(cycleNumber),
              },
            });
          }
        } catch (error) {
          console.error("Error processing NewCycleStarted event");
        }
      })
      .on("error", (error) => {
        console.error("Error in NewCycleStarted event listener");
      });
      
      eventSubscriptions.push(newCycleStartedEvent);
    } catch (error) {
      console.error('Failed to set up NewCycleStarted event listener');
    }
    
    try {
      // ติดตามอีเวนต์ ContractPaused
      const contractPausedEvent = contractInstance.events.ContractPaused({
        fromBlock: "latest",
      })
      .on("data", async (event) => {
        try {
          console.log("ContractPaused event:", event.returnValues);

          const { status } = event.returnValues;

          // แจ้งเตือนแอดมิน
          const [admins] = await db.query(`
            SELECT id FROM users WHERE role IN ('admin', 'owner')
          `);

          for (const admin of admins) {
            await notificationService.createNotification({
              userId: admin.id,
              type: "contract_status",
              title: status ? "สัญญาหยุดทำงาน" : "สัญญากลับมาทำงาน",
              message: status
                ? "สัญญาได้หยุดการทำงานชั่วคราว ไม่สามารถทำธุรกรรมใหม่ได้"
                : "สัญญากลับมาทำงานปกติแล้ว สามารถทำธุรกรรมได้",
              data: {
                status: Boolean(status),
              },
            });
          }
        } catch (error) {
          console.error("Error processing ContractPaused event");
        }
      })
      .on("error", (error) => {
        console.error("Error in ContractPaused event listener");
      });
      
      eventSubscriptions.push(contractPausedEvent);
    } catch (error) {
      console.error('Failed to set up ContractPaused event listener');
    }

    // ติดตามอีเวนต์ PlanCreated
    try {
        const planCreatedEvent = contractInstance.events.PlanCreated({
            fromBlock: "latest"
        })
        .on("data", async (event) => {
            try {
                console.log("PlanCreated event:", event.returnValues);

                const { planId, name, price, membersPerCycle } = event.returnValues;

                // อัพเดทข้อมูลแพลนในฐานข้อมูล
                await planService.syncPlan({
                    id: parseInt(planId),
                    name,
                    price: web3.utils.fromWei(price, 'ether'),
                    membersPerCycle: parseInt(membersPerCycle),
                    isActive: true,
                    currentCycle: 1,
                    membersInCurrentCycle: 0
                });

                // สร้างการแจ้งเตือนสำหรับแอดมิน
                const [admins] = await db.query(`
                    SELECT id FROM users WHERE role IN ('admin', 'owner')
                `);

                for (const admin of admins) {
                    await notificationService.createNotification({
                        userId: admin.id,
                        type: 'plan_created',
                        title: 'สร้างแพลนใหม่',
                        message: `แพลน ${name} (ID: ${planId}) ถูกสร้างขึ้นแล้ว`,
                        data: {
                            planId: parseInt(planId),
                            name,
                            price: web3.utils.fromWei(price, 'ether'),
                            membersPerCycle: parseInt(membersPerCycle)
                        }
                    });
                }
            } catch (error) {
                console.error("Error processing PlanCreated event");
            }
        })
        .on("error", (error) => {
            console.error("Error in PlanCreated event listener");
        });
        
        eventSubscriptions.push(planCreatedEvent);
    } catch (error) {
        console.error('Failed to set up PlanCreated event listener');
    }

    // ติดตามอีเวนต์ PlanDefaultImageSet
    try {
        const planDefaultImageSetEvent = contractInstance.events.PlanDefaultImageSet({
            fromBlock: "latest"
        })
        .on("data", async (event) => {
            try {
                console.log("PlanDefaultImageSet event:", event.returnValues);

                const { planId, imageURI } = event.returnValues;

                // อัพเดทรูปภาพแพลนในฐานข้อมูล
                await planService.updatePlanImageURI(parseInt(planId), imageURI);

                // สร้างการแจ้งเตือนสำหรับแอดมิน
                const [admins] = await db.query(`
                    SELECT id FROM users WHERE role IN ('admin', 'owner')
                `);

                for (const admin of admins) {
                    await notificationService.createNotification({
                        userId: admin.id,
                        type: 'plan_image_updated',
                        title: 'อัพเดทรูปภาพแพลน',
                        message: `รูปภาพของแพลน ${planId} ถูกอัพเดทแล้ว`,
                        data: {
                            planId: parseInt(planId),
                            imageURI
                        }
                    });
                }
            } catch (error) {
                console.error("Error processing PlanDefaultImageSet event");
            }
        })
        .on("error", (error) => {
            console.error("Error in PlanDefaultImageSet event listener");
        });
        
        eventSubscriptions.push(planDefaultImageSetEvent);
    } catch (error) {
        console.error('Failed to set up PlanDefaultImageSet event listener');
    }

    // ติดตามอีเวนต์ UplineNotified
    try {
        const uplineNotifiedEvent = contractInstance.events.UplineNotified({
            fromBlock: "latest"
        })
        .on("data", async (event) => {
            try {
                console.log("UplineNotified event:", event.returnValues);

                const { upline, downline, downlineCurrentPlan, downlineTargetPlan } = event.returnValues;

                // ดึงข้อมูลผู้ใช้จากที่อยู่กระเป๋า
                const [uplineUserResult] = await db.query(
                    "SELECT id FROM users WHERE walletAddress = ?",
                    [upline]
                );

                const [downlineUserResult] = await db.query(
                    "SELECT id FROM users WHERE walletAddress = ?",
                    [downline]
                );

                if (uplineUserResult.length > 0) {
                    const uplineUserId = uplineUserResult[0].id;
                    
                    // สร้างการแจ้งเตือนสำหรับผู้แนะนำ
                    await notificationService.createNotification({
                        userId: uplineUserId,
                        type: 'upline_notification',
                        title: 'ผู้แนะนำของคุณต้องการอัพเกรด',
                        message: `ผู้ใช้ที่คุณแนะนำ ${downline.substring(0, 6)}...${downline.substring(downline.length - 4)} ต้องการอัพเกรดจากแพลน ${downlineCurrentPlan} เป็นแพลน ${downlineTargetPlan} กรุณาอัพเกรดแพลนของคุณ`,
                        data: {
                            upline,
                            downline,
                            downlineCurrentPlan: parseInt(downlineCurrentPlan),
                            downlineTargetPlan: parseInt
                        }
                    });
                }
            } catch (error) {
                console.error("Error processing UplineNotified event");
            }
        })
        .on("error", (error) => {
            console.error("Error in UplineNotified event listener");
        });
        
        eventSubscriptions.push(uplineNotifiedEvent);
    } catch (error) {
        console.error('Failed to set up UplineNotified event listener');
    }

    // ติดตามอีเวนต์ EmergencyWithdrawRequested
    try {
        const emergencyWithdrawRequestedEvent = contractInstance.events.EmergencyWithdrawRequested({
            fromBlock: "latest"
        })
        .on("data", async (event) => {
            try {
                console.log("EmergencyWithdrawRequested event:", event.returnValues);

                const { timestamp } = event.returnValues;

                if (parseInt(timestamp) > 0) {
                    // มีการร้องขอถอนเงินฉุกเฉิน
                    
                    // สร้างการแจ้งเตือนสำหรับแอดมินและเจ้าของ
                    const [admins] = await db.query(`
                        SELECT id FROM users WHERE role IN ('admin', 'owner')
                    `);
                    
                    for (const admin of admins) {
                        await notificationService.createNotification({
                            userId: admin.id,
                            type: 'emergency_withdraw_requested',
                            title: 'คำขอถอนเงินฉุกเฉิน',
                            message: `มีการร้องขอถอนเงินฉุกเฉิน สามารถดำเนินการได้หลังจาก ${new Date(timestamp * 1000 + 2 * 24 * 60 * 60 * 1000).toLocaleString('th-TH')}`,
                            data: {
                                timestamp: parseInt(timestamp),
                                completionTime: parseInt(timestamp) + 2 * 24 * 60 * 60
                            }
                        });
                    }
                    
                    // สร้างการแจ้งเตือนสำหรับสมาชิกทั้งหมด
                    const [members] = await db.query(`
                        SELECT u.id FROM users u
                        JOIN members m ON u.walletAddress = m.walletAddress
                    `);
                    
                    for (const member of members) {
                        await notificationService.createNotification({
                            userId: member.id,
                            type: 'emergency_withdraw_warning',
                            title: 'แจ้งเตือนการถอนเงินฉุกเฉิน',
                            message: `มีการร้องขอถอนเงินฉุกเฉินในระบบ ซึ่งจะดำเนินการได้หลังจาก ${new Date(timestamp * 1000 + 2 * 24 * 60 * 60 * 1000).toLocaleString('th-TH')}`,
                            data: {
                                timestamp: parseInt(timestamp),
                                completionTime: parseInt(timestamp) + 2 * 24 * 60 * 60
                            }
                        });
                    }
                } else {
                    // มีการยกเลิกคำขอถอนเงินฉุกเฉิน
                    
                    // สร้างการแจ้งเตือนสำหรับแอดมินและเจ้าของ
                    const [admins] = await db.query(`
                        SELECT id FROM users WHERE role IN ('admin', 'owner')
                    `);
                    
                    for (const admin of admins) {
                        await notificationService.createNotification({
                            userId: admin.id,
                            type: 'emergency_withdraw_canceled',
                            title: 'ยกเลิกคำขอถอนเงินฉุกเฉิน',
                            message: `คำขอถอนเงินฉุกเฉินถูกยกเลิกแล้ว`,
                            data: {}
                        });
                    }
                }
            } catch (error) {
                console.error("Error processing EmergencyWithdrawRequested event");
            }
        })
        .on("error", (error) => {
            console.error("Error in EmergencyWithdrawRequested event listener");
        });
        
        eventSubscriptions.push(emergencyWithdrawRequestedEvent);
    } catch (error) {
        console.error('Failed to set up EmergencyWithdrawRequested event listener');
    }

    // ติดตามอีเวนต์ EmergencyWithdraw
    try {
        const emergencyWithdrawEvent = contractInstance.events.EmergencyWithdraw({
            fromBlock: "latest"
        })
        .on("data", async (event) => {
            try {
                console.log("EmergencyWithdraw event:", event.returnValues);

                const { to, amount } = event.returnValues;

                // สร้างการแจ้งเตือนสำหรับแอดมินและเจ้าของ
                const [admins] = await db.query(`
                    SELECT id FROM users WHERE role IN ('admin', 'owner')
                `);
                
                for (const admin of admins) {
                    await notificationService.createNotification({
                        userId: admin.id,
                        type: 'emergency_withdraw_completed',
                        title: 'ถอนเงินฉุกเฉินสำเร็จ',
                        message: `ถอนเงินฉุกเฉินสำเร็จแล้ว จำนวน ${web3.utils.fromWei(amount, 'ether')} USDT`,
                        data: {
                            to,
                            amount: web3.utils.fromWei(amount, 'ether')
                        }
                    });
                }
                
                // สร้างการแจ้งเตือนสำหรับสมาชิกทั้งหมด
                const [members] = await db.query(`
                    SELECT u.id FROM users u
                    JOIN members m ON u.walletAddress = m.walletAddress
                `);
                
                for (const member of members) {
                    await notificationService.createNotification({
                        userId: member.id,
                        type: 'emergency_withdraw_completed',
                        title: 'แจ้งเตือนการถอนเงินฉุกเฉิน',
                        message: `ระบบได้ดำเนินการถอนเงินฉุกเฉินเรียบร้อยแล้ว จำนวน ${web3.utils.fromWei(amount, 'ether')} USDT`,
                        data: {
                            amount: web3.utils.fromWei(amount, 'ether')
                        }
                    });
                }
            } catch (error) {
                console.error("Error processing EmergencyWithdraw event");
            }
        })
        .on("error", (error) => {
            console.error("Error in EmergencyWithdraw event listener");
        });
        
        eventSubscriptions.push(emergencyWithdrawEvent);
    } catch (error) {
        console.error('Failed to set up EmergencyWithdraw event listener');
    }

    console.log("Event listeners started successfully");
  } catch (error) {
    console.error("Error starting event listeners");
  }
};

/**
 * หยุดการติดตามอีเวนต์
 */
const stopEventListeners = async () => {
  try {
    console.log("Stopping event listeners...");
    
    // ล้างการติดตามอีเวนต์ทั้งหมด
    clearEventSubscriptions();
    
    // ยกเลิกการเชื่อมต่อ
    if (web3 && web3.currentProvider) {
      if (typeof web3.currentProvider.disconnect === 'function') {
        web3.currentProvider.disconnect();
      }
    }
    
    // ล้าง timer
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    // รีเซ็ตสถานะ
    isInitialized = false;
    
    console.log("Event listeners stopped successfully");
  } catch (error) {
    console.error("Error stopping event listeners");
  }
};

/**
 * ดึงข้อมูลอีเวนต์ย้อนหลัง
 * @param {string} eventName ชื่ออีเวนต์
 * @param {number} fromBlock บล็อกเริ่มต้น
 * @param {number} toBlock บล็อกสิ้นสุด
 * @returns {Promise<Array>} รายการอีเวนต์
 */
const getPastEvents = async (eventName, fromBlock, toBlock = "latest") => {
  try {
    // ตรวจสอบว่าได้เริ่มต้นระบบแล้วหรือยัง
    if (!isInitialized) {
      initialize();
    }
    
    if (!contractInstance) {
      throw new Error("Contract instance not initialized");
    }
    
    return await contractInstance.getPastEvents(eventName, {
      fromBlock,
      toBlock,
    });
  } catch (error) {
    console.error(`Error getting past ${eventName} events`);
    throw error;
  }
};

// ส่งออกฟังก์ชันสำหรับใช้ภายนอก
module.exports = {
  initialize,
  startEventListeners,
  stopEventListeners,
  getPastEvents,
  checkConnection
};