const https = require('https');
const http = require('http');
const VpnService = require('./VpnService');
const SSHExecutor = require('../utils/SSHExecutor');

/**
 * Outline VPN Service (v1.12.3)
 * Manages Outline VPN server operations via API
 */
class OutlineService extends VpnService {
  constructor(server) {
    super(server);
    this.server = server;
    this.outline = server.outline || {};
    this.baseUrl = this.outline.apiBaseUrl;
    this.apiPort = this.outline.apiPort || 8081;
    this.adminAccessKey = this.outline.adminAccessKey;
    this.certSha256 = this.outline.certSha256;
    this.accessMethod = this.outline.accessMethod || 'api';
    this.requestTimeout = 10000; // 10 second timeout

    if (this.accessMethod === 'ssh') {
      this.executor = new SSHExecutor(server);
    }
  }

  /**
   * Make HTTPS/HTTP request to Outline API
   * Outline API format: /{adminAccessKey}/{endpoint}
   */
  async makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
      // Use http for localhost, https for remote servers
      const isLocal = (this.baseUrl || this.server.host).includes('localhost') || 
                      (this.baseUrl || this.server.host).includes('127.0.0.1');
      const protocol = isLocal ? http : https;

      const options = {
        hostname: this.baseUrl || this.server.host,
        port: this.apiPort,
        path: `/${this.adminAccessKey}/${path}`,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        rejectUnauthorized: false, // Handle self-signed cert
        timeout: this.requestTimeout,
      };

