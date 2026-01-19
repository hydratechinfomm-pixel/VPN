const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const SSHExecutor = require('../utils/SSHExecutor');
const ipaddr = require('ipaddr.js');

const execAsync = promisify(exec);

class WireGuardService {
  constructor(server) {
    this.server = server;
    this.wg = server.wireguard || {};
    this.interfaceName = this.wg.interfaceName || 'wg0';
    this.accessMethod = this.wg.accessMethod || 'local';
    
    if (this.accessMethod === 'ssh') {
      this.executor = new SSHExecutor(server);
    }
  }

  /**
   * Execute a command locally or via SSH
   */
  async executeCommand(command) {
    if (this.accessMethod === 'ssh') {
      return await this.executor.executeCommand(command);
    } else {
      // Local execution
      try {
        const { stdout, stderr } = await execAsync(command);
        if (stderr && !stderr.includes('Warning')) {
          throw new Error(stderr);
        }
        return stdout;
      } catch (error) {
        throw new Error(`Command failed: ${error.message}`);
      }
    }
  }

  /**
   * Generate WireGuard key pair
   */
  async generateKeyPair() {
    try {
      // Generate private key
      const privateKeyOutput = await this.executeCommand('wg genkey');
      const privateKey = privateKeyOutput.trim();

      // Generate public key from private key
      const publicKeyOutput = await this.executeCommand(`echo "${privateKey}" | wg pubkey`);
      const publicKey = publicKeyOutput.trim();

      return { privateKey, publicKey };
    } catch (error) {
      throw new Error(`Failed to generate key pair: ${error.message}`);
    }
  }

  /**
   * Get server public key
   */
  async getServerPublicKey() {
    try {
      const output = await this.executeCommand(`wg show ${this.interfaceName} public-key`);
      return output.trim();
    } catch (error) {
      throw new Error(`Failed to get server public key: ${error.message}`);
    }
  }

  /**
   * Add peer to WireGuard interface
   */
  async addPeer(device) {
    try {
      const { publicKey, vpnIp } = device;
      const allowedIPs = `${vpnIp}/32`;

      // Add peer using wg set command
      const command = `wg set ${this.interfaceName} peer ${publicKey} allowed-ips ${allowedIPs}`;
      await this.executeCommand(command);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to add peer: ${error.message}`);
    }
  }

  /**
   * Remove peer from WireGuard interface
   */
  async removePeer(publicKey) {
    try {
      const command = `wg set ${this.interfaceName} peer ${publicKey} remove`;
      await this.executeCommand(command);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to remove peer: ${error.message}`);
    }
  }

  /**
   * Get peer statistics
   */
  async getPeerStats() {
    try {
      const output = await this.executeCommand(`wg show ${this.interfaceName} dump`);
      const peers = this.parsePeerStats(output);
      return peers;
    } catch (error) {
      throw new Error(`Failed to get peer stats: ${error.message}`);
    }
  }

  /**
   * Parse wg show dump output
   */
  parsePeerStats(output) {
    const lines = output.trim().split('\n');
    const peers = {};

    // Skip first line (interface info)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split('\t');
      if (parts.length >= 6) {
        const publicKey = parts[0];
        const endpoint = parts[2];
        const allowedIPs = parts[3];
        const lastHandshake = parts[4] !== '0' ? new Date(parseInt(parts[4]) * 1000) : null;
        const transferRx = parseInt(parts[5]) || 0;
        const transferTx = parseInt(parts[6]) || 0;
        const persistentKeepalive = parts[7] || 'off';

        peers[publicKey] = {
          publicKey,
          endpoint,
          allowedIPs,
          lastHandshake,
          transferRx,
          transferTx,
          persistentKeepalive,
        };
      }
    }

    return peers;
  }

  /**
   * Get server status
   */
  async getServerStatus() {
    try {
      const output = await this.executeCommand(`wg show ${this.interfaceName}`);
      const isRunning = output.includes(this.interfaceName);
      
      const stats = await this.getPeerStats();
      const peerCount = Object.keys(stats).length;

      return {
        isRunning,
        interfaceName: this.interfaceName,
        peerCount,
        peers: stats,
      };
    } catch (error) {
      return {
        isRunning: false,
        error: error.message,
      };
    }
  }

  /**
   * Assign unused VPN IP from range
   */
  async assignVPNIP(existingIPs = []) {
    try {
      const ipRange = this.wg.vpnIpRange || '10.0.0.0/24';
      const [network, prefixLength] = ipRange.split('/');
      const prefix = parseInt(prefixLength, 10);
      
      const networkAddr = ipaddr.process(network);
      if (networkAddr.kind() !== 'ipv4') {
        throw new Error('Only IPv4 ranges are supported');
      }

      const networkNum = networkAddr.toByteArray().reduce((acc, byte) => (acc << 8) + byte, 0);
      const hostBits = 32 - prefix;
      const totalHosts = Math.pow(2, hostBits);
      
      // For /24 network (10.0.0.0/24):
      // - 10.0.0.0 = Network address (skip)
      // - 10.0.0.1 = Server IP (skip - reserved for WireGuard server)
      // - 10.0.0.2 to 10.0.0.254 = Client IPs (usable)
      // - 10.0.0.255 = Broadcast address (skip)
      // Start from offset 2 to skip network (0) and server (1)
      // End before broadcast address
      const startOffset = 2; // Skip network (0) and server (1)
      const endOffset = 1; // Skip broadcast address

      // Generate available IPs
      for (let i = startOffset; i < totalHosts - endOffset; i++) {
        const ipNum = networkNum + i;
        const ipBytes = [
          (ipNum >>> 24) & 0xff,
          (ipNum >>> 16) & 0xff,
          (ipNum >>> 8) & 0xff,
          ipNum & 0xff,
        ];
        const ip = ipBytes.join('.');
        
        if (!existingIPs.includes(ip)) {
          return ip;
        }
      }

      throw new Error('No available IP addresses in range');
    } catch (error) {
      throw new Error(`Failed to assign VPN IP: ${error.message}`);
    }
  }

  /**
   * Sync usage from all peers
   */
  async syncUsage(devices) {
    try {
      const peerStats = await this.getPeerStats();
      const updates = [];

      for (const device of devices) {
        const stats = peerStats[device.publicKey];
        if (stats) {
          updates.push({
            deviceId: device._id,
            bytesReceived: stats.transferRx,
            bytesSent: stats.transferTx,
            lastHandshake: stats.lastHandshake,
            isConnected: stats.lastHandshake !== null && 
              (Date.now() - stats.lastHandshake.getTime()) < 180000, // Connected if handshake within 3 minutes
          });
        }
      }

      return updates;
    } catch (error) {
      throw new Error(`Failed to sync usage: ${error.message}`);
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const status = await this.getServerStatus();
      return {
        healthy: status.isRunning,
        status,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Test connection (SSH or local)
   */
  async testConnection() {
    if (this.accessMethod === 'ssh') {
      return await this.executor.testConnection();
    } else {
      // Test local WireGuard
      try {
        await this.executeCommand('which wg');
        return { success: true };
      } catch (error) {
        return { success: false, error: 'WireGuard tools not found' };
      }
    }
  }
}

module.exports = WireGuardService;
