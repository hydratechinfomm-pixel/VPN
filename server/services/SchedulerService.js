const cron = require('node-cron');
const VpnServer = require('../models/VpnServer');
const AccessKey = require('../models/AccessKey');
const OutlineServerService = require('../services/OutlineServerService');

/**
 * Health check all servers every 5 minutes
 */
exports.scheduleServerHealthChecks = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const servers = await VpnServer.find({ isActive: true });
      
      for (const server of servers) {
        try {
          const outlineService = new OutlineServerService(server);
          const health = await outlineService.healthCheck();
          
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
 * Sync access key data from servers every hour
 */
exports.scheduleDataSync = () => {
  cron.schedule('0 * * * *', async () => {
    try {
      const servers = await VpnServer.find({ isActive: true });
      
      for (const server of servers) {
        try {
          const outlineService = new OutlineServerService(server);
          const keys = await outlineService.getAccessKeys();
          
          for (const key of keys) {
            await AccessKey.findOneAndUpdate(
              { keyId: key.id, server: server._id },
              {
                dataUsage: { bytes: key.dataUsed || 0 },
                lastUpdated: new Date(),
              },
              { upsert: true }
            );
          }
          
          console.log(`[Data Sync] Synced ${keys.length} keys from ${server.name}`);
        } catch (error) {
          console.error(`[Data Sync] Error syncing ${server.name}:`, error.message);
        }
      }
    } catch (error) {
      console.error('[Data Sync] Error:', error.message);
    }
  });

  console.log('✓ Data sync scheduler started (every hour)');
};

/**
 * Check and expire access keys daily
 */
exports.scheduleKeyExpiration = () => {
  cron.schedule('0 0 * * *', async () => {
    try {
      const now = new Date();
      const expiredKeys = await AccessKey.find({
        expiresAt: { $lt: now },
        status: { $ne: 'EXPIRED' },
      });

      for (const key of expiredKeys) {
        key.status = 'EXPIRED';
        await key.save();
      }

      console.log(`[Key Expiration] Expired ${expiredKeys.length} access keys`);
    } catch (error) {
      console.error('[Key Expiration] Error:', error.message);
    }
  });

  console.log('✓ Key expiration scheduler started (daily at midnight)');
};

/**
 * Start all scheduled tasks
 */
exports.initializeSchedulers = () => {
  this.scheduleServerHealthChecks();
  this.scheduleDataSync();
  this.scheduleKeyExpiration();
};
