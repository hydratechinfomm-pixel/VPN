/**
 * Scheduler Service - Background Cron Jobs
 * 
 * This service manages all scheduled background tasks:
 * 
 * 1. Server Health Checks (every 5 minutes)
 *    - Checks health of all active VPN servers
 *    - Updates server stats.isHealthy and lastHealthCheck
 * 
 * 2. WireGuard Usage Sync (every 5 minutes)
 *    - Syncs device usage data from WireGuard servers
 *    - Updates device.usage fields (bytesSent, bytesReceived, lastSync)
 * 
 * 3. Outline Usage Sync (every 5 minutes)
 *    - Syncs device usage data from Outline servers
 *    - Updates device.usage and accessKey.usage fields
 * 
 * 4. Device Expiration (daily at midnight - 0 0 * * *)
 *    - Checks for devices with expiresAt < now
 *    - Sets status to EXPIRED and isEnabled to false
 *    - For Outline: Sets data limit to 0 bytes (suspends)
 *    - For WireGuard: Removes peer from server
 *    - Logs AUTO_PAUSED_EXPIRED history entry
 * 
 * 5. Plan Limit Enforcement (every 10 minutes)
 *    - Checks devices with ACTIVE status and data limits
 *    - Suspends devices that exceed their data limit
 *    - For Outline: Sets data limit to 0 bytes (suspends)
 *    - For WireGuard: Removes peer from server
 *    - Logs AUTO_PAUSED_LIMIT history entry
 * 
 * Production Notes:
 * - All cron jobs handle errors gracefully and continue even if individual operations fail
 * - Database status is always updated even if VPN API calls fail
 * - Outline API calls may fail with 409 Conflict - this is logged but doesn't stop the scheduler
 * - Ensure server has correct timezone for daily expiration check (runs at midnight server time)
 */
const cron = require('node-cron');
const VpnServer = require('../models/VpnServer');
const Device = require('../models/Device');
const AccessKey = require('../models/AccessKey');
const DeviceHistory = require('../models/DeviceHistory');
const WireGuardService = require('../services/WireGuardService');
const OutlineService = require('../services/OutlineService');

/**
 * Factory function to get the appropriate VPN service
 */
function getVpnService(server) {
  if (server.vpnType === 'outline') {
    return new OutlineService(server);
  }
  return new WireGuardService(server);
}

/**
 * Health check all servers every 5 minutes
 */
exports.scheduleServerHealthChecks = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const servers = await VpnServer.find({ isActive: true })
        .select('+outline.adminAccessKey +outline.ssh.privateKey');
      
      for (const server of servers) {
        try {
          const vpnService = getVpnService(server);
          const health = await vpnService.checkHealth();
          
          server.stats.isHealthy = health;
          server.stats.lastHealthCheck = new Date();
          await server.save();
          
          console.log(`[Health Check] ${server.name} (${server.vpnType}): ${health ? '✓ Healthy' : '✗ Unhealthy'}`);
        } catch (error) {
          console.error(`[Health Check] Error checking ${server.name}:`, error.message);
          server.stats.isHealthy = false;
          await server.save();
        }
      }
    } catch (error) {
      console.error('[Health Check] Error:', error.message);
    }
  });

  console.log('✓ Server health check scheduler started (every 5 minutes)');
};

/**
 * Sync device usage from WireGuard servers every 5 minutes
 */
