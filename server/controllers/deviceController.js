const Device = require('../models/Device');
const AccessKey = require('../models/AccessKey');
const VpnServer = require('../models/VpnServer');
const User = require('../models/User');
const WireGuardService = require('../services/WireGuardService');
const OutlineService = require('../services/OutlineService');
const ConfigGenerator = require('../utils/ConfigGenerator');
const { logActivity } = require('../middleware/auth');

/**
 * Factory function to get the appropriate VPN service
 */
function getVpnService(server) {
  if (server.vpnType === 'outline') {
    return new OutlineService(server);
  }
  return new WireGuardService(server);
}

/**
 * Create new device - supports both WireGuard and Outline
 */
exports.createDevice = async (req, res) => {
  try {
    const { serverId, name, planId, dataLimit, expiresAt } = req.body;
    const userId = req.userId;

    // Verify server exists - select hidden fields for Outline
    const server = await VpnServer.findById(serverId)
      .select('+outline.adminAccessKey +outline.ssh.privateKey');
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    console.log('[createDevice] Creating device on', server.vpnType, 'server:', server.name);

    // Check if user can create devices on this server
    const user = await User.findById(userId);
    if (!user.allowedServers.includes(serverId) && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied to this server' });
    }

    const vpnService = getVpnService(server);

    // Test connection
    try {
      const isHealthy = await vpnService.checkHealth();
      if (!isHealthy) {
        return res.status(400).json({ 
          error: `Cannot connect to ${server.vpnType} server` 
        });
      }
    } catch (error) {
      return res.status(400).json({ error: `Connection test failed: ${error.message}` });
    }

    if (server.vpnType === 'wireguard') {
      return await createWireGuardDevice(req, res, server, vpnService, userId, user);
    } else if (server.vpnType === 'outline') {
      return await createOutlineDevice(req, res, server, vpnService, userId, user);
    } else {
      return res.status(400).json({ error: 'Unsupported VPN type' });
    }
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create WireGuard device
 */
async function createWireGuardDevice(req, res, server, vpnService, userId, user) {
  const { name, planId, dataLimit, expiresAt } = req.body;

  try {
    // Generate key pair
    let keyPair;
    try {
      keyPair = await vpnService.generateKeyPair();
    } catch (error) {
      return res.status(500).json({ error: `Failed to generate keys: ${error.message}` });
    }

    // Get existing devices to find unused IP
    const existingDevices = await Device.find({ server: server._id });
    const existingIPs = existingDevices.map(d => d.vpnIp);

    // Assign VPN IP
    let vpnIp;
    try {
      vpnIp = await vpnService.assignVPNIP(existingIPs);
    } catch (error) {
      return res.status(500).json({ error: `Failed to assign IP: ${error.message}` });
    }

    // Create device record
    const device = new Device({
      name,
      user: userId,
      server: server._id,
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
      await vpnService.addPeer(device);
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
      message: 'WireGuard device created successfully',
      device,
    });
  } catch (error) {
    console.error('Error creating WireGuard device:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Create Outline device (access key)
 */
async function createOutlineDevice(req, res, server, vpnService, userId, user) {
  const { name, planId, dataLimit, expiresAt } = req.body;

  try {
    // Create access key on Outline server
    let accessKeyData;
    try {
      accessKeyData = await vpnService.addUser({
        name: name || `User-${Date.now()}`,
        limit: dataLimit || 0,
      });
    } catch (error) {
      return res.status(500).json({ error: `Failed to create access key: ${error.message}` });
    }

    // Create Device reference first (required for AccessKey)
    const device = new Device({
      name,
      user: userId,
      server: server._id,
      plan: planId || null,
      dataLimit: dataLimit ? { bytes: dataLimit, isEnabled: true } : null,
      isUnlimited: !dataLimit,
      expiresAt,
      status: 'ACTIVE',
      configFile: accessKeyData.accessUrl, // Store access URL as config
    });

    await device.save();

    // Create AccessKey document with device reference
    const accessKey = new AccessKey({
      server: server._id,
      user: userId,
      device: device._id,
      accessKeyId: accessKeyData.accessKeyId,
      accessUrl: accessKeyData.accessUrl,
      name: name || accessKeyData.name,
      dataLimit: dataLimit ? { bytes: dataLimit, isEnabled: true } : null,
      status: 'ACTIVE',
      expiresAt,
    });

    await accessKey.save();

    // Add to user's devices
    user.devices.push(device._id);
    await user.save();

    // Add to server's devices
    server.devices.push(device._id);
    server.stats.totalUsers += 1;
    await server.save();

    await logActivity(userId, 'CREATE_DEVICE', 'DEVICE', device._id, true);

    res.status(201).json({
      message: 'Outline access key created successfully',
      device,
      accessKey: {
        id: accessKey._id,
        url: accessKeyData.accessUrl,
        name: name || accessKeyData.name,
      },
    });
  } catch (error) {
    console.error('Error creating Outline device:', error);
    res.status(500).json({ error: error.message });
  }
}

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
      .populate('server', 'name host region vpnType')
      .populate('plan', 'name dataLimit')
      .populate('accessKey', 'accessKeyId accessUrl name')
      .sort({ createdAt: -1 });

    // For Outline devices without accessKey set, try to find and link them
    for (const device of devices) {
      if (device.server?.vpnType === 'outline' && !device.accessKey) {
        // Try to find the AccessKey by matching server
        const accessKey = await AccessKey.findOne({
          server: device.server._id,
          device: device._id,
        });
        
        if (accessKey) {
          device.accessKey = accessKey;
          await device.save();
          console.log(`[getDevices] Linked accessKey to device ${device.name}`);
        }
      }
    }

    // Refresh devices after potential linking
    const refreshedDevices = await Device.find(query)
      .populate('server', 'name host region vpnType')
      .populate('plan', 'name dataLimit')
      .populate('accessKey', 'accessKeyId accessUrl name')
      .sort({ createdAt: -1 });

    // For each Outline device, fetch usage from server
    const devicesWithUsage = await Promise.all(
      refreshedDevices.map(async (device) => {
        const deviceObj = device.toObject();
        
        // If it's an Outline device and has an accessKey, fetch usage from server
        if (device.server?.vpnType === 'outline' && device.accessKey?.accessKeyId) {
          try {
            console.log(`[getDevices] Fetching usage for Outline device ${device.name}, accessKeyId: ${device.accessKey.accessKeyId}`);
            
            const server = await VpnServer.findById(device.server._id)
              .select('+outline.adminAccessKey +outline.ssh.privateKey');
            
            if (server) {
              const vpnService = getVpnService(server);
              
              // Get metrics from Outline server
              const metricsData = await vpnService.makeRequest('GET', 'metrics/transfer');
              console.log(`[getDevices] Metrics data:`, metricsData);
              
              const bytesUsed = metricsData.bytesTransferredByUserId?.[device.accessKey.accessKeyId] || 0;
              console.log(`[getDevices] Bytes used for ${device.accessKey.accessKeyId}: ${bytesUsed}`);
              
              // Store the usage data
              deviceObj.usage = {
                bytesSent: 0,
                bytesReceived: bytesUsed,
                lastSync: new Date(),
              };
              deviceObj.totalBytesUsed = bytesUsed;
            }
          } catch (err) {
            console.error(`[getDevices] Failed to fetch usage for Outline device ${device._id}:`, err.message);
            // Keep existing usage data if fetch fails
          }
        } else if (device.server?.vpnType === 'outline') {
          console.warn(`[getDevices] Outline device ${device.name} missing accessKey:`, device.accessKey);
        }
        
        // Add limit source info for clarity
        const effectiveLimit = deviceObj.dataLimit?.bytes || deviceObj.plan?.dataLimit?.bytes;
        const limitSource = deviceObj.dataLimit?.bytes ? 'device-override' : 'plan-limit';
        deviceObj.limitInfo = {
          effectiveLimit,
          limitSource,
          hasDeviceOverride: !!deviceObj.dataLimit?.bytes,
          hasPlanLimit: !!deviceObj.plan?.dataLimit?.bytes,
        };
        
        return deviceObj;
      })
    );

    res.json({
      total: devicesWithUsage.length,
      devices: devicesWithUsage,
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
    if (device.user && device.user.toString() !== userId && user.role !== 'admin') {
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
    if (device.user && device.user.toString() !== userId && user.role !== 'admin') {
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
 * Delete device - handles both WireGuard and Outline
 */
exports.deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    const device = await Device.findById(deviceId).populate('server');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (device.user && device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const server = device.server;
    const vpnService = getVpnService(server);

    // Remove from VPN server based on type
    if (server.vpnType === 'wireguard') {
      try {
        await vpnService.removePeer(device.publicKey);
      } catch (error) {
        console.error('Failed to remove WireGuard peer:', error);
        // Continue with deletion even if peer removal fails
      }
    } else if (server.vpnType === 'outline') {
      // Remove access key from Outline server
      if (device.accessKey) {
        const accessKey = await AccessKey.findById(device.accessKey);
        if (accessKey) {
          try {
            await vpnService.removeUser(accessKey.accessKeyId);
          } catch (error) {
            console.error('Failed to remove Outline access key:', error);
            // Continue with deletion even if removal fails
          }
          // Delete AccessKey document
          await AccessKey.findByIdAndDelete(device.accessKey);
        }
      }
    }

    // Delete device from database
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
 * Toggle device status - handles both WireGuard and Outline
 */
exports.toggleDeviceStatus = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status, isEnabled } = req.body;
    const userId = req.userId;

    const device = await Device.findById(deviceId).populate('server');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (device.user && device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const server = device.server;
    const vpnService = getVpnService(server);

    if (status) {
      const validStatuses = ['ACTIVE', 'SUSPENDED', 'DISABLED', 'EXPIRED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      device.status = status;
    }

    if (isEnabled !== undefined) {
      device.isEnabled = isEnabled;
      
      // Handle enable/disable based on VPN type
      if (server.vpnType === 'wireguard') {
        if (!isEnabled) {
          // If disabling, remove peer temporarily
          try {
            await vpnService.removePeer(device.publicKey);
          } catch (error) {
            console.error('Failed to remove WireGuard peer:', error);
          }
        } else {
          // If enabling, add peer back
          try {
            await vpnService.addPeer(device);
          } catch (error) {
            console.error('Failed to add WireGuard peer:', error);
          }
        }
      } else if (server.vpnType === 'outline') {
        // For Outline, disable/enable is managed via status changes
        // Access keys remain in Outline, just change local status
        if (device.accessKey) {
          const accessKey = await AccessKey.findById(device.accessKey);
          if (accessKey) {
            accessKey.status = isEnabled ? 'ACTIVE' : 'DISABLED';
            await accessKey.save();
          }
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

    const device = await Device.findById(deviceId).populate('server').populate('accessKey');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization - allow if device user matches or is admin
    const user = await User.findById(userId);
    if (device.user && device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For Outline servers, return the access URL as config
    if (device.server.vpnType === 'outline') {
      const config = device.accessKey?.accessUrl || device.configFile;
      if (!config) {
        return res.status(400).json({ error: 'Access URL not available' });
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${device.name}-outline.txt"`);
      res.send(config);
    } else {
      // For WireGuard servers, generate or return stored config
      const config = device.configFile || ConfigGenerator.generateConfig(device, device.server);

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${device.name}.conf"`);
      res.send(config);
    }
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

    const device = await Device.findById(deviceId).populate('server').populate('accessKey');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization - allow if device user matches or is admin
    const user = await User.findById(userId);
    if (device.user && device.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // For Outline servers, return access URL as QR code
    if (device.server.vpnType === 'outline') {
      const accessUrl = device.accessKey?.accessUrl || device.configFile;
      if (!accessUrl) {
        return res.status(400).json({ error: 'Access URL not available' });
      }
      const qrCode = await ConfigGenerator.generateQRCode(accessUrl);
      res.json({ qrCode, config: accessUrl });
    } else {
      // For WireGuard servers, generate QR from config
      const config = device.configFile || ConfigGenerator.generateConfig(device, device.server);
      const qrCode = await ConfigGenerator.generateQRCode(config);
      res.json({ qrCode, config });
    }
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
