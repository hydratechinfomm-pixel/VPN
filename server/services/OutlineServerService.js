const axios = require('axios');
const https = require('https');

class OutlineServerService {
  constructor(server) {
    this.server = server;
    this.apiUrl = server.apiUrl;
    this.timeout = 10000;
  }

  // Create axios instance with certificate validation bypassed for testing
  getAxiosInstance() {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Only for testing/self-signed certs
    });

    return axios.create({
      baseURL: this.apiUrl,
      timeout: this.timeout,
      httpsAgent,
    });
  }

  /**
   * Create a new access key
   */
  async createAccessKey(name, dataLimit = null) {
    try {
      const client = this.getAxiosInstance();
      const payload = { name };

      if (dataLimit) {
        payload.dataLimit = { bytes: dataLimit };
      }

      const response = await client.post('/access-keys', payload);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create access key: ${error.message}`
      );
    }
  }

  /**
   * Get all access keys
   */
  async getAccessKeys() {
    try {
      const client = this.getAxiosInstance();
      const response = await client.get('/access-keys');
      return response.data.accessKeys || [];
    } catch (error) {
      throw new Error(`Failed to fetch access keys: ${error.message}`);
    }
  }

  /**
   * Get specific access key
   */
  async getAccessKey(keyId) {
    try {
      const client = this.getAxiosInstance();
      const response = await client.get(`/access-keys/${keyId}`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch access key: ${error.message}`
      );
    }
  }

  /**
   * Delete access key
   */
  async deleteAccessKey(keyId) {
    try {
      const client = this.getAxiosInstance();
      await client.delete(`/access-keys/${keyId}`);
      return { success: true };
    } catch (error) {
      throw new Error(
        `Failed to delete access key: ${error.message}`
      );
    }
  }

  /**
   * Rename access key
   */
  async renameAccessKey(keyId, name) {
    try {
      const client = this.getAxiosInstance();
      const response = await client.put(`/access-keys/${keyId}/name`, {
        name,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to rename access key: ${error.message}`
      );
    }
  }

  /**
   * Set data limit for access key
   */
  async setDataLimit(keyId, bytes) {
    try {
      const client = this.getAxiosInstance();
      const response = await client.put(
        `/access-keys/${keyId}/data-limit`,
        { bytes }
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to set data limit: ${error.message}`
      );
    }
  }

  /**
   * Remove data limit
   */
  async removeDataLimit(keyId) {
    try {
      const client = this.getAxiosInstance();
      const response = await client.delete(
        `/access-keys/${keyId}/data-limit`
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to remove data limit: ${error.message}`
      );
    }
  }

  /**
   * Get server info and metrics
   */
  async getServerInfo() {
    try {
      const client = this.getAxiosInstance();
      const response = await client.get('/server');
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch server info: ${error.message}`
      );
    }
  }

  /**
   * Get server metrics
   */
  async getMetrics() {
    try {
      const client = this.getAxiosInstance();
      const response = await client.get('/metrics/transfer');
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch metrics: ${error.message}`
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const client = this.getAxiosInstance();
      const response = await client.get('/server');
      return { healthy: true, data: response.data };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}

module.exports = OutlineServerService;