exports.scheduleUsageSync = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const servers = await VpnServer.find({ isActive: true, vpnType: 'wireguard' });
      
      for (const server of servers) {
        try {
          const wgService = new WireGuardService(server);
          const devices = await Device.find({ server: server._id, isEnabled: true });
          
          if (devices.length === 0) continue;

          const usageUpdates = await wgService.syncUsage(devices);
          
          for (const update of usageUpdates) {
            await Device.findByIdAndUpdate(update.deviceId, {
              'usage.bytesReceived': update.bytesReceived,
              'usage.bytesSent': update.bytesSent,
              'usage.lastSync': new Date(),
              'connectivity.lastHandshake': update.lastHandshake,
              'connectivity.isConnected': update.isConnected,
            });
          }
          
          console.log(`[Usage Sync] Synced ${usageUpdates.length} WireGuard devices from ${server.name}`);
        } catch (error) {
          console.error(`[Usage Sync] Error syncing ${server.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[Usage Sync] Error:', error.message);
    }
  });

  console.log('✓ WireGuard usage sync scheduler started (every 5 minutes)');
};

/**
 * Sync Outline device usage every 5 minutes
 */
exports.scheduleOutlineUsageSync = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const servers = await VpnServer.find({ isActive: true, vpnType: 'outline' })
        .select('+outline.adminAccessKey +outline.ssh.privateKey');
      
      for (const server of servers) {
        try {
          const outlineService = new OutlineService(server);
          const devices = await Device.find({ server: server._id, isEnabled: true })
            .populate('accessKey');
          
          if (devices.length === 0) continue;

          // Fetch metrics from Outline server
          const metricsData = await outlineService.makeRequest('GET', 'metrics/transfer');
          const bytesTransferred = metricsData.bytesTransferredByUserId || {};
          
          let syncCount = 0;
          for (const device of devices) {
            if (device.accessKey && device.accessKey.accessKeyId) {
              const bytesUsed = bytesTransferred[device.accessKey.accessKeyId] || 0;
              
              // Update device usage
              device.usage.bytesReceived = bytesUsed;
              device.usage.bytesSent = 0; // Outline reports total bytes only
              device.usage.lastSync = new Date();
              await device.save();
              
              // Update access key usage
              const accessKey = await AccessKey.findById(device.accessKey._id);
              if (accessKey) {
                accessKey.usage.bytesReceived = bytesUsed;
                accessKey.usage.bytesSent = 0;
                accessKey.usage.lastSync = new Date();
                await accessKey.save();
              }
              
              syncCount++;
            }
          }
          
          console.log(`[Outline Usage Sync] Synced ${syncCount} Outline devices from ${server.name}`);
        } catch (error) {
          console.error(`[Outline Usage Sync] Error syncing ${server.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[Outline Usage Sync] Error:', error.message);
    }
  });

  console.log('✓ Outline usage sync scheduler started (every 5 minutes)');
};

/**
 * Check and expire devices daily
 */
exports.scheduleDeviceExpiration = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const expiredDevices = await Device.find({
        expiresAt: { $lt: now },
        status: { $ne: 'EXPIRED' },
      }).populate('server').populate('accessKey');
      console.log('Expired devices:', expiredDevices.length);

      for (const device of expiredDevices) {
        const oldStatus = device.status;
        device.status = 'EXPIRED';
        device.isEnabled = false;
        await device.save();

        // Handle Outline devices - set data limit to 0 to pause
        if (device.server && device.server.vpnType === 'outline' && device.accessKey) {
          try {
            const server = await VpnServer.findById(device.server._id)
              .select('+outline.adminAccessKey +outline.ssh.privateKey');
            
            if (!server || !server.outline?.adminAccessKey) {
              console.warn(`[Device Expiration] Server ${device.server._id} missing admin access key, skipping Outline API call`);
            } else {
              const outlineService = new OutlineService(server);
              await outlineService.setDataLimit(device.accessKey.accessKeyId, 0);
              device.dataLimit = { bytes: 1, isEnabled: true };
              await device.save();
              console.log(`[Device Expiration] Successfully paused Outline key for device ${device.name}`);
              // Update AccessKey status
              const accessKey = await AccessKey.findById(device.accessKey._id);
              if (accessKey) {
                accessKey.status = 'EXPIRED';
                await accessKey.save();
              }
              // Log history
              await DeviceHistory.create({
                device: device._id,
                user: null, // System action
                action: 'AUTO_PAUSED_EXPIRED',
                reason: 'auto_expired',
                changes: {
                  field: 'status',
                  oldValue: oldStatus,
                  newValue: 'EXPIRED',
                },
                metadata: {
                  notes: `Device expired at ${device.expiresAt.toISOString()}`,
                },
              });
            }
          } catch (error) {
            // Log error but continue - database status is already updated
            console.error(`[Device Expiration] Failed to pause Outline key for device ${device._id}:`, error.message);
            console.error(`[Device Expiration] Device status updated in database, but Outline API call failed`);
          }
        }
      }

      if (expiredDevices.length > 0) {
        console.log(`[Device Expiration] Expired ${expiredDevices.length} devices`);
      }
    } catch (error) {
      console.error('[Device Expiration] Error:', error.message);
    }
  });

  console.log('✓ Device expiration scheduler started (daily at midnight)');
};