      let timedOut = false;

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (timedOut) return;
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = data ? JSON.parse(data) : null;
              resolve(parsed);
            } else {
              reject(new Error(`API Error (${res.statusCode}): ${data || 'No response'}`));
            }
          } catch (err) {
            reject(new Error(`Failed to parse API response: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => {
        if (timedOut) return;
        if (err.code === 'ECONNREFUSED') {
          reject(new Error(`Cannot connect to Outline server at ${options.hostname}:${options.port}. Check host/port configuration.`));
        } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
          reject(new Error(`Connection timeout. Outline server at ${options.hostname}:${options.port} is not responding.`));
        } else if (err.code === 'ENOTFOUND') {
          reject(new Error(`Host not found: ${options.hostname}. Check hostname/IP address.`));
        } else {
          reject(new Error(`Request failed: ${err.message}`));
        }
      });

      req.on('timeout', () => {
        timedOut = true;
        req.destroy();
        reject(new Error(`Request timeout: Outline server at ${options.hostname}:${options.port} is not responding within ${this.requestTimeout}ms`));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  /**
   * Initialize Outline VPN server
   */
  async initialize() {
    try {
      const serverInfo = await this.makeRequest('GET', 'server');
      return {
        success: true,
        serverId: serverInfo.serverId,
        version: serverInfo.version,
        portForNewAccessKeys: serverInfo.portForNewAccessKeys,
        message: 'Outline server initialized successfully',
      };
    } catch (error) {
      throw new Error(`Failed to initialize Outline server: ${error.message}`);
    }
  }

  /**
   * Add a new user (access key) to Outline
   */
  async addUser(userData) {
    try {
      const { name, limit } = userData;

      // Create access key via API
      const createKeyBody = {
        name: name || `User-${Date.now()}`,
      };

      if (limit && limit > 0) {
        createKeyBody.limit = { bytes: limit };
      }

      console.log('[OutlineService] Creating access key with body:', createKeyBody);
      const response = await this.makeRequest('POST', 'access-keys', createKeyBody);

      console.log('[OutlineService] Access key created, response:', response);

      return {
        success: true,
        accessKeyId: response.id,
        name: response.name || createKeyBody.name,
        accessUrl: response.accessUrl,
        dataLimit: response.dataLimit || null,
      };
    } catch (error) {
      console.error('[OutlineService] Failed to add user:', error.message);
      throw new Error(`Failed to add user to Outline: ${error.message}`);
    }
  }

  /**
   * Remove a user (access key) from Outline
   */
  async removeUser(accessKeyId) {
    try {
      await this.makeRequest('DELETE', `access-keys/${accessKeyId}`);
      return {
        success: true,
        message: `Access key ${accessKeyId} removed successfully`,
      };
    } catch (error) {
      throw new Error(`Failed to remove user from Outline: ${error.message}`);
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(accessKeyId) {
    try {
      const accessKeysResponse = await this.makeRequest('GET', 'access-keys');
      const metricsData = await this.makeRequest('GET', 'metrics/transfer');
      
      // Find the specific access key - response format: { accessKeys: [...] }
      const accessKeys = accessKeysResponse.accessKeys || [];
      const accessKey = accessKeys.find((key) => key.id === accessKeyId);
      
      if (!accessKey) {
        throw new Error(`Access key ${accessKeyId} not found`);
      }

      const bytesTransferred = metricsData.bytesTransferredByUserId?.[accessKeyId] || 0;

      return {
        accessKeyId: accessKey.id,
        name: accessKey.name,
        bytesUsed: bytesTransferred,
        dataLimit: accessKey.dataLimit || null,
      };
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error.message}`);
    }
  }

  /**
   * Get server statistics
   */
  async getServerStats() {
    try {
      const serverInfo = await this.getServerInfo();
      const accessKeysResponse = await this.makeRequest('GET', 'access-keys');
      const metricsData = await this.makeRequest('GET', 'metrics/transfer');
      
      let totalBytesUsed = 0;
      const accessKeys = accessKeysResponse.accessKeys || [];
      let totalAccessKeys = accessKeys.length;

      if (metricsData.bytesTransferredByUserId) {
        Object.values(metricsData.bytesTransferredByUserId).forEach((bytes) => {
          totalBytesUsed += bytes || 0;
        });
      }

      return {
        serverId: serverInfo.serverId,
        serverVersion: serverInfo.version,
        totalUsers: totalAccessKeys,
        totalDataTransferred: totalBytesUsed,
        portForNewAccessKeys: serverInfo.portForNewAccessKeys,
        uptime: 100, // Outline doesn't provide uptime; assume healthy if responding
        isHealthy: true,
      };
    } catch (error) {
      throw new Error(`Failed to get server stats: ${error.message}`);
    }
  }

  /**
   * Update user configuration
   */
  async updateUserConfig(accessKeyId, config) {
    try {
      const updateBody = {};

      if (config.name) {
        updateBody.name = config.name;
      }

      if (config.dataLimit !== undefined) {
        if (config.dataLimit > 0) {
          updateBody.limit = { bytes: config.dataLimit };
        } else {
          updateBody.limit = null; // Remove limit
        }
      }

      if (Object.keys(updateBody).length === 0) {
        return {
          success: true,
          message: 'No updates needed',
        };
      }

      await this.makeRequest('PUT', `access-keys/${accessKeyId}`, updateBody);

      return {
        success: true,
        message: 'User config updated successfully',
      };
    } catch (error) {
      throw new Error(`Failed to update user config: ${error.message}`);
    }
  }

  /**
   * Update server configuration
   */
  async updateServerConfig(config) {
    try {
      const updateBody = {};

      if (config.portForNewAccessKeys) {
        updateBody.portForNewAccessKeys = config.portForNewAccessKeys;
      }

      if (Object.keys(updateBody).length === 0) {
        return;
      }

      await this.makeRequest('PUT', 'server', updateBody);
    } catch (error) {
      throw new Error(`Failed to update server config: ${error.message}`);
    }
  }

  /**
   * Get server information
   */
  async getServerInfo() {
    try {
      const response = await this.makeRequest('GET', 'server');
      return response;
    } catch (error) {
      throw new Error(`Failed to get server info: ${error.message}`);
    }
  }

  /**
   * Check server health
   */
  /**
   * Check server health
   */
  async checkHealth() {
    try {
      console.log(`[OutlineService] Checking health for server at ${this.baseUrl || this.server.host}:${this.apiPort}`);
      await this.getServerInfo();
      console.log(`[OutlineService] Health check passed`);
      return true;
    } catch (error) {
      console.error(`[OutlineService] Health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get user access configuration (access URL)
   */
  async getUserAccessConfig(accessKeyId) {
    try {
      const accessKeysResponse = await this.makeRequest('GET', 'access-keys');
      const accessKeys = accessKeysResponse.accessKeys || [];
      const accessKey = accessKeys.find((key) => key.id === accessKeyId);

      if (!accessKey) {
        throw new Error(`Access key ${accessKeyId} not found`);
      }

      return accessKey.accessUrl;
    } catch (error) {
      throw new Error(`Failed to get user access config: ${error.message}`);
    }
  }

  /**
   * Rename access key
   */
  async renameUser(accessKeyId, newName) {
    try {
      await this.makeRequest('PUT', `access-keys/${accessKeyId}`, {
        name: newName,
      });

      return {
        success: true,
        message: `Access key renamed to ${newName}`,
      };
    } catch (error) {
      throw new Error(`Failed to rename user: ${error.message}`);
    }
  }

  /**
   * Set data limit for user
   */
  async setDataLimit(accessKeyId, limitBytes) {
    try {
      const body = {
        limit: limitBytes > 0 ? { bytes: limitBytes } : null,
      };

      await this.makeRequest('PUT', `access-keys/${accessKeyId}`, body);

      return {
        success: true,
        message: limitBytes > 0 
          ? `Data limit set to ${limitBytes} bytes` 
          : 'Data limit removed (unlimited)',
      };
    } catch (error) {
      throw new Error(`Failed to set data limit: ${error.message}`);
    }
  }
}

module.exports = OutlineService;
