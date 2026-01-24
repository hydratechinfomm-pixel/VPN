const jwt = require('jsonwebtoken');
const constants = require('../config/constants');
const ActivityLog = require('../models/ActivityLog');

/**
 * Verify JWT token and extract user info
 */
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, constants.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Verify user is admin (full panel control including VPN server ops and creating panel users)
 */
exports.authorizeAdmin = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId);

    const role = user.role?.toLowerCase();
    if (!user || role !== constants.ROLES.ADMIN) {
      await logActivity(req.userId, 'ADMIN_ACCESS_DENIED', 'USER', null, false, 'Unauthorized admin access attempt');
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Verify user is panel admin or staff (admin or staff)
 * Staff can do all except VPN server write ops and creating panel users
 */
exports.authorizePanelAdmin = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId);

    const role = user.role?.toLowerCase();
    if (!user || (role !== constants.ROLES.ADMIN && role !== constants.ROLES.staff)) {
      await logActivity(req.userId, 'PANEL_ADMIN_ACCESS_DENIED', 'USER', null, false, 'Panel admin or staff access required');
      return res.status(403).json({ error: 'Panel admin or staff access required' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Verify user has permission for resource
 */
exports.authorizeResourceAccess = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role?.toLowerCase() === constants.ROLES.ADMIN) {
      req.user = user;
      return next();
    }

    // For non-admin users, verify they own the resource
    const resourceId = req.params.resourceId || req.params.id;
    if (user._id.toString() !== resourceId) {
      await logActivity(req.userId, 'UNAUTHORIZED_ACCESS', 'USER', resourceId, false, 'Attempted to access unauthorized resource');
      return res.status(403).json({ error: 'Access denied' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Log activity
 */
async function logActivity(
  userId,
  action,
  resource,
  resourceId,
  success = true,
  errorMessage = null
) {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      resource,
      resourceId,
      status: success ? 'SUCCESS' : 'FAILED',
      errorMessage,
    });
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
  console.log(`Activity Logged: User ${userId}, Action: ${action}, Resource: ${resource}, Resource ID: ${resourceId}, Status: ${success ? 'SUCCESS' : 'FAILED'}`);
}

exports.logActivity = logActivity;
