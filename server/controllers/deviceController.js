const Device = require('../models/Device');
const VpnServer = require('../models/VpnServer');
const User = require('../models/User');
const WireGuardService = require('../services/WireGuardService');
const ConfigGenerator = require('../utils/ConfigGenerator');
const { logActivity } = require('../middleware/auth');

/**
 * Create new device
 */
exports.createDevice = async (req, res) => {
  try {
    const { serverId, name, planId, dataLimit, expiresAt } = req.body;
    const userId = req.userId;

    // Verify server exists
    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Check if user can create devices on this server
    const user = await User.findById(userId);
    if (!user.allowedServers.includes(serverId) && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied to this server' });
    }

    // Initialize WireGuard service
    const wgService = new WireGuardService(server);

    // Test connection
    const connectionTest = await wgService.testConnection();
    if (!connectionTest.success) {
      return res.status(400).json({ 
        error: `Cannot connect to server: ${connectionTest.error}` 
      });
    }

    // Generate key pair
    let keyPair;
    try {
      keyPair = await wgService.generateKeyPair();
    } catch (error) {
      return res.status(500).json({ error: `Failed to generate keys: ${error.message}` });
    }

    // Get existing devices to find unused IP
    const existingDevices = await Device.find({ server: serverId });
    const existingIPs = existingDevices.map(d => d.vpnIp);

    // Assign VPN IP
    let vpnIp;
    try {
      vpnIp = await wgService.assignVPNIP(existingIPs);
    } catch (error) {
      return res.status(500).json({ error: `Failed to assign IP: ${error.message}` });
    }

    // Create device record
    const device = new Device({
      name,
      user: userId,
      server: serverId,
      plan: planId || null,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      vpnIp,
      dataLimit: dataLimit ? { bytes: dataLimit, isEnabled: true } : null,
      isUnlimited: !dataLimit,
      expiresAt,
    });

    // Add peer to WireGuard
    try {
      await wgService.addPeer(device);
    } catch (error) {
      return res.status(500).json({ error: `Failed to add peer to WireGuard: ${error.message}` });
    }

    // Generate config
    const config = ConfigGenerator.generateConfig(device, server);
    device.configFile = config;

    await device.save();

    // Add to user's devices
    user.devices.push(device._id);
    await user.save();

    // Add to server's devices
    server.devices.push(device._id);
    server.stats.totalUsers += 1;
    await server.save();

    await logActivity(userId, 'CREATE_DEVICE', 'DEVICE', device._id, true);

    res.status(201).json({
      message: 'Device created successfully',
      device,
    });
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all devices for user
 */
exports.getDevices = async (req, res) => {
  try {
    const { serverId, status } = req.query;
    const userId = req.userId;
    const user = await User.findById(userId);

    const query = { user: userId };
    if (serverId) query.server = serverId;
    if (status) query.status = status;

    // Admin can see all devices
    if (user.role === 'admin') {
      delete query.user;
    }

    const devices = await Device.find(query)
      .populate('server', 'name host region')
      .populate('plan', 'name dataLimit')
      .sort({ createdAt: -1 });

    res.json({
      total: devices.length,
      devices,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get single device
 */
exports.getDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    const device = await Device.findById(deviceId)
      .populate('server')
      .populate('plan');

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(device);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update device
 */
exports.updateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { name, planId, dataLimit, expiresAt } = req.body;
    const userId = req.userId;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (name) device.name = name;
    if (planId !== undefined) device.plan = planId;
    if (expiresAt) device.expiresAt = expiresAt;

    // Update data limit
    if (dataLimit !== undefined) {
      if (dataLimit) {
        device.dataLimit = { bytes: dataLimit, isEnabled: true };
        device.isUnlimited = false;
      } else {
        device.isUnlimited = true;
        device.dataLimit = { isEnabled: false };
      }
    }

    await device.save();
    await logActivity(userId, 'UPDATE_DEVICE', 'DEVICE', device._id, true);

    res.json({
      message: 'Device updated successfully',
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete device
 */
exports.deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const server = await VpnServer.findById(device.server);
    const wgService = new WireGuardService(server);

    // Remove peer from WireGuard
    try {
      await wgService.removePeer(device.publicKey);
    } catch (error) {
      console.error('Failed to remove peer from WireGuard:', error);
      // Continue with deletion even if peer removal fails
    }

    // Delete from database
    await Device.findByIdAndDelete(deviceId);

    // Update server stats
    server.devices = server.devices.filter(id => id.toString() !== deviceId);
    server.stats.totalUsers = Math.max(0, server.stats.totalUsers - 1);
    await server.save();

    // Update user
    const deviceUser = await User.findById(device.user);
    deviceUser.devices = deviceUser.devices.filter(id => id.toString() !== deviceId);
    await deviceUser.save();

    await logActivity(userId, 'DELETE_DEVICE', 'DEVICE', deviceId, true);

    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Toggle device status
 */
exports.toggleDeviceStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status, isEnabled } = req.body;
    const userId = req.userId;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (status) {
      const validStatuses = ['ACTIVE', 'SUSPENDED', 'DISABLED', 'EXPIRED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      device.status = status;
    }

    if (isEnabled !== undefined) {
      device.isEnabled = isEnabled;
      
      // If disabling, remove peer temporarily
      if (!isEnabled) {
        const server = await VpnServer.findById(device.server);
        const wgService = new WireGuardService(server);
        try {
          await wgService.removePeer(device.publicKey);
        } catch (error) {
          console.error('Failed to remove peer:', error);
        }
      } else {
        // If enabling, add peer back
        const server = await VpnServer.findById(device.server);
        const wgService = new WireGuardService(server);
        try {
          await wgService.addPeer(device);
        } catch (error) {
          console.error('Failed to add peer:', error);
        }
      }
    }

    await device.save();
    await logActivity(userId, 'TOGGLE_DEVICE', 'DEVICE', device._id, true);

    res.json({
      message: 'Device status updated',
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get device config file
 */
exports.getDeviceConfig = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    const device = await Device.findById(deviceId).populate('server');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const config = device.configFile || ConfigGenerator.generateConfig(device, device.server);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${device.name}.conf"`);
    res.send(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get device QR code
 */
exports.getDeviceQR = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    const device = await Device.findById(deviceId).populate('server');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const config = device.configFile || ConfigGenerator.generateConfig(device, device.server);
    const qrCode = await ConfigGenerator.generateQRCode(config);

    res.json({ qrCode, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Force disconnect device
 */
exports.disconnectDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization (admin only)
    const user = await User.findById(userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const server = await VpnServer.findById(device.server);
    const wgService = new WireGuardService(server);

    // Remove peer
    try {
      await wgService.removePeer(device.publicKey);
      device.isEnabled = false;
      device.connectivity.isConnected = false;
      await device.save();

      await logActivity(userId, 'DISCONNECT_DEVICE', 'DEVICE', device._id, true);

      res.json({ message: 'Device disconnected successfully' });
    } catch (error) {
      res.status(500).json({ error: `Failed to disconnect device: ${error.message}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
