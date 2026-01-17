const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../middleware/auth');
const constants = require('../config/constants');

/**
 * Get all users (admin only)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, plan, isActive } = req.query;
    const query = {};

    if (role) query.role = role;
    if (plan) query.plan = plan;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
      .populate('accessKeys', 'name status')
      .sort({ createdAt: -1 });

    res.json({
      total: users.length,
      users: users.map(u => u.toJSON()),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get user by ID
 */
exports.getUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate('accessKeys')
      .populate('allowedServers');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update user
 */
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, plan, isActive, allowedServers } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (role && Object.values(constants.ROLES).includes(role)) {
      user.role = role;
    }
    if (plan && ['FREE', 'PREMIUM', 'ENTERPRISE'].includes(plan)) {
      user.plan = plan;
    }
    if (isActive !== undefined) {
      user.isActive = isActive;
    }
    if (allowedServers && Array.isArray(allowedServers)) {
      user.allowedServers = allowedServers;
    }

    await user.save();
    await logActivity(req.userId, 'UPDATE_USER', 'USER', user._id, true);

    res.json({
      message: 'User updated successfully',
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete user
 */
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Optionally: delete user's access keys and logs
    // await AccessKey.deleteMany({ user: userId });

    await User.findByIdAndDelete(userId);
    await logActivity(req.userId, 'DELETE_USER', 'USER', userId, true);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get user activity logs
 */
exports.getUserActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, limit = 50 } = req.query;

    const query = { user: userId };
    if (action) query.action = action;

    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      total: logs.length,
      logs,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get user data usage
 */
exports.getUserDataUsage = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('accessKeys');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate data usage from access keys
    const totalUsage = user.accessKeys.reduce((sum, key) => {
      return sum + (key.dataUsage?.bytes || 0);
    }, 0);

    res.json({
      userId,
      plan: user.plan,
      totalDataUsage: totalUsage,
      dataUsageGB: (totalUsage / (1024 ** 3)).toFixed(2),
      accessKeysUsage: user.accessKeys.map(key => ({
        keyId: key._id,
        name: key.name,
        dataUsageGB: ((key.dataUsage?.bytes || 0) / (1024 ** 3)).toFixed(2),
        limitGB: key.dataLimit?.bytes ? (key.dataLimit.bytes / (1024 ** 3)).toFixed(2) : 'Unlimited',
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
