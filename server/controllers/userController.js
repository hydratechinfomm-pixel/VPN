const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../middleware/auth');
const constants = require('../config/constants');

/**
 * Create panel user (admin only) - role must be admin or moderator
 */
exports.createPanelUser = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, role } = req.body;

    const existing = await User.findOne({ $or: [{ email: email?.toLowerCase() }, { username: username?.toLowerCase() }] });
    if (existing) {
      return res.status(400).json({ error: 'User with this email or username already exists' });
    }

    const user = new User({
      username: username?.trim().toLowerCase(),
      email: email?.toLowerCase(),
      password,
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      role: role === 'admin' || role === 'moderator' ? role : constants.ROLES.MODERATOR,
      plan: 'FREE',
      isActive: true,
    });

    await user.save();
    await logActivity(req.userId, 'CREATE_PANEL_USER', 'USER', user._id, true);

    res.status(201).json({
      message: 'Panel user created successfully',
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all users (panel admin or staff)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, plan, isActive } = req.query;
    const query = {};

    if (role) query.role = role;
    if (plan) query.plan = plan;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const users = await User.find(query)
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

    // Staff (moderator) cannot update admin users or set role to admin
    if (req.user && req.user.role === constants.ROLES.MODERATOR) {
      if (user.role === constants.ROLES.ADMIN) {
        return res.status(403).json({ error: 'Staff cannot modify admin users' });
      }
      if (role === constants.ROLES.ADMIN) {
        return res.status(403).json({ error: 'Staff cannot assign admin role' });
      }
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

    // Staff (moderator) cannot delete admin users
    if (req.user && req.user.role === constants.ROLES.MODERATOR && user.role === constants.ROLES.ADMIN) {
      return res.status(403).json({ error: 'Staff cannot delete admin users' });
    }

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
 * Get user data usage (from devices)
 */
exports.getUserDataUsage = async (req, res) => {
  try {
    const { userId } = req.params;
    const Device = require('../models/Device');

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const devices = await Device.find({ user: userId });
    const totalUsage = devices.reduce((sum, d) => sum + (d.usage?.bytesSent || 0) + (d.usage?.bytesReceived || 0), 0);

    res.json({
      userId,
      plan: user.plan,
      totalDataUsage: totalUsage,
      dataUsageGB: (totalUsage / (1024 ** 3)).toFixed(2),
      devicesUsage: devices.map(d => ({
        deviceId: d._id,
        name: d.name,
        dataUsageGB: (((d.usage?.bytesSent || 0) + (d.usage?.bytesReceived || 0)) / (1024 ** 3)).toFixed(2),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
