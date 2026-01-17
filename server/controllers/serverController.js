const VpnServer = require('../models/VpnServer');
const AccessKey = require('../models/AccessKey');
const OutlineServerService = require('../services/OutlineServerService');
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
      .populate('accessKeys', '-password')
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
      apiUrl,
      region,
      country,
      city,
      provider,
      apiToken,
    } = req.body;

    // Validate server connectivity
    const testServer = new VpnServer({
      name,
      host,
      port,
      apiUrl,
      credentials: { apiToken },
    });

    const outlineService = new OutlineServerService(testServer);
    try {
      const serverInfo = await outlineService.getServerInfo();
      testServer.stats.isHealthy = true;
    } catch (error) {
      return res.status(400).json({
        error: `Cannot connect to server: ${error.message}`,
      });
    }

    // Create server
    const server = new VpnServer({
      name,
      description,
      host,
      port,
      apiUrl,
      region,
      country,
      city,
      provider,
      credentials: {
        apiToken,
      },
    });

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

    const server = await VpnServer.findById(serverId).populate(
      'accessKeys',
      '-password'
    );

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

    // Delete all associated access keys
    await AccessKey.deleteMany({ server: serverId });

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

    const outlineService = new OutlineServerService(server);
    try {
      const metrics = await outlineService.getMetrics();
      res.json(metrics);
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

    const outlineService = new OutlineServerService(server);
    const health = await outlineService.healthCheck();

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
 * Get all access keys on server
 */
exports.getServerAccessKeys = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const accessKeys = await AccessKey.find({ server: serverId })
      .populate('user', 'username email');

    res.json({
      total: accessKeys.length,
      accessKeys,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
