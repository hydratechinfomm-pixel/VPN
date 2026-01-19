/**
 * Initialize admin user and system on first start
 */
const setupService = require('../utils/setup');
const schedulerService = require('../services/SchedulerService');

exports.initializeSystem = async () => {
  console.log('\n📋 Initializing WireGuard VPN Control Panel...\n');

  // Create default admin user
  await setupService.initializeAdmin();

  // Get system statistics
  const stats = await setupService.getSystemStats();
  console.log('\n📊 System Statistics:');
  console.log(`   Total Users: ${stats.totalUsers}`);
  console.log(`   Total Servers: ${stats.totalServers}`);
  console.log(`   Active Servers: ${stats.activeServers}\n`);

  // Initialize background schedulers
  schedulerService.initializeSchedulers();

  console.log('✓ System initialization complete!\n');
};