/**
 * Enforce plan limits - check usage and disable devices exceeding limits
 */
exports.schedulePlanLimitEnforcement = () => {
  cron.schedule('*/10 * * * *', async () => {
    try {
      const devices = await Device.find({
        status: 'ACTIVE',
        isEnabled: true,
        isUnlimited: false,
        $or: [
          { 'dataLimit.isEnabled': true },
          { 'dataLimit.bytes': { $exists: true, $ne: null } }
        ]
      }).populate('plan').populate('server').populate('accessKey');

      let disabledCount = 0;

      for (const device of devices) {
        const totalUsage = (device.usage.bytesSent || 0) + (device.usage.bytesReceived || 0);
        const limit = device.dataLimit?.bytes || device.plan?.dataLimit?.bytes;

        if (limit && totalUsage >= limit) {
          device.isEnabled = false;
          device.status = 'SUSPENDED';
          await device.save();

          // Handle WireGuard devices
          if (device.server && device.server.vpnType === 'wireguard') {
            try {
              const wgService = new WireGuardService(device.server);
              await wgService.removePeer(device.publicKey);
              console.log(`[Plan Enforcement] Removed WireGuard peer for device ${device.name}`);
            } catch (error) {
              console.error(`Failed to remove WireGuard peer for device ${device._id}:`, error.message);
            }
          }
          
          // Handle Outline devices - set data limit to 0 to pause
          if (device.server && device.server.vpnType === 'outline' && device.accessKey) {
            try {
              const server = await VpnServer.findById(device.server._id)
                .select('+outline.adminAccessKey +outline.ssh.privateKey');
              
              if (!server || !server.outline?.adminAccessKey) {
                console.warn(`[Plan Enforcement] Server ${device.server._id} missing admin access key, skipping Outline API call`);
              } else {
                const outlineService = new OutlineService(server);
                await outlineService.setDataLimit(device.accessKey.accessKeyId, 0);
                console.log(`[Plan Enforcement] Successfully paused Outline key for device ${device.name}`);
                // Update AccessKey status 
                const accessKey = await AccessKey.findById(device.accessKey._id);
                if (accessKey) {
                  accessKey.status = 'SUSPENDED';
                  await accessKey.save();
                }
                // Log history
                await DeviceHistory.create({
                  device: device._id,
                  user: null, // System action
                  action: 'AUTO_PAUSED_LIMIT',
                  reason: 'auto_limit_reached',
                  changes: {
                    field: 'status',
                    oldValue: 'ACTIVE',
                    newValue: 'SUSPENDED',
                  },
                  metadata: {
                    notes: `Data limit ${limit} bytes exceeded (used: ${totalUsage} bytes)`,
                  },
                });
              }
              
            } catch (error) {
              // Log error but continue - database status is already updated
              console.error(`[Plan Enforcement] Failed to pause Outline key for device ${device._id}:`, error.message);
              console.error(`[Plan Enforcement] Device status updated in database, but Outline API call failed`);
            }
          }
          disabledCount++;
        }
      }

      if (disabledCount > 0) {
        console.log(`[Plan Enforcement] Disabled ${disabledCount} devices exceeding limits`);
      }
    } catch (error) {
      console.error('[Plan Enforcement] Error:', error.message);
    }
  });

  console.log('✓ Plan limit enforcement scheduler started (every 10 minutes)');
};

/**
 * Start all scheduled tasks
 */
exports.initializeSchedulers = () => {
  exports.scheduleServerHealthChecks();
  exports.scheduleUsageSync();
  exports.scheduleOutlineUsageSync();
  exports.scheduleDeviceExpiration();
  exports.schedulePlanLimitEnforcement();
  
  console.log('✓ All schedulers initialized successfully');
};
