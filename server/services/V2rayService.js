const https = require('https');
const http = require('http');
const VpnService = require('./VpnService');
const SSHExecutor = require('../utils/SSHExecutor');
const ConfigGenerator = require('../utils/ConfigGenerator');
const { decryptString } = require('../utils/crypto');

/**
 * V2Ray (VMess) Service
 * - Supports Management API (preferred) or SSH helper commands
 * - Minimal implementation: addUser, removeUser, getUserConfig, getUserStats, setDataLimit, checkHealth
 */
class V2rayService extends VpnService {
  constructor(server) {
    super(server);
    this.server = server;
    this.v2ray = server.v2ray || {};
    this.baseUrl = this.v2ray.apiBaseUrl;
    // Decrypt API token if stored encrypted (prefix: ENC:...)
    const rawToken = this.v2ray.apiToken || null;
    this.apiToken = rawToken && typeof rawToken === 'string' && rawToken.startsWith('ENC:')
      ? decryptString(rawToken.replace(/^ENC:/, ''))
      : rawToken;
    this.accessMethod = this.v2ray.accessMethod || 'api';
    this.requestTimeout = 10000;

    if (this.accessMethod === 'ssh') {
      this.executor = new SSHExecutor(server);
    }
  }

  async makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      if (!this.baseUrl) return reject(new Error('API base URL not configured'));
      // Normalize base URL / host and determine protocol/port
      let hostname = this.server.host;
      let port = this.v2ray.apiPort || (this.server.port || 80);
      let useHttp = false;
      if (this.baseUrl) {
        try {
          const parsed = new URL(this.baseUrl);
          hostname = parsed.hostname || hostname;
          port = this.v2ray.apiPort || (parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'http:' ? 80 : 443));
          useHttp = parsed.protocol === 'http:';
        } catch (e) {
          // baseUrl may be a bare hostname
          hostname = this.baseUrl || hostname;
          port = this.v2ray.apiPort || (this.server.port || 80);
        }
      }

      const protocol = (hostname.includes('localhost') || hostname.includes('127.0.0.1') || useHttp) ? http : https;

      const options = {
        hostname,
        port,
        path: path.startsWith('/') ? path : `/${path}`,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: this.requestTimeout,
        rejectUnauthorized: (this.v2ray && this.v2ray.tlsVerify !== false),
      };

      if (this.apiToken) {
        options.headers.Authorization = `Bearer ${this.apiToken}`;
      }

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : null;
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
            return reject(new Error(`API Error (${res.statusCode}): ${data || 'No response'}`));
          } catch (err) {
            return reject(new Error(`Failed to parse API response: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') reject(new Error(`Cannot connect to v2ray API at ${options.hostname}:${options.port}`));
        else reject(new Error(`Request failed: ${err.message}`));
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async checkHealth() {
    if (this.accessMethod === 'ssh') {
      const result = await this.executor.testConnection();
      return result.success;
    }
    try {
      // Try /status or /health endpoints if server supports them
      const resp = await this.makeRequest('GET', 'status');
      return !!resp;
    } catch (err) {
      try {
        const resp = await this.makeRequest('GET', 'health');
        return !!resp;
      } catch (err2) {
        return false;
      }
    }
  }

  async addUser(userData) {
    const { name, limit, expiresAt } = userData;
    if (this.accessMethod === 'ssh') {
      // Expect server to have a helper script `v2ray-cli` that adds user and prints JSON
      const cmd = `v2ray-cli add-user --name "${name || 'user'}" ${limit ? `--limit ${limit}` : ''} ${expiresAt ? `--expires "${expiresAt}"` : ''}`;
      try {
        const out = await this.executor.executeCommand(cmd);
        const parsed = this.parseV2rayCliOutput(out);
        const ensured = await this.ensureUserInConfig(parsed.userId, name);
        
        // Generate VMess client config with server details
        const vmessConfig = this.generateVmessClientConfig(
          parsed.userId,
          name || 'device',
          this.server.host,
          this.server.port || 10000
        );
        
        return { 
          ...parsed, 
          clientConfig: vmessConfig,
          ensuredInConfig: ensured 
        }; 
      } catch (err) {
        const errMsg = err && err.message ? err.message : String(err);

        // If failure is caused by permission issues writing to /etc/default/v2ray-cli,
        // try a sudo-prefixed fallback (useful when helper requires root).
        if (/permission denied|\/etc\/default\/v2ray-cli/i.test(errMsg)) {
          try {
            // attempt passwordless sudo; if sudo requires a password this will fail quickly
            const sudoCmd = `sudo ${cmd}`;
            const out2 = await this.executor.executeCommand(sudoCmd);
            const parsed2 = this.parseV2rayCliOutput(out2);
            const ensured2 = await this.ensureUserInConfig(parsed2.userId, name);
            
            // Generate VMess client config with server details
            const vmessConfig = this.generateVmessClientConfig(
              parsed2.userId,
              name || 'device',
              this.server.host,
              this.server.port || 10000
            );
            
            return { 
              ...parsed2, 
              clientConfig: vmessConfig,
              usedSudo: true, 
              ensuredInConfig: ensured2 
            };
          } catch (err2) {
            const sudoErr = err2 && err2.message ? err2.message : String(err2);
            const sudoNeedsPassword = /password is required|a terminal is required|no tty present/i.test(sudoErr);
            if (/sorry, user .* is not allowed to run sudo/i.test(sudoErr)) {
              throw new Error(`Remote v2ray-cli requires root privileges but sudo is not permitted for this user. Configure NOPASSWD for v2ray-cli/systemctl or use a sudo-enabled account.`);
            }
            if (sudoNeedsPassword) {
              const hasSshPassword = !!(this.executor && this.executor.sshConfig && this.executor.sshConfig.password);
              if (!hasSshPassword) {
                throw new Error(
                  'Remote v2ray-cli requires sudo but no SSH password was provided. Update the server with an SSH password or configure passwordless sudo for v2ray-cli and systemctl.'
                );
              }
              throw new Error(`Remote v2ray-cli requires root privileges and sudo password was rejected. Sudo attempt failed: ${sudoErr}`);
            }
            throw new Error(`Failed to add v2ray user via SSH (attempted sudo): ${sudoErr}`);
          }
        }

        throw new Error(`Failed to add v2ray user via SSH: ${errMsg}`);
      }
    }

    // API mode
    try {
      const body = { name: name || `user-${Date.now()}` };
      if (limit && limit > 0) body.limit = { bytes: limit };
      if (expiresAt) body.expiresAt = expiresAt;
      const resp = await this.makeRequest('POST', 'users', body);
      // Expect resp to contain { id, clientConfig }
      return {
        success: true,
        userId: resp.id || resp.userId,
        clientConfig: resp.clientConfig || resp.vmess || resp.accessUrl || JSON.stringify(resp),
        dataLimit: resp.dataLimit || null,
      };
    } catch (err) {
      throw new Error(`Failed to add v2ray user via API: ${err.message}`);
    }
  }

  parseV2rayCliOutput(output) {
    try {
      const json = JSON.parse(output);
      return {
        success: true,
        userId: json.id || json.userId,
        clientConfig: json.clientConfig || json.vmess || json.accessUrl || JSON.stringify(json),
        dataLimit: json.dataLimit || null,
      };
    } catch (e) {
      return { success: true, userId: String(output).trim(), clientConfig: String(output).trim() };
    }
  }

  /**
   * Generate VMess client configuration URL
   * Returns vmess://base64({"v":2,"ps":"name","add":"host","port":port,"id":"uuid","alterId":0,"net":"tcp","type":"none"})
   */
  generateVmessClientConfig(uuid, name, host, port = 10000) {
    try {
      const config = {
        v: 2,
        ps: name || 'device',
        add: host,
        port: Number(port),
        id: uuid,
        alterId: 0,
        net: 'tcp',
        type: 'none'
      };
      const b64 = Buffer.from(JSON.stringify(config)).toString('base64');
      return `vmess://${b64}`;
    } catch (err) {
      console.error('[V2rayService] Failed to generate VMess config:', err.message);
      // Return minimal fallback
      return JSON.stringify({ id: uuid, email: name });
    }
  }

  async ensureUserInConfig(userId, name) {
    if (!userId) return { changed: false, reason: 'missing-user-id' };
    const configPaths = await this.resolveRemoteConfigPaths();
    if (!configPaths.length) throw new Error('Unable to locate V2Ray/Xray config.json on remote host');

    let lastError = null;
    for (const configPath of configPaths) {
      const configContent = await this.readRemoteFile(configPath);
      let config;
      try {
        config = JSON.parse(configContent);
      } catch (e) {
        lastError = `Failed to parse remote config JSON at ${configPath}: ${e.message}`;
        continue;
      }

      const inbound = Array.isArray(config.inbounds)
        ? config.inbounds.find((inb) => inb?.protocol === 'vmess' || Array.isArray(inb?.settings?.clients))
        : null;

      if (!inbound || !inbound.settings) {
        lastError = `No VMess inbound found in config at ${configPath}`;
        continue;
      }

      inbound.settings.clients = Array.isArray(inbound.settings.clients) ? inbound.settings.clients : [];

      const exists = inbound.settings.clients.some((c) => c && String(c.id) === String(userId));
      if (exists) return { changed: false, reason: 'already-exists', configPath };

      inbound.settings.clients.push({
        id: String(userId),
        alterId: 0,
        email: name || `device-${String(userId).slice(0, 8)}`,
      });

      const updated = JSON.stringify(config, null, 2);
      await this.writeRemoteFile(configPath, updated);
      await this.restartRemoteService(configPath);

      return { changed: true, configPath };
    }

    throw new Error(lastError || 'No VMess inbound found in any config; cannot add user');
  }

  async resolveRemoteConfigPaths() {
    const candidates = [
      this.v2ray?.configPath,
      '/usr/local/etc/xray/config.json',
      '/usr/local/etc/v2ray/config.json',
      '/etc/v2ray/config.json',
    ].filter(Boolean);

    const seen = new Set();
    const existing = [];

    for (const path of candidates) {
      if (seen.has(path)) continue;
      seen.add(path);
      const cmd = `if [ -f ${path} ]; then echo ${path}; fi`;
      try {
        const out = await this.executor.executeCommand(cmd);
        if (out.trim()) existing.push(out.trim());
      } catch (e) {
        try {
          const out2 = await this.executor.executeCommand(`sudo sh -c '${cmd}'`);
          if (out2.trim()) existing.push(out2.trim());
        } catch (err2) {
          // ignore
        }
      }
    }

    return existing;
  }

  async readRemoteFile(path) {
    try {
      return await this.executor.executeCommand(`cat ${path}`);
    } catch (e) {
      return await this.executor.executeCommand(`sudo cat ${path}`);
    }
  }

  async writeRemoteFile(path, content) {
    const b64 = Buffer.from(content, 'utf8').toString('base64');
    const cmd = `echo ${b64} | base64 -d | sudo tee ${path} > /dev/null`;
    await this.executor.executeCommand(cmd);
  }

  async restartRemoteService(configPath) {
    const preferXray = configPath.includes('/xray/');
    const restartCmd = preferXray
      ? 'sudo systemctl restart xray || sudo systemctl restart v2ray'
      : 'sudo systemctl restart v2ray || sudo systemctl restart xray';
    await this.executor.executeCommand(restartCmd);
  }

  async removeUser(userIdentifier) {
    if (!userIdentifier) throw new Error('User id or name required');
    if (this.accessMethod === 'ssh') {
      // userIdentifier can be UUID or device name
      // v2ray-cli remove-user expects the email/device name stored in the client config
      const cmd = `v2ray-cli remove-user "${userIdentifier}"`;
      try {
        const result = await this.executor.executeCommand(cmd);
        return { success: true, removed: userIdentifier };
      } catch (err) {
        // Log but don't fail - the device is still being deleted from panel
        console.warn(`[V2rayService] Failed to remove v2ray user ${userIdentifier} via SSH: ${err.message}`);
        return { success: true, removed: userIdentifier, warning: 'SSH removal failed, but continuing' };
      }
    }

    try {
      await this.makeRequest('DELETE', `users/${userIdentifier}`);
      return { success: true, removed: userIdentifier };
    } catch (err) {
      console.warn(`[V2rayService] Failed to remove v2ray user ${userIdentifier} via API: ${err.message}`);
      return { success: true, removed: userIdentifier, warning: 'API removal failed, but continuing' };
    }
  }

  async getUserConfig(userId) {
    if (!userId) throw new Error('User id required');
    if (this.accessMethod === 'ssh') {
      const cmd = `v2ray-cli get-config ${userId}`;
      try {
        return await this.executor.executeCommand(cmd);
      } catch (err) {
        throw new Error(`Failed to get v2ray user config via SSH: ${err.message}`);
      }
    }

    try {
      const resp = await this.makeRequest('GET', `users/${userId}/config`);
      return resp.clientConfig || resp.vmess || JSON.stringify(resp);
    } catch (err) {
      throw new Error(`Failed to get v2ray user config via API: ${err.message}`);
    }
  }

  async getUserStats(userId) {
    if (!userId) throw new Error('User id required');
    if (this.accessMethod === 'ssh') {
      const cmd = `v2ray-cli stats ${userId}`;
      let helperOut = null;
      try {
        helperOut = await this.executor.executeCommand(cmd);
      } catch (err) {
        // ignore, we'll try API fallback below
      }

      // If helper produced output, try to interpret it
      if (helperOut) {
        try {
          const parsedOut = JSON.parse(helperOut);
          if (parsedOut && ((typeof parsedOut.bytesUsed === 'number' && parsedOut.bytesUsed > 0) || parsedOut.uplink || parsedOut.downlink)) return parsedOut;
          // otherwise ignore and fall through to API fallback
        } catch (e) {
          const numeric = Number(helperOut) || 0;
          if (numeric > 0) return { bytesUsed: numeric };
        }
      }

      // SSH fallback: query the local xray/v2ray management API via SSH and parse stat entries
      try {
        // First try exact pattern
        const apiCmd = `xray api statsquery -pattern "user>>>${userId}>>>traffic"`;
        const out2 = await this.executor.executeCommand(apiCmd);
        try {
          const parsed = JSON.parse(out2);
          if (Array.isArray(parsed.stat) && parsed.stat.length > 0) {
            let uplink = 0;
            let downlink = 0;
            for (const s of parsed.stat) {
              if (!s || !s.name) continue;
              if (s.name.endsWith('uplink')) uplink = Number(s.value) || 0;
              if (s.name.endsWith('downlink')) downlink = Number(s.value) || 0;
            }
            const total = uplink + downlink;
            return { userId, bytesUsed: total, uplink, downlink };
          }
        } catch (e2) {
          // ignore parse error and continue to broader query
        }

        // If specific pattern returned nothing, request all stats and search for matching entries
        try {
          const outAll = await this.executor.executeCommand('xray api statsquery -pattern ""');
          const parsedAll = JSON.parse(outAll);
          if (Array.isArray(parsedAll.stat)) {
            let uplink = 0;
            let downlink = 0;
            for (const s of parsedAll.stat) {
              if (!s || !s.name) continue;
              if (s.name.includes(`user>>>${userId}>>>traffic`) ) {
                if (s.name.endsWith('uplink')) uplink = Number(s.value) || 0;
                if (s.name.endsWith('downlink')) downlink = Number(s.value) || 0;
              }
            }
            const total = uplink + downlink;
            // Return stats even if zero (user is new/no traffic yet)
            return { userId, bytesUsed: total, uplink, downlink };
          }
        } catch (e3) {
          // ignore and continue below
        }
      } catch (err2) {
        // ignore and continue below
      }

      // If all attempts returned no data, return zero stats instead of throwing error
      // This is normal for new users without traffic
      return { userId, bytesUsed: 0, uplink: 0, downlink: 0 };
    }

    try {
      const resp = await this.makeRequest('GET', `metrics/transfer`);
      // Common API shapes:
      // 1) { bytesTransferredByUserId: { [userId]: N } }
      // 2) { stat: [ { name: 'user>>><id>>>traffic>>>uplink', value: N }, ... ] }
      const bytesFromMap = resp?.bytesTransferredByUserId?.[userId];
      if (typeof bytesFromMap === 'number') return { userId, bytesUsed: bytesFromMap };

      // Fallback: parse stat array entries (as returned by xray's statsquery)
      if (Array.isArray(resp?.stat)) {
        const patternUplink = `user>>>${userId}>>>traffic>>>uplink`;
        const patternDown = `user>>>${userId}>>>traffic>>>downlink`;
        let uplink = 0;
        let downlink = 0;
        for (const s of resp.stat) {
          if (!s || !s.name) continue;
          if (s.name === patternUplink) uplink = Number(s.value) || 0;
          if (s.name === patternDown) downlink = Number(s.value) || 0;
        }
        const total = uplink + downlink;
        return { userId, bytesUsed: total, uplink, downlink };
      }

      // Nothing matched; return zero
      return { userId, bytesUsed: 0 };
    } catch (err) {
      throw new Error(`Failed to get v2ray user stats via API: ${err.message}`);
    }
  }

  async setDataLimit(userId, limitBytes) {
    if (!userId) throw new Error('User id required');
    if (this.accessMethod === 'ssh') {
      const cmd = `v2ray-cli set-limit ${userId} ${limitBytes === null ? 'unlimited' : limitBytes}`;
      try {
        await this.executor.executeCommand(cmd);
        return { success: true };
      } catch (err) {
        throw new Error(`Failed to set v2ray user data limit via SSH: ${err.message}`);
      }
    }

    try {
      const body = limitBytes === null ? { limit: null } : { limit: { bytes: limitBytes } };
      await this.makeRequest('PUT', `users/${userId}/data-limit`, body);
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to set v2ray user data limit via API: ${err.message}`);
    }
  }

  // List users on remote V2Ray server
  async listUsers() {
    if (this.accessMethod === 'ssh') {
      const cmd = `v2ray-cli list-users`;
      try {
        const out = await this.executor.executeCommand(cmd);
        try { return JSON.parse(out); } catch (e) { return out; }
      } catch (err) {
        throw new Error(`Failed to list v2ray users via SSH: ${err.message}`);
      }
    }

    try {
      const resp = await this.makeRequest('GET', 'users');
      return resp.users || resp;
    } catch (err) {
      throw new Error(`Failed to list v2ray users via API: ${err.message}`);
    }
  }

  // Get server-wide stats (metrics/transfer)
  async getServerStats() {
    if (this.accessMethod === 'ssh') {
      return {};
    }
    try {
      const resp = await this.makeRequest('GET', 'metrics/transfer');
      return resp || {};
    } catch (err) {
      throw new Error(`Failed to get v2ray server stats: ${err.message}`);
    }
  }
}

module.exports = V2rayService;
