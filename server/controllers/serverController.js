const VpnServer = require('../models/VpnServer');
const Device = require('../models/Device');
const WireGuardService = require('../services/WireGuardService');
const { logActivity } = require('../middleware/auth');
const constants = require('../config/constants');

/**
 * Get all servers (admin only)
 */
exports.getAllServers = async (req, res) => {
  try {
    const { region, provider, isActive } = req.query;
    const query = {};

    if (region) query.region = region;
    if (provider) query.provider = provider;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const servers = await VpnServer.find(query)
      .populate('devices')
      .sort({ createdAt: -1 });

    res.json({
      total: servers.length,
      servers,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get user's accessible servers
 */
exports.getUserServers = async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId).populate('allowedServers');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      total: user.allowedServers.length,
      servers: user.allowedServers,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create new VPN server
 */
exports.createServer = async (req, res) => {
  try {
    const {
      name,
      description,
      host,
      port,
      region,
      country,
      city,
      provider,
      // WireGuard specific
      wireguardInterfaceName,
      wireguardVpnIpRange,
      wireguardPort,
      serverPublicKey,
      accessMethod,
      sshHost,
      sshPort,
      sshUsername,
      sshPassword,
      sshPrivateKey,
    } = req.body;

    // Create server with WireGuard config
    const server = new VpnServer({
      name,
      description,
      host,
      port: port || 51820,
      apiUrl: `https://${host}`, // Kept for backward compatibility
      region,
      country,
      city,
      provider,
      wireguard: {
        interfaceName: wireguardInterfaceName || 'wg0',
        vpnIpRange: wireguardVpnIpRange || '10.0.0.0/24',
        port: wireguardPort || 51820,
        accessMethod: accessMethod || 'local',
        ssh: accessMethod === 'ssh' ? {
          host: sshHost || host,
          port: sshPort || 22,
          username: sshUsername,
          password: sshPassword,
          privateKey: sshPrivateKey,
        } : {},
      },
    });

    // Test connection
    const wgService = new WireGuardService(server);
    const connectionTest = await wgService.testConnection();
    if (!connectionTest.success) {
      return res.status(400).json({
        error: `Cannot connect to server: ${connectionTest.error}`,
      });
    }

    // Set or obtain server public key
    if (serverPublicKey) {
      // Use the value provided from the panel (recommended)
      server.wireguard.serverPublicKey = serverPublicKey;
    } else {
      // Fallback: try to detect/generate on the server
      try {
        const detectedPublicKey = await wgService.getServerPublicKey();
        server.wireguard.serverPublicKey = detectedPublicKey;
      } catch (error) {
        // If server doesn't have keys yet, generate them
        const keyPair = await wgService.generateKeyPair();
        server.wireguard.serverPublicKey = keyPair.publicKey;
        server.wireguard.serverPrivateKey = keyPair.privateKey;
      }
    }

    await server.save();
    await logActivity(req.userId, 'ADD_SERVER', 'SERVER', server._id, true);

    res.status(201).json({
      message: 'Server created successfully',
      server,
    });
  } catch (error) {
    console.error('Error creating server:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get server details
 */
exports.getServer = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId).populate('devices');

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(server);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update server
 */
exports.updateServer = async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, description, region, country, city, provider } = req.body;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (name) server.name = name;
    if (description) server.description = description;
    if (region) server.region = region;
    if (country) server.country = country;
    if (city) server.city = city;
    if (provider) server.provider = provider;

    await server.save();
    await logActivity(req.userId, 'UPDATE_SERVER', 'SERVER', server._id, true);

    res.json({
      message: 'Server updated successfully',
      server,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete server
 */
exports.deleteServer = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Delete all associated devices
    await Device.deleteMany({ server: serverId });

    await VpnServer.findByIdAndDelete(serverId);
    await logActivity(req.userId, 'REMOVE_SERVER', 'SERVER', serverId, true);

    res.json({ message: 'Server deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get server metrics
 */
exports.getServerMetrics = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const wgService = new WireGuardService(server);
    try {
      const status = await wgService.getServerStatus();
      const devices = await Device.find({ server: serverId });
      
      const totalUsage = devices.reduce((sum, device) => {
        return sum + (device.usage.bytesSent || 0) + (device.usage.bytesReceived || 0);
      }, 0);

      res.json({
        status,
        totalDevices: devices.length,
        activeDevices: devices.filter(d => d.isEnabled && d.status === 'ACTIVE').length,
        totalUsage,
      });
    } catch (error) {
      res.status(500).json({ error: `Failed to fetch metrics: ${error.message}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Health check server
 */
exports.healthCheckServer = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const wgService = new WireGuardService(server);
    const health = await wgService.healthCheck();

    // Update server health status
    server.stats.isHealthy = health.healthy;
    server.stats.lastHealthCheck = new Date();
    await server.save();

    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all devices on server
 */
exports.getServerDevices = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const devices = await Device.find({ server: serverId })
      .populate('user', 'username email')
      .populate('plan', 'name');

    res.json({
      total: devices.length,
      devices,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get WireGuard server status
 */
exports.getWireGuardStatus = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const wgService = new WireGuardService(server);
    const status = await wgService.getServerStatus();

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
