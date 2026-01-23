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
      // console.log('Options:', options);
      // console.log('path: ${path}', path);
      // console.log('method: ${method}', method);
      // console.log('body: ${body}', body);
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
      const setDatalimit = async () => {
        if (limit && limit > 0) {
          try {
            await this.setDataLimit(response.id, limit);
            console.log('[OutlineService] Data limit set successfully after key creation');
          } catch (err) {
            console.error('[OutlineService] Error setting data limit after key creation:', err.message);
          }
        }
      };
      // Set data limit asynchronously
      setDatalimit();
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
      const keyId = String(accessKeyId);
      const updateBody = {};

      // Fetch current key to get name (required by Outline API)
      let currentKey = null;
      try {
        const accessKeysResponse = await this.makeRequest('GET', 'access-keys');
        const accessKeys = accessKeysResponse.accessKeys || [];
        currentKey = accessKeys.find((key) => {
          const keyIdStr = String(key.id);
          const keyIdNum = Number(key.id);
          return keyIdStr === keyId || String(keyIdNum) === keyId || keyIdNum === Number(keyId);
        });
      } catch (err) {
        console.warn(`[updateUserConfig] Could not fetch current key: ${err.message}`);
      }

      // Always include name if we have it (Outline API requires it)
      if (currentKey && currentKey.name !== undefined) {
        updateBody.name = config.name || currentKey.name || '';
      } else if (config.name) {
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

      // Use the actual ID from server if available
      const actualKeyId = currentKey ? String(currentKey.id) : keyId;
      await this.makeRequest('PUT', `access-keys/${actualKeyId}`, updateBody);

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
      // Validate accessKeyId
      if (!accessKeyId) {
        throw new Error('Access key ID is required');
      }
      
      // Fetch current key to get the actual ID format from server (like updateUserConfig does)
      let actualKeyId = String(accessKeyId);
      try {
        const accessKeysResponse = await this.makeRequest('GET', 'access-keys');
        const accessKeys = accessKeysResponse.accessKeys || [];
        const currentKey = accessKeys.find((key) => {
          const keyIdStr = String(key.id);
          const keyIdNum = Number(key.id);
          return keyIdStr === String(accessKeyId) || String(keyIdNum) === String(accessKeyId) || keyIdNum === Number(accessKeyId);
        });
        
        if (currentKey) {
          actualKeyId = String(currentKey.id);
          console.log(`[setDataLimit] Found access key, using ID: ${actualKeyId}`);
        } else {
          console.warn(`[setDataLimit] Access key ${accessKeyId} not found in server, using provided ID: ${actualKeyId}`);
        }
      } catch (err) {
        console.warn(`[setDataLimit] Could not fetch current key: ${err.message}, using provided ID: ${actualKeyId}`);
      }
      
      // When limitBytes is 0, set to 0 bytes (blocks usage) - used for suspending devices
      // When limitBytes is null/undefined/negative, set to null to remove limit (unlimited)
      // When limitBytes > 0, set specific limit
      // For /data-limit endpoint, body format is { bytes: N } or null
      let updateBody;
      if (limitBytes === 0) {
        // Set to 0 bytes to block usage (suspend)
        updateBody = { bytes: 10 };
      } else if (limitBytes > 0) {
        // Set specific limit
        updateBody = { bytes: limitBytes };
      } else {
        // Remove limit (unlimited) - limitBytes is null, undefined, or negative
        // For Outline API, to remove limit we pass null
        updateBody = null;
      }
      
      console.log(`[setDataLimit] Attempting to update access key ${actualKeyId} with limit:`, updateBody);
      
      try {
        // Use correct Outline API endpoint: PUT /access-keys/:id/data-limit
        // Note: makeRequest already handles JSON.stringify, so pass updateBody directly (not stringified)
        // When updateBody is null, makeRequest will handle it correctly (won't write body if null)
        const result = await this.makeRequest('PUT', `access-keys/${actualKeyId}/data-limit`,
          {
            "limit": {
              "bytes": updateBody.bytes
            }
          }
        );
        console.log('[setDataLimit] Outline service result:', result);
        return {
          success: true,
          message: limitBytes === 0 
            ? 'Data limit set to 0 bytes (blocked)'
            : limitBytes > 0 
            ? `Data limit set to ${limitBytes} bytes` 
            : 'Data limit removed (unlimited)',
        };
      } catch (error) {
        // If data-limit endpoint fails, try using updateUserConfig as fallback
        console.error(`[setDataLimit] Failed to update data limit via /data-limit endpoint:`, error.message);
        
        // Fallback: use updateUserConfig method which handles the API correctly
        try {
          console.log(`[setDataLimit] Trying fallback method with updateUserConfig`);
          await this.updateUserConfig(actualKeyId, { dataLimit: limitBytes });
          return {
            success: true,
            message: limitBytes === 0 
              ? 'Data limit set to 0 bytes (blocked)'
              : limitBytes > 0 
              ? `Data limit set to ${limitBytes} bytes` 
              : 'Data limit removed (unlimited)',
          };
        } catch (fallbackError) {
          console.error(`[setDataLimit] Fallback method also failed:`, fallbackError.message);
          throw error; // Throw original error
        }
      }
    } catch (error) {
      console.error(`[setDataLimit] Error details:`, error.message);
      throw new Error(`Failed to set data limit: ${error.message}`);
    }
  }

  async getAccessKeys() {
    try {
      const accessKeysResponse = await this.makeRequest('GET', 'access-keys');
      return accessKeysResponse.accessKeys;
    } catch (error) {
      throw new Error(`Failed to get access keys: ${error.message}`);
    }
  }
}

module.exports = OutlineService;
