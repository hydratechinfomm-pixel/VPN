/**
 * Abstract VpnService base class
 * Defines interface for VPN service implementations (WireGuard, Outline, etc.)
 */
class VpnService {
  constructor(server) {
    if (new.target === VpnService) {
      throw new TypeError('VpnService is abstract and cannot be instantiated directly');
    }
    this.server = server;
  }

  /**
   * Initialize VPN server (setup, generate keys, configure)
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Add/Create a new user on the VPN server
   * @param {Object} userData - User data (name, limit, etc.)
   * @returns {Promise<Object>} User creation result (keys, configs, etc.)
   */
  async addUser(userData) {
    throw new Error('addUser() must be implemented by subclass');
  }

  /**
   * Remove a user from the VPN server
   * @param {string} userId - User ID or key ID
   * @returns {Promise<void>}
   */
  async removeUser(userId) {
    throw new Error('removeUser() must be implemented by subclass');
  }

  /**
   * Get statistics for a specific user
   * @param {string} userId - User ID or key ID
   * @returns {Promise<Object>} User stats (usage, connections, etc.)
   */
  async getUserStats(userId) {
    throw new Error('getUserStats() must be implemented by subclass');
  }

  /**
   * Get statistics for the entire VPN server
   * @returns {Promise<Object>} Server stats (total users, usage, health, etc.)
   */
  async getServerStats() {
    throw new Error('getServerStats() must be implemented by subclass');
  }

  /**
   * Update user configuration (data limit, name, etc.)
   * @param {string} userId - User ID or key ID
   * @param {Object} config - Configuration updates
   * @returns {Promise<Object>} Updated user config
   */
  async updateUserConfig(userId, config) {
    throw new Error('updateUserConfig() must be implemented by subclass');
  }

  /**
   * Update server configuration
   * @param {Object} config - Server configuration updates
   * @returns {Promise<void>}
   */
  async updateServerConfig(config) {
    throw new Error('updateServerConfig() must be implemented by subclass');
  }

  /**
   * Get server info/status
   * @returns {Promise<Object>} Server info
   */
  async getServerInfo() {
    throw new Error('getServerInfo() must be implemented by subclass');
  }

  /**
   * Check server connectivity/health
   * @returns {Promise<boolean>} true if server is healthy
   */
  async checkHealth() {
    throw new Error('checkHealth() must be implemented by subclass');
  }

  /**
   * Get user access configuration (for client connection)
   * @param {string} userId - User ID or key ID
   * @returns {Promise<string>} Access config (URI, file content, etc.)
   */
  async getUserAccessConfig(userId) {
    throw new Error('getUserAccessConfig() must be implemented by subclass');
  }

  /**
   * Rename/update user name
   * @param {string} userId - User ID or key ID
   * @param {string} newName - New user name
   * @returns {Promise<void>}
   */
  async renameUser(userId, newName) {
    throw new Error('renameUser() must be implemented by subclass');
  }

  /**
   * Set data limit for user
   * @param {string} userId - User ID or key ID
   * @param {number} limitBytes - Data limit in bytes (0 for unlimited)
   * @returns {Promise<void>}
   */
  async setDataLimit(userId, limitBytes) {
    throw new Error('setDataLimit() must be implemented by subclass');
  }
}

module.exports = VpnService;
