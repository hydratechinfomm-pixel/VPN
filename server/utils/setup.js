const User = require('../models/User');
const VpnServer = require('../models/VpnServer');
const constants = require('../config/constants');

/**
 * Initialize default admin user
 */
exports.initializeAdmin = async () => {
  try {
    const adminCount = await User.countDocuments({ role: constants.ROLES.ADMIN });
    
    if (adminCount === 0) {
      const admin = new User({
        username: 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'Change@123',
        firstName: 'System',
        lastName: 'Administrator',
        role: constants.ROLES.ADMIN,
        plan: 'ENTERPRISE',
        isActive: true,
      });
      
      await admin.save();
      console.log('✓ Default admin user created');
      console.log('  Username: admin');
      console.log(`  Email: ${admin.email}`);
      console.log('  Password: (from .env ADMIN_PASSWORD)');
      console.log('  ⚠️  IMPORTANT: Change the admin password after first login!');
    }
  } catch (error) {
    console.error('Error initializing admin:', error.message);
  }
};

/**
 * Get system statistics
 */
exports.getSystemStats = async () => {
  try {
    const totalUsers = await User.countDocuments();
    const totalServers = await VpnServer.countDocuments();
    const activeServers = await VpnServer.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: constants.ROLES.ADMIN });
    const premiumUsers = await User.countDocuments({ plan: 'PREMIUM' });
    const enterpriseUsers = await User.countDocuments({ plan: 'ENTERPRISE' });

    return {
      totalUsers,
      totalServers,
      activeServers,
      adminUsers,
      premiumUsers,
      enterpriseUsers,
      freeUsers: totalUsers - premiumUsers - enterpriseUsers,
    };
  } catch (error) {
    console.error('Error getting system stats:', error.message);
    return {};
  }
};

/**
 * Validate server configuration
 */
exports.validateServerConfig = (config) => {
  const errors = [];

  if (!config.name || config.name.trim().length === 0) {
    errors.push('Server name is required');
  }

  if (!config.host || config.host.trim().length === 0) {
    errors.push('Server host is required');
  }

  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Server port must be between 1 and 65535');
  }

  if (!config.apiUrl || !config.apiUrl.includes('://')) {
    errors.push('Valid API URL is required');
  }

  if (!config.apiToken || config.apiToken.trim().length === 0) {
    errors.push('API token is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Check user quota
 */
exports.checkUserQuota = async (userId) => {
  try {
    const user = await User.findById(userId).populate('accessKeys');
    
    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const planLimits = constants.ACCESS_KEY_LIMITS;
    const currentLimit = planLimits[user.plan] || planLimits.FREE;
    const keyCount = user.accessKeys.length;

    if (keyCount >= currentLimit) {
      return {
        allowed: false,
        reason: `You have reached the maximum number of access keys (${currentLimit}) for your plan`,
        current: keyCount,
        limit: currentLimit,
      };
    }

    return {
      allowed: true,
      current: keyCount,
      limit: currentLimit,
      remaining: currentLimit - keyCount,
    };
  } catch (error) {
    console.error('Error checking user quota:', error.message);
    return { allowed: false, reason: 'Error checking quota' };
  }
};
