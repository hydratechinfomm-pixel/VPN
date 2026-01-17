const AccessKey = require('../models/AccessKey');
const VpnServer = require('../models/VpnServer');
const User = require('../models/User');
const OutlineServerService = require('../services/OutlineServerService');
const { logActivity } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

/**
 * Create new access key
 */
exports.createAccessKey = async (req, res) => {
  try {
    const { serverId, name, dataLimit, expiresAt } = req.body;
    const userId = req.userId;

    // Verify server exists
    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Check if user can create keys on this server
    const user = await User.findById(userId);
    if (!user.allowedServers.includes(serverId) && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied to this server' });
    }

    // Create key on Outline server
    const outlineService = new OutlineServerService(server);
    let outlineKey;
    try {
      outlineKey = await outlineService.createAccessKey(name, dataLimit);
    } catch (error) {
      return res.status(500).json({ error: `Failed to create key on server: ${error.message}` });
    }

    // Save to database
    const accessKey = new AccessKey({
      keyId: outlineKey.id || uuidv4(),
      user: userId,
      server: serverId,
      name,
      accessUrl: outlineKey.accessUrl,
      port: outlineKey.port,
      method: outlineKey.method,
      password: outlineKey.password,
      dataLimit: dataLimit ? { bytes: dataLimit, isEnabled: true } : null,
      expiresAt,
      isUnlimited: !dataLimit,
    });

    await accessKey.save();

    // Add to user's access keys
    user.accessKeys.push(accessKey._id);
    await user.save();

    // Add to server's access keys
    server.accessKeys.push(accessKey._id);
    server.stats.totalUsers += 1;
    await server.save();

    await logActivity(userId, 'CREATE_KEY', 'ACCESS_KEY', accessKey._id, true);

    res.status(201).json({
      message: 'Access key created successfully',
      accessKey,
    });
  } catch (error) {
    console.error('Error creating access key:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all access keys for user
 */
exports.getAccessKeys = async (req, res) => {
  try {
    const { serverId, status } = req.query;
    const userId = req.userId;

    const query = { user: userId };
    if (serverId) query.server = serverId;
    if (status) query.status = status;

    const accessKeys = await AccessKey.find(query)
      .populate('server', 'name host region')
      .sort({ createdAt: -1 });

    res.json({
      total: accessKeys.length,
      accessKeys,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get single access key
 */
exports.getAccessKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const userId = req.userId;

    const accessKey = await AccessKey.findById(keyId).populate('server');

    if (!accessKey) {
      return res.status(404).json({ error: 'Access key not found' });
    }

    // Check authorization
    if (accessKey.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(accessKey);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update access key
 */
exports.updateAccessKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const { name, dataLimit, expiresAt } = req.body;
    const userId = req.userId;

    const accessKey = await AccessKey.findById(keyId);
    if (!accessKey) {
      return res.status(404).json({ error: 'Access key not found' });
    }

    // Check authorization
    if (accessKey.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const server = await VpnServer.findById(accessKey.server);
    const outlineService = new OutlineServerService(server);

    // Update on Outline server if name changed
    if (name && name !== accessKey.name) {
      try {
        await outlineService.renameAccessKey(accessKey.keyId, name);
      } catch (error) {
        return res.status(500).json({ error: `Failed to rename key on server: ${error.message}` });
      }
    }

    // Update data limit if provided
    if (dataLimit !== undefined) {
      try {
        if (dataLimit) {
          await outlineService.setDataLimit(accessKey.keyId, dataLimit);
          accessKey.dataLimit = { bytes: dataLimit, isEnabled: true };
          accessKey.isUnlimited = false;
        } else {
          await outlineService.removeDataLimit(accessKey.keyId);
          accessKey.isUnlimited = true;
        }
      } catch (error) {
        return res.status(500).json({ error: `Failed to update data limit: ${error.message}` });
      }
    }

    if (name) accessKey.name = name;
    if (expiresAt) accessKey.expiresAt = expiresAt;

    await accessKey.save();
    await logActivity(userId, 'UPDATE_KEY', 'ACCESS_KEY', accessKey._id, true);

    res.json({
      message: 'Access key updated successfully',
      accessKey,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete access key
 */
exports.deleteAccessKey = async (req, res) => {
  try {
    const { keyId } = req.params;
    const userId = req.userId;

    const accessKey = await AccessKey.findById(keyId);
    if (!accessKey) {
      return res.status(404).json({ error: 'Access key not found' });
    }

    // Check authorization
    if (accessKey.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const server = await VpnServer.findById(accessKey.server);
    const outlineService = new OutlineServerService(server);

    // Delete from Outline server
    try {
      await outlineService.deleteAccessKey(accessKey.keyId);
    } catch (error) {
      return res.status(500).json({ error: `Failed to delete key from server: ${error.message}` });
    }

    // Delete from database
    await AccessKey.findByIdAndDelete(keyId);

    // Update server stats
    server.accessKeys = server.accessKeys.filter(id => id.toString() !== keyId);
    server.stats.totalUsers = Math.max(0, server.stats.totalUsers - 1);
    await server.save();

    // Update user
    const user = await User.findById(userId);
    user.accessKeys = user.accessKeys.filter(id => id.toString() !== keyId);
    await user.save();

    await logActivity(userId, 'DELETE_KEY', 'ACCESS_KEY', keyId, true);

    res.json({ message: 'Access key deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Suspend/Resume access key
 */
exports.toggleAccessKeyStatus = async (req, res) => {
  try {
    const { keyId } = req.params;
    const { status } = req.body;
    const userId = req.userId;

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'DISABLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const accessKey = await AccessKey.findById(keyId);
    if (!accessKey) {
      return res.status(404).json({ error: 'Access key not found' });
    }

    // Check authorization
    if (accessKey.user.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    accessKey.status = status;
    await accessKey.save();

    await logActivity(userId, 'SUSPEND_KEY', 'ACCESS_KEY', accessKey._id, true);

    res.json({
      message: 'Access key status updated',
      accessKey,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
