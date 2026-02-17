const Device = require('../models/Device');
const AccessKey = require('../models/AccessKey');
const V2rayUser = require('../models/V2rayUser');
const VpnServer = require('../models/VpnServer');
const User = require('../models/User');
const DeviceHistory = require('../models/DeviceHistory');
const SalesTransaction = require('../models/SalesTransaction');
const Plan = require('../models/Plan');
const mongoose = require('mongoose');
const WireGuardService = require('../services/WireGuardService');
const OutlineService = require('../services/OutlineService');
const V2rayService = require('../services/V2rayService');
const SSHExecutor = require('../utils/SSHExecutor');
const ConfigGenerator = require('../utils/ConfigGenerator');
const { logActivity } = require('../middleware/auth');

/**
 * Factory function to get the appropriate VPN service
 */
function getVpnService(server) {
  if (server.vpnType === 'outline') {
    return new OutlineService(server);
  }
  if (server.vpnType === 'v2ray') {
    return new V2rayService(server);
  }
  return new WireGuardService(server);
}

/**
 * Create new device - supports both WireGuard and Outline
 */
exports.createDevice = async (req, res) => {
  try {
    const { serverId, name, planId, dataLimit, expiresAt, userId: assignedUserId } = req.body;
    const requesterId = req.userId;

    // Verify server exists - select hidden fields for Outline
    const server = await VpnServer.findById(serverId)
      .select('+outline.adminAccessKey +outline.ssh.privateKey +v2ray.ssh.privateKey');
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    console.log('[createDevice] Creating device on', server.vpnType, 'server:', server.name);

    // Check if requester can create devices on this server
    const requester = await User.findById(requesterId);
    const isAdmin = requester.role?.toLowerCase() === 'admin';
    const isstaff = requester.role?.toLowerCase() === 'staff';

    // Server access control:
    // - Admin: can create on any server
    // - Staff (staff) + regular users: can only create on servers assigned in allowedServers
    const hasServerAccess = Array.isArray(requester.allowedServers)
      && requester.allowedServers.some((id) => String(id) === String(serverId));

    if (!isAdmin && !hasServerAccess) {
      return res.status(403).json({ error: 'Access denied to this server' });
    }

    // Determine which user to assign the device to
    // If assignedUserId is provided (and requester is admin/staff), use it
    // Otherwise assign to the requester
    let deviceOwnerId = requesterId;
    if (assignedUserId && (isAdmin || isstaff)) {
      // Verify the assigned user exists
      const assignedUser = await User.findById(assignedUserId);
      if (!assignedUser) {
        return res.status(404).json({ error: 'Assigned user not found' });
      }
      deviceOwnerId = assignedUserId;
    } else if (assignedUserId && !isAdmin && !isstaff) {
      return res.status(403).json({ error: 'Only admins and staffs can assign devices to other users' });
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
      return await createWireGuardDevice(req, res, server, vpnService, requesterId, deviceOwnerId, requester);
    } else if (server.vpnType === 'outline') {
      return await createOutlineDevice(req, res, server, vpnService, requesterId, deviceOwnerId, requester);
    } else if (server.vpnType === 'v2ray') {
      return await createV2rayDevice(req, res, server, vpnService, requesterId, deviceOwnerId, requester);
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
async function createWireGuardDevice(req, res, server, vpnService, requesterId, deviceOwnerId, requester) {
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
      user: deviceOwnerId || null,
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

    // Add to device owner's devices if assigned
    let deviceOwnerUsername = undefined;
    if (deviceOwnerId) {
      const deviceOwner = await User.findById(deviceOwnerId);
      if (deviceOwner) {
        deviceOwnerUsername = deviceOwner.username;
        deviceOwner.devices.push(device._id);
        await deviceOwner.save();
      }
    }

    // Add to server's devices
    server.devices.push(device._id);
    server.stats.totalUsers += 1;
    await server.save();

    // Record sale transaction (only when plan is selected)
    if (planId) {
      try {
        const plan = await Plan.findById(planId);
        if (plan) {
          await SalesTransaction.create({
            deviceId: device._id,
            deviceName: device.name,
            plan: plan._id,
            planName: plan.name,
            planPrice: plan.price || 0,
            planCurrency: plan.currency || 'USD',
            planBillingCycle: plan.billingCycle,
            server: server._id,
            serverName: server.name,
            serverType: server.serverType,
            user: deviceOwnerId || null,
            userName: deviceOwnerUsername,
            createdBy: requesterId,
            createdByName: requester?.username,
            expiresAt: device.expiresAt,
            metadata: {
              deviceStatus: device.status,
            },
          });
        }
      } catch (e) {
        console.error('[SalesTransaction] Failed to record sale:', e.message);
      }
    }

    await logActivity(requesterId, 'CREATE_DEVICE', 'DEVICE', device._id, true);

    // Log device history
    await DeviceHistory.create({
      device: device._id,
      user: requesterId,
      action: 'CREATED',
      reason: 'manual',
      metadata: {
        notes: `WireGuard device created on server ${server.name}${deviceOwnerId && deviceOwnerId !== requesterId ? ` and assigned to user ${deviceOwnerId}` : ''}`,
      },
    });

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
async function createOutlineDevice(req, res, server, vpnService, requesterId, deviceOwnerId, requester) {
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
      user: deviceOwnerId || null,
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
      user: deviceOwnerId || null,
      device: device._id,
      accessKeyId: accessKeyData.accessKeyId,
      accessUrl: accessKeyData.accessUrl,
      name: name || accessKeyData.name,
      dataLimit: dataLimit ? { bytes: dataLimit, isEnabled: true } : null,
      status: 'ACTIVE',
      expiresAt,
    });

    await accessKey.save();

    // Link device to access key
    device.accessKey = accessKey._id;
    await device.save();

    // Add to device owner's devices if assigned
    let deviceOwnerUsername = undefined;
    if (deviceOwnerId) {
      const deviceOwner = await User.findById(deviceOwnerId);
      if (deviceOwner) {
        deviceOwnerUsername = deviceOwner.username;
        deviceOwner.devices.push(device._id);
        await deviceOwner.save();
      }
    }

    // Add to server's devices
    server.devices.push(device._id);
    server.stats.totalUsers += 1;
    await server.save();

    // Record sale transaction (only when plan is selected)
    if (planId) {
      try {
        const plan = await Plan.findById(planId);
        if (plan) {
          await SalesTransaction.create({
            deviceId: device._id,
            deviceName: device.name,
            plan: plan._id,
            planName: plan.name,
            planPrice: plan.price || 0,
            planCurrency: plan.currency || 'USD',
            planBillingCycle: plan.billingCycle,
            server: server._id,
            serverName: server.name,
            serverType: server.serverType,
            user: deviceOwnerId || null,
            userName: deviceOwnerUsername,
            createdBy: requesterId,
            createdByName: requester?.username,
            expiresAt: device.expiresAt,
            metadata: {
              deviceStatus: device.status,
            },
          });
        }
      } catch (e) {
        console.error('[SalesTransaction] Failed to record sale:', e.message);
      }
    }

    await logActivity(requesterId, 'CREATE_DEVICE', 'DEVICE', device._id, true);

    // Log device history
    await DeviceHistory.create({
      device: device._id,
      user: requesterId,
      action: 'CREATED',
      reason: 'manual',
      metadata: {
        notes: `Outline device created on server ${server.name}${deviceOwnerId && deviceOwnerId !== requesterId ? ` and assigned to user ${deviceOwnerId}` : ''}`,
      },
    });

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
 * Create V2Ray (VMess) device
 */
async function createV2rayDevice(req, res, server, vpnService, requesterId, deviceOwnerId, requester) {
  const { name, planId, dataLimit, expiresAt } = req.body;

  try {
    // Create user on V2Ray server
    let v2rayData;
    try {
      v2rayData = await vpnService.addUser({
        name: name || `User-${Date.now()}`,
        limit: dataLimit || 0,
        expiresAt,
      });
    } catch (error) {
      return res.status(500).json({ error: `Failed to create v2ray user: ${error.message}` });
    }

    // If admin configured a publicHost for this server, normalize/override the
    // helper-returned clientConfig so clients receive the advertised domain.
    if (v2rayData?.clientConfig) {
      try {
        v2rayData.clientConfig = require('../utils/ConfigGenerator').normalizeVmessClientConfig(
          v2rayData.clientConfig,
          server,
          name || v2rayData.name
        );
      } catch (e) {
        console.warn('[createV2rayDevice] Failed to normalize clientConfig host:', e.message);
      }
    }

    // Create Device reference
    const device = new Device({
      name,
      user: deviceOwnerId || null,
      server: server._id,
      plan: planId || null,
      dataLimit: dataLimit ? { bytes: dataLimit, isEnabled: true } : null,
      isUnlimited: !dataLimit,
      expiresAt,
      status: 'ACTIVE',
      configFile: v2rayData.clientConfig || v2rayData.accessUrl || null,
    });

    await device.save();

    // Create V2rayUser document
    const v2user = new V2rayUser({
      server: server._id,
      device: device._id,
      user: deviceOwnerId || null,
      userId: v2rayData.userId || v2rayData.id || String(Date.now()),
      clientConfig: v2rayData.clientConfig || JSON.stringify(v2rayData),
      name: name || v2rayData.name,
      dataLimit: dataLimit ? { bytes: dataLimit, isEnabled: true } : null,
      status: 'ACTIVE',
      expiresAt,
    });

    await v2user.save();

    // Link device to v2rayUser
    device.v2rayUser = v2user._id;
    await device.save();

    // Add to device owner's devices if assigned
    let deviceOwnerUsername = undefined;
    if (deviceOwnerId) {
      const deviceOwner = await User.findById(deviceOwnerId);
      if (deviceOwner) {
        deviceOwnerUsername = deviceOwner.username;
        deviceOwner.devices.push(device._id);
        await deviceOwner.save();
      }
    }

    // Add to server's devices
    server.devices.push(device._id);
    server.stats.totalUsers += 1;
    await server.save();

    // Record sale transaction (only when plan is selected)
    if (planId) {
      try {
        const plan = await Plan.findById(planId);
        if (plan) {
          await SalesTransaction.create({
            deviceId: device._id,
            deviceName: device.name,
            plan: plan._id,
            planName: plan.name,
            planPrice: plan.price || 0,
            planCurrency: plan.currency || 'USD',
            planBillingCycle: plan.billingCycle,
            server: server._id,
            serverName: server.name,
            serverType: server.serverType,
            user: deviceOwnerId || null,
            userName: deviceOwnerUsername,
            createdBy: requesterId,
            createdByName: requester?.username,
            expiresAt: device.expiresAt,
            metadata: {
              deviceStatus: device.status,
            },
          });
        }
      } catch (e) {
        console.error('[SalesTransaction] Failed to record sale:', e.message);
      }
    }

    await logActivity(requesterId, 'CREATE_DEVICE', 'DEVICE', device._id, true);

    // Log device history
    await DeviceHistory.create({
      device: device._id,
      user: requesterId,
      action: 'CREATED',
      reason: 'manual',
      metadata: {
        notes: `V2Ray device created on server ${server.name}${deviceOwnerId && deviceOwnerId !== requesterId ? ` and assigned to user ${deviceOwnerId}` : ''}`,
      },
    });

    res.status(201).json({
      message: 'V2Ray (VMess) user created successfully',
      device,
      v2rayUser: {
        id: v2user._id,
        userId: v2user.userId,
        clientConfig: v2user.clientConfig,
        name: v2user.name,
      },
    });
  } catch (error) {
    console.error('Error creating V2Ray device:', error);
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

    const query = {};
    if (serverId) query.server = serverId;
    if (status) query.status = status;

    // Role-based filtering
    const isAdmin = user.role?.toLowerCase() === 'admin';
    const isstaff = user.role?.toLowerCase() === 'staff';
    
    if (!isAdmin && !isstaff) {
      // Regular users only see their assigned devices
      query.user = userId;
    }
    // Admin and staffs see all devices (no user filter)

    const devices = await Device.find(query)
      .populate('server', 'name host region vpnType')
      .populate('plan', 'name dataLimit')
      .populate('accessKey', 'accessKeyId accessUrl name')
      .populate('v2rayUser', 'userId name')
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
      if (device.server?.vpnType === 'v2ray' && !device.v2rayUser) {
        const v2rayUser = await V2rayUser.findOne({ device: device._id });
        if (v2rayUser) {
          device.v2rayUser = v2rayUser;
          await device.save();
          console.log(`[getDevices] Linked v2rayUser to device ${device.name}`);
        }
      }
    }

    // Refresh devices after potential linking
    const refreshedDevices = await Device.find(query)
      .populate('server', 'name host region vpnType')
      .populate('plan', 'name dataLimit')
      .populate('accessKey', 'accessKeyId accessUrl name')
      .populate('v2rayUser', 'userId name')
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
              .select('+outline.adminAccessKey +outline.ssh.privateKey +v2ray.ssh.privateKey');
            
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
        } else if (device.server?.vpnType === 'v2ray' && device.v2rayUser?.userId) {
          try {
            console.log(`[getDevices] Fetching usage for V2Ray device ${device.name}, userId: ${device.v2rayUser.userId}`);

            const server = await VpnServer.findById(device.server._id)
              .select('+outline.adminAccessKey +outline.ssh.privateKey +v2ray.ssh.privateKey');

            if (server) {
              const vpnService = getVpnService(server);
              let stats = await vpnService.getUserStats(device.v2rayUser.userId);
              let bytesUsed = stats?.bytesUsed || 0;
              // If zero, try using v2rayUser.name which some Xray installs use in stats labels
              if ((!bytesUsed || bytesUsed === 0) && device.v2rayUser?.name) {
                try {
                  const alt = await vpnService.getUserStats(device.v2rayUser.name);
                  if (alt?.bytesUsed && alt.bytesUsed > bytesUsed) {
                    stats = alt;
                    bytesUsed = alt.bytesUsed;
                  }
                } catch (e) {
                  // ignore alt lookup errors
                }
              }

              deviceObj.usage = {
                bytesSent: 0,
                bytesReceived: bytesUsed,
                lastSync: new Date(),
              };
              deviceObj.totalBytesUsed = bytesUsed;
            }
          } catch (err) {
            console.error(`[getDevices] Failed to fetch usage for V2Ray device ${device._id}:`, err.message);
          }
        } else if (device.server?.vpnType === 'v2ray') {
          console.warn(`[getDevices] V2Ray device ${device.name} missing v2rayUser:`, device.v2rayUser);
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
 * Get per-device network stats (V2Ray / Outline / WireGuard)
 */
exports.getDeviceStats = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.userId;

    const device = await Device.findById(deviceId).populate('server').populate('v2rayUser').populate('accessKey');
    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Authorization: owner or admin/staff
    const user = await User.findById(userId);
    const isAdmin = user.role?.toLowerCase() === 'admin';
    const isstaff = user.role?.toLowerCase() === 'staff';
    if (device.user && device.user.toString() !== userId && !isAdmin && !isstaff) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If V2Ray
    if (device.server?.vpnType === 'v2ray') {
      if (!device.v2rayUser || !device.v2rayUser.userId) {
        return res.status(400).json({ error: 'Device missing V2Ray user id' });
      }

      const server = await VpnServer.findById(device.server._id)
        .select('+outline.adminAccessKey +outline.ssh.privateKey +v2ray.ssh.privateKey');
      if (!server) return res.status(404).json({ error: 'Server not found' });

      const vpnService = getVpnService(server);
      try {
        const stats = await vpnService.getUserStats(device.v2rayUser.userId);
        return res.json({ deviceId: device._id, stats });
      } catch (err) {
        // Try a raw SSH fallback for diagnostics if SSH credentials exist on the server
        try {
          const sshCfg = server.v2ray?.ssh || server.ssh || server.outline?.ssh || null;
          if (sshCfg) {
            const exec = new SSHExecutor(server);
            try {
              const raw = await exec.executeCommand(`xray api statsquery -pattern "user>>>${device.v2rayUser.userId}>>>traffic"`);
              let parsed = null;
              try { parsed = JSON.parse(raw); } catch (e) { /* non-json */ }
              if (parsed && Array.isArray(parsed.stat) && parsed.stat.length) {
                // reuse parsing logic
                  let uplink = 0, downlink = 0;
                  for (const s of parsed.stat) {
                    if (!s || !s.name) continue;
                    if (s.name.endsWith('uplink')) uplink = Number(s.value) || 0;
                    if (s.name.endsWith('downlink')) downlink = Number(s.value) || 0;
                  }
                  const total = uplink + downlink;
                  return res.json({ deviceId: device._id, stats: { userId: device.v2rayUser.userId, bytesUsed: total, uplink, downlink } });
              }
              // If parsed empty, try broad query
              const rawAll = await exec.executeCommand('xray api statsquery -pattern ""');
              let parsedAll = null;
              try { parsedAll = JSON.parse(rawAll); } catch (e) { /* ignore */ }
              if (parsedAll && Array.isArray(parsedAll.stat)) {
                let uplink = 0, downlink = 0;
                const uid = String(device.v2rayUser.userId || '');
                const uname = String(device.v2rayUser.name || '');
                for (const s of parsedAll.stat) {
                  if (!s || !s.name) continue;
                  const n = s.name;
                  if (uid && n.includes(`user>>>${uid}>>>traffic`)) {
                    if (n.endsWith('uplink')) uplink = Number(s.value) || 0;
                    if (n.endsWith('downlink')) downlink = Number(s.value) || 0;
                  }
                  if (uname && n.includes(`user>>>${uname}>>>traffic`)) {
                    if (n.endsWith('uplink')) uplink = Number(s.value) || uplink;
                    if (n.endsWith('downlink')) downlink = Number(s.value) || downlink;
                  }
                }
                const total = uplink + downlink;
                if (total > 0) return res.json({ deviceId: device._id, stats: { userId: device.v2rayUser.userId, bytesUsed: total, uplink, downlink } });
              }
              // Return extended diagnostic information
              return res.status(500).json({ error: err.message, sshRaw: raw || null, sshAllRaw: rawAll || null });
            } catch (sshErr) {
              // include sshErr message with the original error
              return res.status(500).json({ error: err.message, sshError: sshErr.message });
            }
          }
        } catch (diagErr) {
          // fall through to send original
        }

        return res.status(500).json({ error: err.message });
      }
    }

    // If Outline
    if (device.server?.vpnType === 'outline') {
      if (!device.accessKey || !device.accessKey.accessKeyId) {
        return res.status(400).json({ error: 'Device missing access key id' });
      }
      const server = await VpnServer.findById(device.server._id)
        .select('+outline.adminAccessKey +outline.ssh.privateKey +v2ray.ssh.privateKey');
      if (!server) return res.status(404).json({ error: 'Server not found' });
      const vpnService = getVpnService(server);
      try {
        const metrics = await vpnService.makeRequest('GET', 'metrics/transfer');
        const bytes = metrics?.bytesTransferredByUserId?.[device.accessKey.accessKeyId] || 0;
        return res.json({ deviceId: device._id, stats: { userId: device.accessKey.accessKeyId, bytesUsed: bytes } });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // WireGuard - delegate to WireGuard service if implemented
    if (device.server?.vpnType === 'wireguard') {
      const server = await VpnServer.findById(device.server._id)
        .select('+outline.adminAccessKey +outline.ssh.privateKey +v2ray.ssh.privateKey');
      if (!server) return res.status(404).json({ error: 'Server not found' });
      const vpnService = getVpnService(server);
      try {
        const stats = await vpnService.getUserStats(device.publicKey || device.vpnIp);
        return res.json({ deviceId: device._id, stats });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'Unsupported VPN type for stats' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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

    const device = await Device.findById(deviceId).populate('accessKey');
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    const isAdmin = user.role?.toLowerCase() === 'admin';
    const isstaff = user.role?.toLowerCase() === 'staff';
    if (device.user && device.user.toString() !== userId && !isAdmin && !isstaff) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const changes = [];
    const oldDeviceName = device.name; // Store old name for history

    // Track name change
    if (name !== undefined && name !== device.name) {
      changes.push({ field: 'name', oldValue: device.name, newValue: name });
      device.name = name;
    }

    // Track plan change (allow null and accept plan name or _id)
    if (planId !== undefined) {
      // Normalize client inputs that represent "no plan"
      const normalized = (planId === '' || planId === 'null') ? null : planId;
      const currentPlanIdStr = device.plan ? device.plan.toString() : null;

      // Resolve incoming plan value to a Plan _id (or null)
      let resolvedPlanId = null;
      if (normalized) {
        if (mongoose.Types.ObjectId.isValid(normalized)) {
          const found = await Plan.findById(normalized);
          if (!found) return res.status(404).json({ error: 'Plan not found' });
          resolvedPlanId = found._id;
        } else {
          // treat value as plan name
          const foundByName = await Plan.findOne({ name: normalized });
          if (!foundByName) return res.status(404).json({ error: 'Plan not found' });
          resolvedPlanId = foundByName._id;
        }
      } else {
        resolvedPlanId = null;
      }

      if ((resolvedPlanId && resolvedPlanId.toString()) !== currentPlanIdStr) {
        changes.push({ field: 'plan', oldValue: device.plan || null, newValue: resolvedPlanId });
        device.plan = resolvedPlanId;
      }
    }

    // Track expiration date change
    if (expiresAt !== undefined) {
      const oldDate = device.expiresAt ? device.expiresAt.toISOString() : null;
      const newDate = expiresAt ? new Date(expiresAt).toISOString() : null;
      if (oldDate !== newDate) {
        changes.push({ field: 'expiresAt', oldValue: device.expiresAt, newValue: expiresAt || null });
        device.expiresAt = expiresAt || null;
      }
    }

    // Track data limit change
    if (dataLimit !== undefined) {
      const oldLimit = device.dataLimit?.bytes || null;
      const newLimit = dataLimit || null;
      
      if (oldLimit !== newLimit) {
        changes.push({ field: 'dataLimit', oldValue: oldLimit, newValue: newLimit });
        
        if (dataLimit) {
          device.dataLimit = { bytes: dataLimit, isEnabled: true };
          device.isUnlimited = false;
        } else {
          device.isUnlimited = true;
          device.dataLimit = { isEnabled: false };
        }

        // Update Outline key data limit if applicable
        const server = await VpnServer.findById(device.server)
          .select('+outline.adminAccessKey +outline.ssh.privateKey');
        if (server && server.vpnType === 'outline' && device.accessKey) {
          try {
            const outlineService = new OutlineService(server);
            // Pass null for unlimited, or the actual limit value
            // Don't use || 0 because that would set 1024 bytes instead of removing limit
            await outlineService.setDataLimit(device.accessKey.accessKeyId, dataLimit || null);
          } catch (error) {
            console.error('Failed to update Outline data limit:', error.message);
          }
        }
      }
    }

    await device.save();
    
    // Only log activity and history if there are actual changes
    if (changes.length > 0) {
      await logActivity(userId, 'UPDATE_DEVICE', 'DEVICE', device._id, true);

      // Log each change in history with device name in metadata
      for (const change of changes) {
        let action = 'UPDATED';
        if (change.field === 'dataLimit') action = 'DATA_LIMIT_CHANGED';
        else if (change.field === 'expiresAt') action = 'EXPIRE_DATE_CHANGED';
        else if (change.field === 'name') action = 'NAME_CHANGED';
        else if (change.field === 'plan') action = 'PLAN_CHANGED';

        await DeviceHistory.create({
          device: device._id,
          user: userId,
          action,
          changes: change,
          reason: 'manual',
          metadata: {
            deviceName: oldDeviceName,
            notes: `${change.field} changed`,
          },
        });
      }
    }

    res.json({
      message: changes.length > 0 ? 'Device updated successfully' : 'No changes detected',
      device,
    });
  } catch (error) {
    console.error('Error updating device:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Device migration (Outline-only)
 */
exports.migrateDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { targetServerId, importUsage = true } = req.body;
    const userId = req.userId;

    const device = await Device.findById(deviceId).populate('accessKey');
    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Only Outline devices supported for now
    const sourceServer = await VpnServer.findById(device.server).select('+outline.adminAccessKey +outline.ssh.privateKey +v2ray.ssh.privateKey');
    if (!sourceServer || sourceServer.vpnType !== 'outline') {
      return res.status(400).json({ error: 'Only Outline devices can be migrated with this endpoint' });
    }

    if (!device.accessKey) {
      return res.status(400).json({ error: 'Device has no associated Outline access key' });
    }

    if (!targetServerId || targetServerId === String(sourceServer._id)) {
      return res.status(400).json({ error: 'Invalid target server' });
    }

    const targetServer = await VpnServer.findById(targetServerId).select('+outline.adminAccessKey +outline.ssh.privateKey +v2ray.ssh.privateKey');
    if (!targetServer || targetServer.vpnType !== 'outline' || !targetServer.isActive) {
      return res.status(400).json({ error: 'Target server not available or not an Outline server' });
    }

    // Check target health
    const targetService = new OutlineService(targetServer);
    const isHealthy = await targetService.checkHealth();
    if (!isHealthy) return res.status(400).json({ error: 'Target Outline server is not healthy' });

    // read source usage/limit from source Outline server
    const sourceService = new OutlineService(sourceServer);
    let usageSnapshot = { bytesSent: 0, bytesReceived: 0, totalBytes: 0 };
    let remainingBytes = null; // null means unlimited
    try {
      const stats = await sourceService.getUserStats(device.accessKey.accessKeyId);
      const used = stats.bytesUsed || 0;
      usageSnapshot = { bytesSent: 0, bytesReceived: used, totalBytes: used, lastSync: new Date() };

      // Determine remaining quota from device override -> plan -> accessKey
      const sourceLimit = device.dataLimit?.bytes || device.plan?.dataLimit?.bytes || (stats.dataLimit?.bytes || null);
      if (sourceLimit && typeof sourceLimit === 'number') {
        remainingBytes = Math.max(0, sourceLimit - used);
      } else {
        remainingBytes = null; // unlimited
      }
    } catch (err) {
      console.warn('[migrateDevice] Failed to fetch source usage:', err.message);
      // proceed without usage import if fetch fails
      usageSnapshot = { bytesSent: 0, bytesReceived: 0, totalBytes: 0, lastSync: new Date() };
      remainingBytes = device.dataLimit?.bytes || device.plan?.dataLimit?.bytes || null;
    }

    // Create access key on target server with remainingBytes as limit (if provided)
    let newKeyData;
    try {
      const createBody = { name: device.name || (device.accessKey && device.accessKey.name) };
      if (importUsage && remainingBytes !== null && typeof remainingBytes === 'number') {
        createBody.limit = remainingBytes;
      }
      newKeyData = await targetService.addUser(createBody);
    } catch (err) {
      console.error('[migrateDevice] Failed to create key on target:', err.message);
      return res.status(500).json({ error: `Failed to create access key on target server: ${err.message}` });
    }

    // Try to set data limit explicitly (best-effort)
    try {
      await targetService.setDataLimit(newKeyData.accessKeyId, importUsage ? remainingBytes : null);
    } catch (err) {
      console.warn('[migrateDevice] Failed to set data limit on new key:', err.message);
    }

    // Persist DB changes: create new AccessKey doc, update device, update servers
    try {
      const newAccessKeyDoc = new AccessKey({
        server: targetServer._id,
        user: device.user || null,
        device: device._id,
        accessKeyId: newKeyData.accessKeyId,
        accessUrl: newKeyData.accessUrl,
        name: newKeyData.name || device.name || 'access-key',
        dataLimit: importUsage && remainingBytes !== null ? { bytes: remainingBytes, isEnabled: true } : { isEnabled: false },
        status: 'ACTIVE',
        expiresAt: device.expiresAt || null,
        usage: usageSnapshot,
      });

      await newAccessKeyDoc.save();

      // Update device to point to target server & new access key and preserve usage/limits
      device.server = targetServer._id;
      device.accessKey = newAccessKeyDoc._id;
      device.configFile = newKeyData.accessUrl;
      device.usage = usageSnapshot;

      // If importing quota, set device override to remainingBytes so UI/billing honor it
      if (importUsage && remainingBytes !== null) {
        device.dataLimit = { bytes: remainingBytes, isEnabled: true };
        device.isUnlimited = false;
      } else if (importUsage && remainingBytes === null) {
        device.dataLimit = { isEnabled: false };
        device.isUnlimited = true;
      }

      await device.save();

      // Update target server devices/stats
      targetServer.devices.push(device._id);
      targetServer.stats.totalUsers = (targetServer.stats.totalUsers || 0) + 1;
      await targetServer.save();

      // Update source server devices/stats: remove device reference
      const src = await VpnServer.findById(sourceServer._id);
      if (src) {
        src.devices = (src.devices || []).filter((id) => String(id) !== String(device._id));
        src.stats.totalUsers = Math.max(0, (src.stats.totalUsers || 1) - 1);
        await src.save();
      }

      // Remove old AccessKey from source Outline server and delete DB doc
      try {
        const oldAccessKey = await AccessKey.findOne({ device: device._id, server: sourceServer._id });
        if (oldAccessKey) {
          try {
            await sourceService.removeUser(oldAccessKey.accessKeyId);
            await AccessKey.findByIdAndDelete(oldAccessKey._id);
          } catch (err) {
            console.warn('[migrateDevice] Failed to remove old key from source server:', err.message);
            // mark disabled so admin can clean up later
            oldAccessKey.status = 'DISABLED';
            await oldAccessKey.save();
            await DeviceHistory.create({
              device: device._id,
              user: userId,
              action: 'MIGRATED',
              reason: 'manual',
              metadata: {
                deviceName: device.name,
                notes: `Old access key could not be removed from source server: ${err.message}`,
              },
            });
          }
        }
      } catch (err) {
        console.warn('[migrateDevice] Cleanup of old access key failed:', err.message);
      }

      // Log activity and history
      await logActivity(userId, 'MIGRATE_DEVICE', 'DEVICE', device._id, true);
      await DeviceHistory.create({
        device: device._id,
        user: userId,
        action: 'MIGRATED',
        changes: {
          field: 'server',
          oldValue: sourceServer.name,
          newValue: targetServer.name,
        },
        reason: 'manual',
        metadata: {
          deviceName: device.name,
          notes: `Imported usage: ${usageSnapshot.totalBytes} bytes, remaining quota: ${remainingBytes === null ? 'unlimited' : remainingBytes + ' bytes'}`,
        },
      });

      // Return updated device and new accessUrl for immediate download/QR
      const updatedDevice = await Device.findById(device._id)
        .populate('server', 'name host region vpnType')
        .populate('accessKey', 'accessKeyId accessUrl name');

      return res.json({ message: 'Device migrated successfully', device: updatedDevice, accessUrl: newKeyData.accessUrl });
    } catch (err) {
      console.error('[migrateDevice] Database update failed, attempting rollback:', err.message);
      // Attempt compensating removal of newly created key on target
      try {
        if (newKeyData && newKeyData.accessKeyId) {
          await targetService.removeUser(newKeyData.accessKeyId);
        }
      } catch (cleanupErr) {
        console.error('[migrateDevice] Rollback cleanup failed:', cleanupErr.message);
      }
      return res.status(500).json({ error: 'Failed to complete migration: ' + err.message });
    }
  } catch (error) {
    console.error('Error migrating device:', error);
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
    } else if (server.vpnType === 'v2ray') {
      // Remove user from V2Ray/Xray server
      if (device.v2rayUser) {
        try {
          // Get the V2rayUser document to retrieve the device name
          const v2rayUserDoc = await V2rayUser.findById(device.v2rayUser);
          if (v2rayUserDoc) {
            // Pass device name (email) to removeUser - this matches the client config
            await vpnService.removeUser(v2rayUserDoc.name || v2rayUserDoc.userId);
          }
        } catch (error) {
          console.error('Failed to remove V2Ray user:', error);
          // Continue with deletion even if removal fails
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

    // Log device history
    await DeviceHistory.create({
      device: deviceId,
      user: userId,
      action: 'DELETED',
      reason: 'manual',
      metadata: {
        notes: `Device ${device.name} deleted from server ${server.name}`,
      },
    });

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

    const device = await Device.findById(deviceId).populate('server').populate('plan');
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

    // Capture old values BEFORE making changes (for history logging)
    const oldStatus = device.status;
    const oldIsEnabled = device.isEnabled;

    // Handle status change
    if (status) {
      const validStatuses = ['ACTIVE', 'SUSPENDED', 'DISABLED', 'EXPIRED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      device.status = status;
    }

    // Handle enable/disable and status changes for Outline
    if (server.vpnType === 'outline') {
      // For Outline, pause/resume via data limit API
      if (device.accessKey) {
        const accessKey = await AccessKey.findById(device.accessKey);
        if (accessKey) {
          try {
            // Get server with admin keys
            const fullServer = await VpnServer.findById(server._id)
              .select('+outline.adminAccessKey +outline.ssh.privateKey');
            const outlineService = new OutlineService(fullServer);
            
            // Determine if we should pause or resume
            // Priority: status over isEnabled when both are provided
            let shouldPause = false;
            let shouldResume = false;
            
            if (status) {
              // Status takes priority
              shouldPause = status === 'SUSPENDED' || status === 'DISABLED';
              shouldResume = status === 'ACTIVE';
            } else if (isEnabled !== undefined) {
              // Only use isEnabled if status is not provided
              shouldPause = !isEnabled;
              shouldResume = isEnabled;
            }
            
            if (shouldPause) {
              // Store original device.dataLimit.bytes before suspending
              // This is the Device Override data that should be restored when resuming
              const originalDeviceLimit = device.dataLimit?.bytes || null;
              
              // Store original device limit in accessKey metadata for later restoration
              if (!accessKey.metadata) {
                accessKey.metadata = {};
              }
              // Only store if not already stored (to preserve original value across multiple suspend/resume cycles)
              if (accessKey.metadata.originalDeviceLimitBeforeSuspend === undefined) {
                accessKey.metadata.originalDeviceLimitBeforeSuspend = originalDeviceLimit;
                console.log(`[toggleDeviceStatus] Stored original device dataLimit before suspend: ${originalDeviceLimit === null ? 'unlimited' : originalDeviceLimit} bytes`);
              } else {
                console.log(`[toggleDeviceStatus] Original device limit already stored: ${accessKey.metadata.originalDeviceLimitBeforeSuspend === null ? 'unlimited' : accessKey.metadata.originalDeviceLimitBeforeSuspend} bytes`);
              }
              
              // Update device.dataLimit (Device Override) to 0 bytes for suspend
              // This updates the Device Override data to reflect the SUSPENDED state
              device.dataLimit = { bytes: 0, isEnabled: true };
              device.isUnlimited = false;
              
              // Also update Outline API limit to 0 bytes (blocks all usage)
              await outlineService.setDataLimit(accessKey.accessKeyId, 0);
              accessKey.status = 'SUSPENDED';
              console.log(`[toggleDeviceStatus] Suspended Outline key ${accessKey.accessKeyId} - updated device.dataLimit to 0 bytes and Outline API limit to 0 bytes`);
            } else if (shouldResume) {
              // Resume by restoring original device.dataLimit.bytes
              // Get the stored original device limit from metadata
              let originalDeviceLimit = accessKey.metadata?.originalDeviceLimitBeforeSuspend;
              
              // If not stored in metadata, try to get from device's current value
              // This handles cases where metadata was lost or device was suspended before this feature
              if (originalDeviceLimit === undefined) {
                // If device.dataLimit is currently 0 (from suspend), we need to check plan or set to unlimited
                if (device.dataLimit?.bytes === 0) {
                  // Device was suspended, check if it had a plan limit
                  if (device.plan?.dataLimit?.bytes) {
                    originalDeviceLimit = device.plan.dataLimit.bytes;
                  } else {
                    originalDeviceLimit = null; // Was unlimited
                  }
                } else {
                  // Use current device limit (shouldn't happen if properly suspended, but handle it)
                  originalDeviceLimit = device.dataLimit?.bytes || null;
                }
                console.log(`[toggleDeviceStatus] Original device limit not in metadata, calculated: ${originalDeviceLimit === null ? 'unlimited' : originalDeviceLimit} bytes`);
              } else {
                console.log(`[toggleDeviceStatus] Using stored original device limit: ${originalDeviceLimit === null ? 'unlimited' : originalDeviceLimit} bytes`);
              }
              
              // Restore device.dataLimit (Device Override) to original value
              if (originalDeviceLimit === null || originalDeviceLimit === undefined) {
                // Restore to unlimited (no device override)
                device.isUnlimited = true;
                device.dataLimit = { isEnabled: false };
              } else {
                // Restore to original limit value
                device.dataLimit = { bytes: originalDeviceLimit, isEnabled: true };
                device.isUnlimited = false;
              }
              
              // Restore the limit on Outline server
              if (originalDeviceLimit === null || originalDeviceLimit === undefined) {
                // Remove limit (set to unlimited) - pass null to setDataLimit
                await outlineService.setDataLimit(accessKey.accessKeyId, null);
                console.log(`[toggleDeviceStatus] Resuming Outline key ${accessKey.accessKeyId} - restored device.dataLimit to unlimited and Outline API to unlimited`);
              } else {
                // Restore original limit
                await outlineService.setDataLimit(accessKey.accessKeyId, originalDeviceLimit);
                console.log(`[toggleDeviceStatus] Resuming Outline key ${accessKey.accessKeyId} - restored device.dataLimit to ${originalDeviceLimit} bytes and Outline API to ${originalDeviceLimit} bytes`);
              }
              
              // Clear the stored original device limit after successful resume
              if (accessKey.metadata) {
                delete accessKey.metadata.originalDeviceLimitBeforeSuspend;
              }
              
              accessKey.status = 'ACTIVE';
            }
            await accessKey.save();
          } catch (error) {
            console.error('Failed to pause/resume Outline key:', error.message);
            throw new Error(`Failed to update Outline key: ${error.message}`);
          }
        }
      }
    }

    // Handle enable/disable for WireGuard
    if (isEnabled !== undefined) {
      device.isEnabled = isEnabled;
      
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
      }
    }

    await device.save();
    await logActivity(userId, 'TOGGLE_DEVICE', 'DEVICE', device._id, true);

    // Log device history
    // Priority: status over isEnabled when both are provided (matches suspend/resume logic)
    let historyAction;
    let historyField;
    let historyOldValue;
    let historyNewValue;
    
    if (status) {
      // Status takes priority - log status change
      historyAction = status === 'ACTIVE' ? 'RESUMED' : (status === 'SUSPENDED' ? 'PAUSED' : 'STATUS_CHANGED');
      historyField = 'status';
      historyOldValue = oldStatus;
      historyNewValue = status;
    } else if (isEnabled !== undefined) {
      // Only use isEnabled if status is not provided
      historyAction = isEnabled ? 'ENABLED' : 'DISABLED';
      historyField = 'isEnabled';
      historyOldValue = oldIsEnabled;
      historyNewValue = isEnabled;
    } else {
      // No changes made, skip history logging
      return res.json({
        message: 'Device status updated',
        device,
      });
    }
    
    await DeviceHistory.create({
      device: device._id,
      user: userId,
      action: historyAction,
      changes: {
        field: historyField,
        oldValue: historyOldValue,
        newValue: historyNewValue,
      },
      reason: 'manual',
    });

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

    // Populate v2rayUser as well for VMess generation
    const device = await Device.findById(deviceId).populate('server').populate('accessKey').populate('v2rayUser');
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

    // For V2Ray servers, return VMess URL (or stored client config)
    } else if (device.server.vpnType === 'v2ray') {
      const config = device.configFile || ConfigGenerator.generateVmess(device, device.server);
      if (!config) return res.status(400).json({ error: 'VMess config not available' });

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${device.name}-vmess.txt"`);
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

    // Populate v2rayUser for VMess QR generation
    const device = await Device.findById(deviceId).populate('server').populate('accessKey').populate('v2rayUser');
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

    // For V2Ray servers, return VMess QR / URL
    } else if (device.server.vpnType === 'v2ray') {
      const config = device.configFile || ConfigGenerator.generateVmess(device, device.server);
      if (!config) return res.status(400).json({ error: 'VMess config not available' });
      const qrCode = await ConfigGenerator.generateQRCode(config);
      res.json({ qrCode, config });

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
