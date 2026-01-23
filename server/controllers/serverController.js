const VpnServer = require('../models/VpnServer');
const Device = require('../models/Device');
const AccessKey = require('../models/AccessKey');
const WireGuardService = require('../services/WireGuardService');
const OutlineService = require('../services/OutlineService');
const { logActivity } = require('../middleware/auth');
const constants = require('../config/constants');

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
 * Get all servers (admin only) - with optional type filter
 */
exports.getAllServers = async (req, res) => {
  try {
    const { region, provider, isActive, vpnType } = req.query;
    const query = {};

    if (region) query.region = region;
    if (provider) query.provider = provider;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (vpnType) query.vpnType = vpnType; // Filter by VPN type

    const servers = await VpnServer.find(query)
      .populate('devices')
      .sort({ createdAt: -1 });

    // Calculate bandwidth usage for each server
    // Note: This shows total cumulative usage from all devices on the server
    // Since we don't have historical tracking per time period, this represents
    // total usage since devices were created (or last reset)
    // Usage data is updated every 5 minutes by cron jobs
    const serversWithUsage = await Promise.all(
      servers.map(async (server) => {
        const serverObj = server.toObject();
        
        // Get all devices on this server
        const devices = await Device.find({ server: server._id });
        
        // Calculate total bandwidth usage from all devices
        let totalBandwidth = 0;
        for (const device of devices) {
          // For Outline devices, use totalBytesUsed if available, otherwise sum sent+received
          if (server.vpnType === 'outline' && device.totalBytesUsed !== undefined) {
            totalBandwidth += device.totalBytesUsed || 0;
          } else {
            // For WireGuard or devices without totalBytesUsed
            totalBandwidth += (device.usage?.bytesSent || 0) + (device.usage?.bytesReceived || 0);
          }
        }
        
        // Add bandwidth usage to server object
        serverObj.bandwidthUsage30Days = totalBandwidth;
        serverObj.bandwidthUsageFormatted = formatBytes(totalBandwidth);
        
        return serverObj;
      })
    );

    res.json({
      total: serversWithUsage.length,
      servers: serversWithUsage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Helper function to format bytes
 */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

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
 * Create new VPN server (WireGuard or Outline)
 */
exports.createServer = async (req, res) => {
  try {
    const {
      name,
      description,
      host,
      port,
      vpnType = 'wireguard',
      serverType = 'REGULAR',
      region,
      country,
      city,
      provider,
      // WireGuard specific
      wireguardInterfaceName,
      wireguardVpnIpRange,
      wireguardPort,
      serverPublicKey,
      wireguardAccessMethod,
      sshHost,
      sshPort,
      sshUsername,
      sshPassword,
      sshPrivateKey,
      // Outline specific
      outlineApiPort,
      outlineAdminAccessKey,
      outlineAccessKeyPort,
      outlineCertSha256,
      outlineAccessMethod,
    } = req.body;

    // Validate VPN type
    if (!['wireguard', 'outline'].includes(vpnType)) {
      return res.status(400).json({ error: 'Invalid vpnType. Must be "wireguard" or "outline"' });
    }

    // Validate required Outline fields
    if (vpnType === 'outline' && !outlineAdminAccessKey) {
      return res.status(400).json({ error: 'Admin access key is required for Outline servers' });
    }

    let serverData = {
      name,
      description,
      host,
      port: port || (vpnType === 'wireguard' ? 51820 : 443),
      vpnType,
      serverType,
      apiUrl: `https://${host}`,
      region,
      country,
      city,
      provider,
    };

    // Configure based on VPN type
    if (vpnType === 'wireguard') {
      serverData.wireguard = {
        interfaceName: wireguardInterfaceName || 'wg0',
        vpnIpRange: wireguardVpnIpRange || '10.0.0.0/24',
        port: wireguardPort || 51820,
        accessMethod: wireguardAccessMethod || 'local',
        ssh: wireguardAccessMethod === 'ssh' ? {
          host: sshHost || host,
          port: sshPort || 22,
          username: sshUsername,
          password: sshPassword,
          privateKey: sshPrivateKey,
        } : {},
      };
    } else if (vpnType === 'outline') {
      serverData.outline = {
        apiBaseUrl: host,
        apiPort: outlineApiPort || 8081,
        adminAccessKey: outlineAdminAccessKey,
        accessKeyPort: outlineAccessKeyPort || 8388,
        certSha256: outlineCertSha256,
        accessMethod: outlineAccessMethod || 'api',
        ssh: outlineAccessMethod === 'ssh' ? {
          host: sshHost || host,
          port: sshPort || 22,
          username: sshUsername,
          password: sshPassword,
          privateKey: sshPrivateKey,
        } : {},
      };
    }

    const server = new VpnServer(serverData);

    // Test connection using appropriate service
    const vpnService = getVpnService(server);
    
    try {
      const isHealthy = await vpnService.checkHealth();
      if (!isHealthy) {
        return res.status(400).json({
          error: `Cannot connect to ${vpnType} server. Please verify the connection details.`,
        });
      }
    } catch (error) {
      return res.status(400).json({
        error: `Connection test failed: ${error.message}`,
      });
    }

    // Initialize server
    try {
      const initResult = await vpnService.initialize();
      server.stats.isHealthy = true;
    } catch (error) {
      console.warn(`Server initialization warning: ${error.message}`);
    }

    await server.save();
    await logActivity(req.userId, 'ADD_SERVER', 'SERVER', server._id, true);

    res.status(201).json({
      message: `${vpnType.toUpperCase()} server created successfully`,
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

    const server = await VpnServer.findById(serverId)
      .select('+outline.adminAccessKey +outline.ssh.privateKey')
      .populate('devices');

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
    const { name, description, serverType, region, country, city, provider } = req.body;

    const server = await VpnServer.findById(serverId)
      .select('+outline.adminAccessKey +outline.ssh.privateKey');
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (name) server.name = name;
    if (description) server.description = description;
    if (region) server.region = region;
    if (country) server.country = country;
    if (city) server.city = city;
    if (provider) server.provider = provider;
    if (serverType) server.serverType = serverType;

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
 * Get server metrics (type-agnostic)
 */
exports.getServerMetrics = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const vpnService = getVpnService(server);
    try {
      const stats = await vpnService.getServerStats();
      
      // Get associated devices/keys based on VPN type
      let dataPoints;
      if (server.vpnType === 'outline') {
        dataPoints = await AccessKey.find({ server: serverId });
      } else {
        dataPoints = await Device.find({ server: serverId });
      }

      res.json({
        vpnType: server.vpnType,
        stats,
        totalItems: dataPoints.length,
        activeItems: dataPoints.filter(d => d.status === 'ACTIVE').length,
      });
    } catch (error) {
      res.status(500).json({ error: `Failed to fetch metrics: ${error.message}` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Health check server (type-agnostic)
 */
exports.healthCheckServer = async (req, res) => {
  try {
    const { serverId } = req.params;

    // Load server with admin keys for Outline
    const server = await VpnServer.findById(serverId)
      .select('+outline.adminAccessKey +outline.ssh.privateKey +wireguard.ssh.privateKey');
    
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const vpnService = getVpnService(server);
    const isHealthy = await vpnService.checkHealth();

    // Update server health status
    server.stats.isHealthy = isHealthy;
    server.stats.lastHealthCheck = new Date();
    await server.save();

    res.json({
      vpnType: server.vpnType,
      isHealthy,
      lastCheck: server.stats.lastHealthCheck,
      message: isHealthy ? 'Server is healthy' : 'Server is not responding',
    });
  } catch (error) {
    console.error('[healthCheckServer] Error:', error);
    res.status(500).json({ 
      error: error.message,
      isHealthy: false,
    });
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
 * Get server status (type-specific details)
 */
exports.getWireGuardStatus = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Only WireGuard has detailed peer status
    if (server.vpnType !== 'wireguard') {
      return res.status(400).json({ 
        error: `Detailed status not available for ${server.vpnType} servers` 
      });
    }

    const wgService = new WireGuardService(server);
    const status = await wgService.getServerStatus();

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get Outline server details (Outline-specific)
 */
exports.getOutlineStatus = async (req, res) => {
  try {
    const { serverId } = req.params;

    const server = await VpnServer.findById(serverId);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Only Outline has Outline-specific status
    if (server.vpnType !== 'outline') {
      return res.status(400).json({ 
        error: 'This endpoint is for Outline servers only' 
      });
    }

    const outlineService = new OutlineService(server);
    const info = await outlineService.getServerInfo();

    res.json({
      vpnType: 'outline',
      serverId: info.id,
      version: info.version,
      accessKeys: info.accessKeys?.map(key => ({
        id: key.id,
        name: key.name,
        used: key.used_by?.bytes || 0,
        dataLimit: key.dataLimit || null,
      })) || [],
      portForNewAccessKeys: info.portForNewAccessKeys,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Sync Outline access keys from server to database
 */
exports.syncOutlineAccessKeys = async (req, res) => {
  try {
    const { serverId } = req.params;
    const userId = req.userId;

    const server = await VpnServer.findById(serverId)
      .select('+outline.adminAccessKey +outline.ssh.privateKey');
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    console.log('[syncOutlineAccessKeys] Server type:', server.vpnType);
    console.log('[syncOutlineAccessKeys] Outline config:', {
      apiBaseUrl: server.outline?.apiBaseUrl,
      apiPort: server.outline?.apiPort,
      adminAccessKey: server.outline?.adminAccessKey ? 'SET' : 'MISSING',
    });

    if (server.vpnType !== 'outline') {
      return res.status(400).json({ error: 'This server is not an Outline server' });
    }

    const vpnService = getVpnService(server);
    console.log('[syncOutlineAccessKeys] VPN Service created:', {
      baseUrl: vpnService.baseUrl,
      apiPort: vpnService.apiPort,
      adminAccessKey: vpnService.adminAccessKey ? 'SET' : 'MISSING',
    });

    try {
      // Get all access keys from server
      const accessKeysResponse = await vpnService.makeRequest('GET', 'access-keys');
      const accessKeys = accessKeysResponse.accessKeys || [];

      // Ensure indexes are properly configured before syncing
      try {
        await Device.collection.dropIndex('publicKey_1').catch(() => {});
        await Device.syncIndexes();
      } catch (err) {
        console.warn('Could not sync Device indexes:', err.message);
      }

      // Drop old unique index on AccessKey if it exists
      try {
        await AccessKey.collection.dropIndex('accessKeyId_1').catch(() => {});
        await AccessKey.syncIndexes();
      } catch (err) {
        console.warn('Could not sync AccessKey indexes:', err.message);
      }

      let syncedCount = 0;
      let skippedCount = 0;

      // Sync each access key
      for (const remoteKey of accessKeys) {
        // Check if already exists in DB
        const existingAccessKey = await AccessKey.findOne({
          server: serverId,
          accessKeyId: remoteKey.id,
        });

        if (!existingAccessKey) {
          // Create Device reference first (required for AccessKey)
          const device = new Device({
            name: remoteKey.name || `Access Key ${remoteKey.id}`,
            server: serverId,
            dataLimit: remoteKey.dataLimit || null,
            isUnlimited: !remoteKey.dataLimit,
            status: 'ACTIVE',
            configFile: remoteKey.accessUrl,
          });

          await device.save();

          // Create new AccessKey record with device reference
          const accessKey = new AccessKey({
            server: serverId,
            user: null, // Not assigned to a user yet
            device: device._id,
            accessKeyId: remoteKey.id,
            accessUrl: remoteKey.accessUrl,
            name: remoteKey.name || `Access Key ${remoteKey.id}`,
            dataLimit: remoteKey.dataLimit || null,
            status: 'ACTIVE',
          });

          await accessKey.save();
          syncedCount++;
        } else {
          skippedCount++;
        }
      }

      // Update server stats
      server.stats.totalUsers = accessKeys.length;
      await server.save();

      await logActivity(userId, 'SYNC_OUTLINE', 'SERVER', serverId, true);

      res.json({
        message: 'Outline access keys synced successfully',
        synced: syncedCount,
        skipped: skippedCount,
        total: accessKeys.length,
      });
    } catch (error) {
      return res.status(400).json({
        error: `Failed to sync access keys: ${error.message}`,
      });
    }
  } catch (error) {
    console.error('Error syncing outline keys:', error);
    res.status(500).json({ error: error.message });
  }
};
