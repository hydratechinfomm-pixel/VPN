const { Client } = require('ssh2');

class SSHExecutor {
  constructor(server) {
    this.server = server;
    this.sshConfig = server.wireguard?.ssh || {};
  }

  /**
   * Execute a command via SSH
   */
  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      
      const config = {
        host: this.sshConfig.host || this.server.host,
        port: this.sshConfig.port || 22,
        username: this.sshConfig.username,
        readyTimeout: 20000,
      };

      // Use password or private key
      if (this.sshConfig.privateKey) {
        config.privateKey = this.sshConfig.privateKey;
      } else if (this.sshConfig.password) {
        config.password = this.sshConfig.password;
      } else {
        return reject(new Error('SSH authentication credentials not provided'));
      }

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          let stdout = '';
          let stderr = '';

          stream.on('close', (code, signal) => {
            conn.end();
            if (code !== 0) {
              return reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
            }
            resolve(stdout);
          });

          stream.on('data', (data) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data) => {
            stderr += data.toString();
          });
        });
      });

      conn.on('error', (err) => {
        reject(err);
      });

      conn.connect(config);
    });
  }

  /**
   * Check if SSH connection is available
   */
  async testConnection() {
    try {
      await this.executeCommand('echo "test"');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = SSHExecutor;
