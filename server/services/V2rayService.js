const https = require('https');
const http = require('http');
const VpnService = require('./VpnService');
const SSHExecutor = require('../utils/SSHExecutor');
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
        try { return JSON.parse(out); } catch (e) { return { success: true, userId: out.trim(), clientConfig: out.trim() }; }
      } catch (err) {
        const errMsg = err && err.message ? err.message : String(err);

        // If failure is caused by permission issues writing to /etc/default/v2ray-cli,
        // try a sudo-prefixed fallback (useful when helper requires root).
        if (/permission denied|\/etc\/default\/v2ray-cli/i.test(errMsg)) {
          try {
            // attempt passwordless sudo; if sudo requires a password this will fail quickly
            const sudoCmd = `sudo ${cmd}`;
            const out2 = await this.executor.executeCommand(sudoCmd);
            try { return JSON.parse(out2); } catch (e) { return { success: true, userId: out2.trim(), clientConfig: out2.trim(), usedSudo: true }; }
          } catch (err2) {
            const sudoErr = err2 && err2.message ? err2.message : String(err2);
            if (/password is required|sorry, user .* is not allowed to run sudo|no tty present/i.test(sudoErr)) {
              throw new Error(`Remote v2ray-cli requires root privileges and sudo is not available/passwordless. Sudo attempt failed: ${sudoErr}`);
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

  async removeUser(userId) {
    if (!userId) throw new Error('User id required');
    if (this.accessMethod === 'ssh') {
      const cmd = `v2ray-cli remove-user ${userId}`;
      try {
        await this.executor.executeCommand(cmd);
        return { success: true };
      } catch (err) {
        throw new Error(`Failed to remove v2ray user via SSH: ${err.message}`);
      }
    }

    try {
      await this.makeRequest('DELETE', `users/${userId}`);
      return { success: true };
    } catch (err) {
      throw new Error(`Failed to remove v2ray user via API: ${err.message}`);
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
      try {
        const out = await this.executor.executeCommand(cmd);
        try { return JSON.parse(out); } catch (e) { return { bytesUsed: Number(out) || 0 }; }
      } catch (err) {
        throw new Error(`Failed to get v2ray user stats via SSH: ${err.message}`);
      }
    }

    try {
      const resp = await this.makeRequest('GET', `metrics/transfer`);
      // Expect resp.bytesTransferredByUserId[userId]
      const bytes = resp?.bytesTransferredByUserId?.[userId] || 0;
      return { userId, bytesUsed: bytes };
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
