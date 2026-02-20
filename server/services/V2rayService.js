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

      // Normalize base URL / host and determine protocol/port/path.
      // Supports:
      // - bare host/IP (e.g. 1.2.3.4)
      // - full URL with scheme/port/path (e.g. https://example.com/panel/api)
      let hostname = this.server.host;
      let basePath = '';
      let explicitProtocol = null;
      let explicitPort = null;
      let parsedBase = null;

      try {
        parsedBase = new URL(this.baseUrl);
      } catch (e) {
        try {
          // allow parsing bare host/path by injecting temporary scheme
          parsedBase = new URL(`http://${this.baseUrl}`);
        } catch (e2) {
          parsedBase = null;
        }
      }

      if (parsedBase) {
        hostname = parsedBase.hostname || hostname;
        basePath = parsedBase.pathname && parsedBase.pathname !== '/' ? parsedBase.pathname.replace(/\/+$/, '') : '';
        if (/^https?:$/i.test(parsedBase.protocol)) {
          explicitProtocol = parsedBase.protocol.toLowerCase() === 'http:' ? 'http' : 'https';
        }
        if (parsedBase.port) {
          const parsedPort = parseInt(parsedBase.port, 10);
          if (!Number.isNaN(parsedPort)) explicitPort = parsedPort;
        }
      } else {
        hostname = this.baseUrl || hostname;
      }

      const configuredPort = Number(this.v2ray.apiPort);
      const hasConfiguredPort = Number.isFinite(configuredPort) && configuredPort > 0;

      // Historical data often stores default apiPort=8080 even when apiBaseUrl is https://host.
      // If URL has explicit scheme but no explicit port and configuredPort is the default 8080,
      // prefer scheme default first and keep 8080 as fallback.
      const shouldUseSchemeDefaultFirst = !!(explicitProtocol && explicitPort === null && configuredPort === 8080);

      const normalizePath = (requestPath) => {
        const right = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
        if (!basePath) return right;
        return `${basePath}${right}`;
      };

      const attempts = [];
      const addAttempt = (protocol, port) => {
        if (!protocol || !port) return;
        const key = `${protocol}:${port}`;
        if (!attempts.find(a => a.key === key)) {
          attempts.push({ key, protocol, port });
        }
      };

      if (explicitProtocol) {
        const preferredPort = explicitPort
          || (shouldUseSchemeDefaultFirst
            ? (explicitProtocol === 'http' ? 80 : 443)
            : (hasConfiguredPort ? configuredPort : (explicitProtocol === 'http' ? 80 : 443)));

        addAttempt(explicitProtocol, preferredPort);

        // Fallbacks for scheme/port mismatches
        if (hasConfiguredPort && configuredPort !== preferredPort) {
          addAttempt(explicitProtocol, configuredPort);
        }
        addAttempt(explicitProtocol === 'http' ? 'https' : 'http', hasConfiguredPort ? configuredPort : (explicitProtocol === 'http' ? 443 : 80));
        addAttempt(explicitProtocol === 'http' ? 'https' : 'http', explicitProtocol === 'http' ? 443 : 80);
      } else {
        const candidatePort = hasConfiguredPort ? configuredPort : (this.server.port || 80);
        const preferHttp = hostname.includes('localhost') || hostname.includes('127.0.0.1') || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

        if (preferHttp) {
          addAttempt('http', candidatePort);
          addAttempt('https', candidatePort);
        } else {
          addAttempt('https', candidatePort);
          addAttempt('http', candidatePort);
        }
        addAttempt('http', 80);
        addAttempt('https', 443);
      }

      const tryAttempt = (index) => {
        if (index >= attempts.length) {
          return reject(new Error(`Cannot connect to v2ray API at ${hostname} using HTTP/HTTPS`));
        }

        const current = attempts[index];
        const protocolModule = current.protocol === 'http' ? http : https;

        const options = {
          hostname,
          port: current.port,
          path: normalizePath(path),
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: this.requestTimeout,
        };

        if (current.protocol === 'https') {
          options.rejectUnauthorized = (this.v2ray && this.v2ray.tlsVerify !== false);
        }

        if (this.apiToken) {
          options.headers.Authorization = `Bearer ${this.apiToken}`;
        }

        const req = protocolModule.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            // Try to parse JSON, but fall back to returning raw text when parsing fails.
            if (res.statusCode < 200 || res.statusCode >= 300) {
              // Non-2xx: return an error with body preserved
              return reject(new Error(`API Error (${res.statusCode}): ${data || 'No response'}`));
            }

            if (!data) return resolve(null);

            try {
              const parsed = JSON.parse(data);
              return resolve(parsed);
            } catch (err) {
              // Not JSON — log and return raw text so callers can decide how to handle it
              console.warn(`[V2rayService.makeRequest] Response not JSON for ${options.hostname}:${options.port}${options.path} — returning raw text`);
              return resolve({ __raw: data });
            }
          });
        });

        req.on('error', (err) => {
          const msg = err && err.message ? err.message : String(err);

          // Protocol/connection mismatch, try the next protocol/port candidate.
          if (
            err.code === 'ECONNREFUSED'
            || err.code === 'ECONNRESET'
            || err.code === 'ETIMEDOUT'
            || err.code === 'EPROTO'
            || /wrong version number|ssl3_get_record|SSL routines|socket hang up/i.test(msg)
          ) {
            return tryAttempt(index + 1);
          }

          return reject(new Error(`Request failed: ${msg}`));
        });

        req.on('timeout', () => {
          req.destroy(new Error('Request timeout'));
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
      };

      tryAttempt(0);
    });
  }

  async checkHealth() {
    if (this.accessMethod === 'ssh') {
      const result = await this.executor.testConnection();
      return result.success;
    }
    const healthPaths = ['status', 'health', ''];
    for (const healthPath of healthPaths) {
      try {
        const resp = await this.makeRequest('GET', healthPath);
        return !!resp;
      } catch (err) {
        // try next endpoint
      }
    }
    return false;
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
        
        // Generate VMess client config with server details and CF proxy settings
        const vmessOptions = {
          useTls: this.server.v2ray?.useTls || false,
          network: this.server.v2ray?.network || 'tcp',
          wsPath: this.server.v2ray?.wsPath || '/vpn',
          sni: this.server.v2ray?.sni || this.server.v2ray?.publicHost || this.server.host,
          alpn: this.server.v2ray?.alpn || 'h2,http/1.1',
          fingerprint: this.server.v2ray?.fingerprint || 'chrome',
        };
        
        const vmessConfig = this.generateVmessClientConfig(
          parsed.userId,
          name || 'device',
          this.server.v2ray?.publicHost || this.server.host,
          this.server.port || 10000,
          vmessOptions
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
            
            // Generate VMess client config with server details and CF proxy settings
            const vmessOptions = {
              useTls: this.server.v2ray?.useTls || false,
              network: this.server.v2ray?.network || 'tcp',
              wsPath: this.server.v2ray?.wsPath || '/vpn',
              sni: this.server.v2ray?.sni || this.server.v2ray?.publicHost || this.server.host,
              alpn: this.server.v2ray?.alpn || 'h2,http/1.1',
              fingerprint: this.server.v2ray?.fingerprint || 'chrome',
            };
            
            const vmessConfig = this.generateVmessClientConfig(
              parsed2.userId,
              name || 'device',
              this.server.v2ray?.publicHost || this.server.host,
              this.server.port || 10000,
              vmessOptions
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
   * Returns vmess://base64 with proper CF proxy support (WebSocket+TLS)
   * @param {string} uuid - User UUID
   * @param {string} name - Device name
   * @param {string} host - Server host/domain
   * @param {number} port - Server port
   * @param {object} options - Additional config (useTls, network, wsPath, sni, alpn, fingerprint)
   */
  generateVmessClientConfig(uuid, name, host, port = 10000, options = {}) {
    try {
      const config = {
        v: '2',
        ps: name || 'device',
        add: host,
        port: String(port),
        id: uuid,
        aid: '0',
        net: options.network || 'tcp',
        type: 'none',
        host: host,
      };

      // Add TLS settings if enabled (Cloudflare proxy)
      if (options.useTls) {
        config.tls = 'tls';
        config.sni = options.sni || host;
        config.alpn = options.alpn || 'h2,http/1.1';
        config.fp = options.fingerprint || 'chrome';
      }

      // Add WebSocket settings if network is ws
      if (config.net === 'ws') {
        config.path = options.wsPath || '/vpn';
      }

      // Add optional fields for better compatibility
      config.mode = '';
      config.serviceName = 'none';
      config.fragment = '';
      config.deviceID = '';
      config.seed = '';
      config.headerType = '';
      config.extra = '';

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

      // Add client with level:0 to enable per-user stats tracking
      inbound.settings.clients.push({
        id: String(userId),
        alterId: 0,
        email: name || `device-${String(userId).slice(0, 8)}`,
        level: 0,
      });

      const updated = JSON.stringify(config, null, 2);
      await this.writeRemoteFile(configPath, updated);
      await this.restartRemoteService(configPath);

      return { changed: true, configPath };
    }

    throw new Error(lastError || 'No VMess inbound found in any config; cannot add user');
  }

  async ensureUserRemovedFromConfig(userId, name) {
    if (!userId && !name) return { changed: false, reason: 'missing-user-id-and-name' };
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

      const beforeCount = inbound.settings.clients.length;
      inbound.settings.clients = inbound.settings.clients.filter((client) => {
        if (!client) return false;
        const byId = userId && String(client.id) === String(userId);
        const byName = name && String(client.email) === String(name);
        return !(byId || byName);
      });

      const removedCount = beforeCount - inbound.settings.clients.length;
      if (removedCount <= 0) {
        return { changed: false, reason: 'not-found', configPath };
      }

      const updated = JSON.stringify(config, null, 2);
      await this.writeRemoteFile(configPath, updated);
      await this.restartRemoteService(configPath);
      return { changed: true, removedCount, configPath };
    }

    throw new Error(lastError || 'No VMess inbound found in any config; cannot remove user');
  }

  async suspendUser(userId, name) {
    if (!userId && !name) throw new Error('User id or name required');

    if (this.accessMethod === 'ssh' && this.executor) {
      return this.ensureUserRemovedFromConfig(userId, name);
    }

    // API fallback (if available)
    const identifier = name || userId;
    return this.setDataLimit(identifier, 0);
  }

  async resumeUser(userId, name) {
    if (!userId && !name) throw new Error('User id or name required');

    if (this.accessMethod === 'ssh' && this.executor) {
      if (!userId) throw new Error('User id required to resume SSH-managed V2Ray user');
      return this.ensureUserInConfig(userId, name);
    }

    // API fallback (if available)
    const identifier = name || userId;
    return this.setDataLimit(identifier, null);
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
    const callApiRemoval = async () => {
      try {
        await this.makeRequest('DELETE', `users/${userIdentifier}`);
        return { success: true, removed: userIdentifier };
      } catch (err) {
        console.warn(`[V2rayService] Failed to remove v2ray user ${userIdentifier} via API: ${err.message}`);
        return { success: true, removed: userIdentifier, warning: 'API removal failed, but continuing' };
      }
    };

    if (this.accessMethod === 'ssh') {
      const hasCredentials = this.executor && this.executor.sshConfig &&
        (this.executor.sshConfig.privateKey || this.executor.sshConfig.password);
      if (!hasCredentials) {
        console.warn('[V2rayService] SSH removal requested but no SSH credentials configured, falling back to API');
        return callApiRemoval();
      }

      const cmd = `v2ray-cli remove-user "${userIdentifier}"`;
      console.log(`[V2rayService] Executing SSH command: ${cmd}`);
      try {
        const result = await this.executor.executeCommand(cmd);
        console.log(`[V2rayService] SSH command output:`, result);
        return { success: true, removed: userIdentifier, output: result };
      } catch (err) {
        const message = err?.message || '';
        console.error(`[V2rayService] SSH command failed for user "${userIdentifier}":`, message);
        if (message.includes('SSH authentication credentials not provided')) {
          console.warn('[V2rayService] Detected missing SSH credentials, attempting API fallback');
          return callApiRemoval();
        }
        console.warn(`[V2rayService] Continuing with deletion despite SSH error`);
        return { success: true, removed: userIdentifier, warning: 'SSH removal failed, but continuing', error: message };
      }
    }

    return callApiRemoval();
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

    console.log(`[V2rayService.getUserStats] Fetching stats for user: ${userId}, accessMethod: ${this.accessMethod}`);

    // Check if SSH credentials are available (even if not primary method)
    const hasSSHCredentials = this.executor?.sshConfig && 
      (this.executor.sshConfig.privateKey || this.executor.sshConfig.password);

    if (this.accessMethod === 'ssh' || (!this.baseUrl && hasSSHCredentials)) {
      // Initialize executor if not already done
      if (!this.executor) {
        this.executor = new SSHExecutor(this.server);
      }

      console.log(`[V2rayService.getUserStats] Using SSH method for user ${userId}`);

      // 1) Try v2ray-cli helper
      const cmd = `v2ray-cli stats ${userId}`;
      let helperOut = null;
      try {
        helperOut = await this.executor.executeCommand(cmd);
        console.log(`[V2rayService.getUserStats] v2ray-cli response:`, helperOut?.substring(0, 200));
      } catch (err) {
        console.log(`[V2rayService.getUserStats] v2ray-cli  failed:`, err.message);
      }

      // If helper produced output, try to interpret it
      if (helperOut) {
        try {
          const parsedOut = JSON.parse(helperOut);
          if (parsedOut && ((typeof parsedOut.bytesUsed === 'number' && parsedOut.bytesUsed > 0) || parsedOut.uplink || parsedOut.downlink)) {
            console.log(`[V2rayService.getUserStats] Got stats from v2ray-cli:`, parsedOut);
            return parsedOut;
          }
        } catch (e) {
          const numeric = Number(helperOut) || 0;
          if (numeric > 0) {
            console.log(`[V2rayService.getUserStats] Got numeric stats: ${numeric}`);
            return { bytesUsed: numeric };
          }
        }
      }

      // 2) SSH fallback: query xray API via SSH
      try {
        // First try exact pattern
        const apiCmd = `xray api statsquery -pattern "user>>>${userId}>>>traffic"`;
        console.log(`[V2rayService.getUserStats] Executing: ${apiCmd}`);
        const out2 = await this.executor.executeCommand(apiCmd);
        console.log(`[V2rayService.getUserStats] xray api response length: ${out2?.length}`);
        
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
            console.log(`[V2rayService.getUserStats] Stats from specific pattern: uplink=${uplink}, downlink=${downlink}, total=${total}`);
            return { userId, bytesUsed: total, uplink, downlink };
          } else {
            console.log(`[V2rayService.getUserStats] Specific pattern returned empty or invalid stat array`);
          }
        } catch (e2) {
          console.log(`[V2rayService.getUserStats] Failed to parse specific pattern response:`, e2.message);
        }

        // If specific pattern returned nothing, request all stats
        try {
          console.log(`[V2rayService.getUserStats] Trying all stats query...`);
          const outAll = await this.executor.executeCommand('xray api statsquery -pattern ""');
          const parsedAll = JSON.parse(outAll);
          if (Array.isArray(parsedAll.stat)) {
            console.log(`[V2rayService.getUserStats] Total stats entries: ${parsedAll.stat.length}`);
            let uplink = 0;
            let downlink = 0;
            let foundMatch = false;
            for (const s of parsedAll.stat) {
              if (!s || !s.name) continue;
              if (s.name.includes(`user>>>${userId}>>>traffic`)) {
                console.log(`[V2rayService.getUserStats] Found matching stat: ${s.name} = ${s.value}`);
                foundMatch = true;
                if (s.name.endsWith('uplink')) uplink = Number(s.value) || 0;
                if (s.name.endsWith('downlink')) downlink = Number(s.value) || 0;
              }
            }
            const total = uplink + downlink;
            if (foundMatch || parsedAll.stat.length > 0) {
              console.log(`[V2rayService.getUserStats] Final stats: uplink=${uplink}, downlink=${downlink}, total=${total}`);
            } else {
              console.log(`[V2rayService.getUserStats] No matching stats found for user ${userId}`);
            }
            return { userId, bytesUsed: total, uplink, downlink };
          }
        } catch (e3) {
          console.log(`[V2rayService.getUserStats] All stats query failed:`, e3.message);
        }
      } catch (err2) {
        console.error(`[V2rayService.getUserStats] SSH xray api query failed:`, err2.message);
      }

      // If SSH method failed and API is available, try API as fallback
      if (this.baseUrl) {
        console.log(`[V2rayService.getUserStats] SSH failed, trying API fallback...`);
      } else {
        console.log(`[V2rayService.getUserStats] No more methods available, returning zero stats`);
        return { userId, bytesUsed: 0, uplink: 0, downlink: 0 };
      }
    }

    // Try API method
    try {
      console.log(`[V2rayService.getUserStats] Using HTTP API method, baseUrl: ${this.baseUrl}`);
      const resp = await this.makeRequest('GET', `metrics/transfer`);
      
      // Common API shapes:
      // 1) { bytesTransferredByUserId: { [userId]: N } }
      // 2) { stat: [ { name: 'user>>><id>>>traffic>>>uplink', value: N }, ... ] }
      const bytesFromMap = resp?.bytesTransferredByUserId?.[userId];
      if (typeof bytesFromMap === 'number') {
        console.log(`[V2rayService.getUserStats] Got stats from API: ${bytesFromMap}`);
        return { userId, bytesUsed: bytesFromMap };
      }

      // Fallback: parse stat array entries
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
        console.log(`[V2rayService.getUserStats] Got stats from API stat array: uplink=${uplink}, downlink=${downlink}`);
        return { userId, bytesUsed: total, uplink, downlink };
      }

      console.log(`[V2rayService.getUserStats] API returned no matching stats`);
      return { userId, bytesUsed: 0 };
    } catch (err) {
      console.error(`[V2rayService.getUserStats] API method failed:`, err.message);
      
      // If API was primary method and SSH is available, try SSH as last resort
      if (this.accessMethod === 'api' && hasSSHCredentials) {
        console.log(`[V2rayService.getUserStats] API failed, trying SSH as last resort...`);
        const origMethod = this.accessMethod;
        this.accessMethod = 'ssh';
        try {
          const result = await this.getUserStats(userId);
          this.accessMethod = origMethod;
          return result;
        } catch (sshErr) {
          this.accessMethod = origMethod;
          console.error(`[V2rayService.getUserStats] SSH fallback also failed:`, sshErr.message);
        }
      }
      
      throw new Error(`Failed to get v2ray user stats: ${err.message}`);
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
    console.log(`[V2rayService.getServerStats] Fetching server stats, accessMethod: ${this.accessMethod}`);
    
    if (this.accessMethod === 'ssh' && this.executor) {
      // Query all stats via SSH and parse them
      try {
        const out = await this.executor.executeCommand('xray api statsquery -pattern ""');
        const parsed = JSON.parse(out);
        
        if (!Array.isArray(parsed.stat)) {
          console.warn('[V2rayService.getServerStats] SSH query returned invalid format');
          return {};
        }
        
        console.log(`[V2rayService.getServerStats] SSH query returned ${parsed.stat.length} stat entries`);
        
        // Build bytesTransferredByUserId map from stat entries
        // Stats are in format: "user>>>UUID>>>traffic>>>uplink" and "user>>>UUID>>>traffic>>>downlink"
        const bytesTransferredByUserId = {};
        
        for (const s of parsed.stat) {
          if (!s || !s.name) continue;
          
          // Match user stats: user>>>IDENTIFIER>>>traffic>>>uplink/downlink
          const match = s.name.match(/^user>>>([^>]+)>>>traffic>>>(uplink|downlink)$/);
          if (!match) continue;
          
          const userId = match[1];
          const direction = match[2];
          const value = Number(s.value) || 0;
          
          if (!bytesTransferredByUserId[userId]) {
            bytesTransferredByUserId[userId] = 0;
          }
          
          bytesTransferredByUserId[userId] += value;
          console.log(`[V2rayService.getServerStats] Found user stat: ${userId} ${direction}=${value}`);
        }
        
        console.log(`[V2rayService.getServerStats] Built stats for ${Object.keys(bytesTransferredByUserId).length} users`);
        return { bytesTransferredByUserId };
      } catch (err) {
        console.error(`[V2rayService.getServerStats] SSH query failed:`, err.message);
        return {};
      }
    }
    
    // API method fallback
    try {
      const resp = await this.makeRequest('GET', 'metrics/transfer');
      console.log(`[V2rayService.getServerStats] API query successful`);
      return resp || {};
    } catch (err) {
      console.error(`[V2rayService.getServerStats] API query failed:`, err.message);
      return {};
    }
  }
}

module.exports = V2rayService;
