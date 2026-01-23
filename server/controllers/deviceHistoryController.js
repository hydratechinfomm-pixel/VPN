const mongoose = require('mongoose');
const DeviceHistory = require('../models/DeviceHistory');
const Device = require('../models/Device');
const User = require('../models/User');

/**
 * Get device history
 */
exports.getDeviceHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    // Check if device exists and user has access
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    const isAdmin = user.role?.toLowerCase() === 'admin';
    const isModerator = user.role?.toLowerCase() === 'moderator';
    const isOwner = device.user && device.user.toString() === userId;

    if (!isAdmin && !isModerator && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get history
    const history = await DeviceHistory.find({ device: deviceId })
      .populate('user', 'username email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      deviceId,
      deviceName: device.name,
      total: history.length,
      history,
    });
  } catch (error) {
    console.error('Error fetching device history:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get history for all devices of a user
 */
exports.getUserDevicesHistory = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const requesterId = req.userId;

    // Check authorization
    const requester = await User.findById(requesterId);
    const isAdmin = requester.role?.toLowerCase() === 'admin';
    const isModerator = requester.role?.toLowerCase() === 'moderator';
    const isSelf = targetUserId === requesterId;

    if (!isAdmin && !isModerator && !isSelf) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all devices for the user
    const devices = await Device.find({ user: targetUserId });
    const deviceIds = devices.map(d => d._id);

    // Get history for all devices
    const history = await DeviceHistory.find({ device: { $in: deviceIds } })
      .populate('device', 'name')
      .populate('user', 'username email')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({
      userId: targetUserId,
      totalDevices: devices.length,
      totalHistoryRecords: history.length,
      history,
    });
  } catch (error) {
    console.error('Error fetching user devices history:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all device history with filters (admin/moderator only)
 */
exports.getAllHistory = async (req, res) => {
  try {
    const { userId, deviceId, deviceName, action, startDate, endDate } = req.query;
    const pageNum = parseInt(req.query.page) || 1;
    const limitNum = parseInt(req.query.limit) || 50;
    const requesterId = req.userId;

    // Check authorization
    const requester = await User.findById(requesterId);
    if (!requester) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const isAdmin = requester.role?.toLowerCase() === 'admin';
    const isModerator = requester.role?.toLowerCase() === 'moderator';

    if (!isAdmin && !isModerator) {
      return res.status(403).json({ error: 'Admin or moderator access required' });
    }

    // Build query
    const query = {};
    
    // User filter
    if (userId && typeof userId === 'string' && userId.trim()) {
      const trimmedUserId = userId.trim();
      if (!mongoose.Types.ObjectId.isValid(trimmedUserId)) {
        return res.status(400).json({ error: 'Invalid userId' });
      }
      query.user = new mongoose.Types.ObjectId(trimmedUserId);
    }
    
    // Action filter
    if (action && typeof action === 'string' && action.trim()) {
      query.action = action.trim();
    }
    
    // Handle date range
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate && typeof startDate === 'string') {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          dateQuery.$gte = start;
        }
      }
      if (endDate && typeof endDate === 'string') {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          // Set to end of day
          end.setHours(23, 59, 59, 999);
          dateQuery.$lte = end;
        }
      }
      // Only add createdAt if we have valid date filters
      if (dateQuery.$gte || dateQuery.$lte) {
        query.createdAt = dateQuery;
      }
    }

    // Device filter - prioritize deviceId over deviceName
    if (deviceId && typeof deviceId === 'string' && deviceId.trim()) {
      const trimmedDeviceId = deviceId.trim();
      if (!mongoose.Types.ObjectId.isValid(trimmedDeviceId)) {
        return res.status(400).json({ error: 'Invalid deviceId' });
      }
      // If specific deviceId is provided, use it directly
      query.device = new mongoose.Types.ObjectId(trimmedDeviceId);
    } else if (deviceName && typeof deviceName === 'string' && deviceName.trim()) {
      // Only use deviceName filter if deviceId is not provided
      const matchingDevices = await Device.find({ 
        name: { $regex: deviceName.trim(), $options: 'i' } 
      });
      const deviceIds = matchingDevices.map(d => d._id);
      if (deviceIds.length > 0) {
        query.device = { $in: deviceIds };
      } else {
        // No matching devices found, return empty result
        return res.json({
          history: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            pages: 0,
          }
        });
      }
    }

    const skip = (pageNum - 1) * limitNum;
    
    const [history, total] = await Promise.all([
      DeviceHistory.find(query)
        .populate('device', 'name')
        .populate('user', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      DeviceHistory.countDocuments(query)
    ]);

    res.json({
      history: history || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total || 0,
        pages: Math.ceil((total || 0) / limitNum),
      }
    });
  } catch (error) {
    console.error('Error fetching all history:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create a history entry (utility function for internal use)
 */
exports.logDeviceHistory = async (deviceId, userId, action, changes, reason = 'manual', metadata = {}) => {
  try {
    await DeviceHistory.create({
      device: deviceId,
      user: userId,
      action,
      changes,
      reason,
      metadata,
    });
  } catch (error) {
    console.error('Error logging device history:', error.message);
  }
};
