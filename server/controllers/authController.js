const User = require('../models/User');
const AuthService = require('../services/AuthService');
const ActivityLog = require('../models/ActivityLog');
const { logActivity } = require('../middleware/auth');

/**
 * Register new user
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create new user
    user = new User({
      username,
      email,
      password,
      firstName,
      lastName,
    });

    await user.save();
    await logActivity(user._id, 'LOGIN', 'USER', user._id, true);

    const token = AuthService.generateToken(user._id);
    const refreshToken = AuthService.generateRefreshToken(user._id);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is disabled' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await logActivity(user._id, 'LOGIN', 'USER', user._id, true);

    // Generate tokens
    const token = AuthService.generateToken(user._id);
    const refreshToken = AuthService.generateRefreshToken(user._id);

    // Extract device info from request
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress;
    const deviceId = req.headers['x-device-id'] || `device-${Date.now()}`;

    // Add session to active sessions
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7); // 7 days

    user.activeSessions.push({
      deviceId,
      userAgent,
      ipAddress,
      token: token.substring(0, 20), // Store only token prefix for security
      expiresAt: tokenExpiry,
      isActive: true,
    });

    // Keep only last 10 sessions
    if (user.activeSessions.length > 10) {
      user.activeSessions = user.activeSessions.slice(-10);
    }

    user.securitySettings.lastLoginAt = new Date();
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: user.toJSON(),
      session: {
        deviceId,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Refresh token
 */
exports.refreshToken = (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const decoded = AuthService.verifyToken(refreshToken);
    if (!decoded.type || decoded.type !== 'refresh') {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const token = AuthService.generateToken(decoded.userId);
    const newRefreshToken = AuthService.generateRefreshToken(decoded.userId);

    res.json({
      token,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
};

/**
 * Logout user
 */
exports.logout = async (req, res) => {
  try {
    await logActivity(req.userId, 'LOGOUT', 'USER', req.userId, true);
    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get current user
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
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
 * Change password
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    await logActivity(user._id, 'CHANGE_PASSWORD', 'PROFILE', user._id, true);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get active sessions
 */
exports.getActiveSessions = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sessions = user.activeSessions
      .filter((s) => s.isActive && new Date(s.expiresAt) > new Date())
      .map((s) => ({
        deviceId: s.deviceId,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
      }));

    res.json({
      total: sessions.length,
      sessions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Logout from other devices
 */
exports.logoutOtherDevices = async (req, res) => {
  try {
    const userId = req.userId;
    const currentDeviceId = req.headers['x-device-id'];

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mark all other sessions as inactive
    user.activeSessions.forEach((session) => {
      if (session.deviceId !== currentDeviceId) {
        session.isActive = false;
      }
    });

    await user.save();
    await logActivity(userId, 'LOGOUT_OTHER_DEVICES', 'SECURITY', userId, true);

    res.json({ message: 'All other sessions logged out' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Logout specific device
 */
exports.logoutDevice = async (req, res) => {
  try {
    const userId = req.userId;
    const { deviceId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const session = user.activeSessions.find((s) => s.deviceId === deviceId);
    if (session) {
      session.isActive = false;
    }

    await user.save();
    await logActivity(userId, 'LOGOUT_DEVICE', 'SECURITY', userId, true);

    res.json({ message: 'Device logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update user profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, country, timezone } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.profile.phone = phone;
    if (country) user.profile.country = country;
    if (timezone) user.profile.timezone = timezone;

    await user.save();
    await logActivity(user._id, 'UPDATE_PROFILE', 'PROFILE', user._id, true);

    res.json({
      message: 'Profile updated successfully',
      user: user.toJSON(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
