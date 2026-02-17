const { Client } = require('ssh2');
const { decryptString } = require('./crypto');

class SSHExecutor {
  constructor(server) {
    this.server = server;
    // Prefer an SSH config that actually contains credentials (privateKey/password/host/username).
    // Pick the first config that has usable authentication info; otherwise fall back to the first defined config.
    const candidates = [server.v2ray?.ssh, server.outline?.ssh, server.wireguard?.ssh, server.ssh];
    this.sshConfig = candidates.find(cfg => cfg && (cfg.privateKey || cfg.password || cfg.host || cfg.username))
      || (server.v2ray?.ssh || server.outline?.ssh || server.wireguard?.ssh || server.ssh || {});

    // If privateKey is stored encrypted (prefix ENC:), decrypt it now so ssh2 receives the raw key
    if (this.sshConfig && this.sshConfig.privateKey && typeof this.sshConfig.privateKey === 'string') {
      const keyVal = this.sshConfig.privateKey;
      if (keyVal.startsWith('ENC:')) {
        try {
          this.sshConfig.privateKey = decryptString(keyVal.replace(/^ENC:/, ''));
        } catch (e) {
          // leave as-is; error will surface during connection attempt
        }
      }
    }
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
        const finalCommand = this.wrapSudoCommand(command);
        conn.exec(finalCommand, (err, stream) => {
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

  wrapSudoCommand(command) {
    const trimmed = String(command || '').trim();
    if (!trimmed.startsWith('sudo ')) return command;

    if (this.sshConfig && this.sshConfig.password) {
      const escaped = String(this.sshConfig.password).replace(/'/g, `'"'"'`);
      const sudoPart = trimmed.replace(/^sudo\s+/, 'sudo -S -p "" ');
      return `printf '%s\n' '${escaped}' | ${sudoPart}`;
    }

    return command;
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
