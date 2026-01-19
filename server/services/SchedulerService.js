const cron = require('node-cron');
const VpnServer = require('../models/VpnServer');
const Device = require('../models/Device');
const WireGuardService = require('../services/WireGuardService');

/**
 * Health check all servers every 5 minutes
 */
exports.scheduleServerHealthChecks = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const servers = await VpnServer.find({ isActive: true });
      
      for (const server of servers) {
        try {
          const wgService = new WireGuardService(server);
          const health = await wgService.healthCheck();
          
          server.stats.isHealthy = health.healthy;
          server.stats.lastHealthCheck = new Date();
          await server.save();
          
          console.log(`[Health Check] ${server.name}: ${health.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
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
      const servers = await VpnServer.find({ isActive: true });
      
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
          
          console.log(`[Usage Sync] Synced ${usageUpdates.length} devices from ${server.name}`);
        } catch (error) {
          console.error(`[Usage Sync] Error syncing ${server.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[Usage Sync] Error:', error.message);
    }
  });

  console.log('✓ Usage sync scheduler started (every 5 minutes)');
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
      });

      for (const device of expiredDevices) {
        device.status = 'EXPIRED';
        device.isEnabled = false;
        await device.save();
      }

      console.log(`[Device Expiration] Expired ${expiredDevices.length} devices`);
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
        'dataLimit.isEnabled': true,
      }).populate('plan');

      let disabledCount = 0;

      for (const device of devices) {
        const totalUsage = (device.usage.bytesSent || 0) + (device.usage.bytesReceived || 0);
        const limit = device.dataLimit?.bytes || device.plan?.dataLimit?.bytes;

        if (limit && totalUsage >= limit) {
          device.isEnabled = false;
          device.status = 'SUSPENDED';
          await device.save();

          // Remove peer from WireGuard
          try {
            const server = await VpnServer.findById(device.server);
            const wgService = new WireGuardService(server);
            await wgService.removePeer(device.publicKey);
          } catch (error) {
            console.error(`Failed to remove peer for device ${device._id}:`, error.message);
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
  this.scheduleServerHealthChecks();
  this.scheduleUsageSync();
  this.scheduleDeviceExpiration();
  this.schedulePlanLimitEnforcement();
};
