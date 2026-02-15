const QRCode = require('qrcode');

class ConfigGenerator {
  /**
   * Generate WireGuard configuration file content
   */
  static generateConfig(device, server) {
    const wg = server.wireguard || {};
    const interfaceName = wg.interfaceName || 'wg0';
    const serverPublicKey = wg.serverPublicKey || '';
    const serverHost = server.host;
    const serverPort = wg.port || 51820;
    const vpnIp = device.vpnIp;

    const config = `[Interface]
PrivateKey = ${device.privateKey}
Address = ${vpnIp}/32
DNS = 8.8.8.8, 8.8.4.4

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${serverHost}:${serverPort}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;

    return config;
  }

  /**
   * Generate VMess (VMess URL) for V2Ray devices
   * - Prefer existing device.configFile or device.v2rayUser.clientConfig
   * - Fallback to a minimal vmess:// URL constructed from server/device fields
   */
  static generateVmess(device, server) {
    // If device already has a vmess URL or JSON, return/normalize it
    if (device?.configFile) {
      const cfg = String(device.configFile).trim();
      if (cfg.startsWith('vmess://')) return cfg;
      try {
        const parsed = JSON.parse(cfg);
        const vmessB64 = Buffer.from(JSON.stringify(parsed)).toString('base64');
        return `vmess://${vmessB64}`;
      } catch (err) {
        // not JSON — return raw config
        return cfg;
      }
    }

    // Prefer v2rayUser.clientConfig when available
    const v2user = device?.v2rayUser;
    if (v2user && v2user.clientConfig) {
      const cfg = String(v2user.clientConfig).trim();
      if (cfg.startsWith('vmess://')) return cfg;
      try {
        const parsed = JSON.parse(cfg);
        const vmessB64 = Buffer.from(JSON.stringify(parsed)).toString('base64');
        return `vmess://${vmessB64}`;
      } catch (err) {
        return cfg;
      }
    }

    // Fallback: construct a minimal VMess JSON and return vmess://<base64(json)>
    const host = (server && (server.v2ray?.apiBaseUrl || server.host)) || '127.0.0.1';
    const port = (server && (server.v2ray?.inboundsPort || server.port)) || 443;
    const id = (v2user && (v2user.userId || v2user.id)) || String(device._id || Date.now());

    const vmessObj = {
      v: '2',
      ps: device.name || 'v2ray-user',
      add: host,
      port: String(port),
      id: String(id),
      aid: '0',
      net: 'tcp',
      type: 'none',
      host: '',
      path: '',
      tls: (String(port) === '443' || (server && server.port === 443)) ? 'tls' : ''
    };

    const vmessB64 = Buffer.from(JSON.stringify(vmessObj)).toString('base64');
    return `vmess://${vmessB64}`;
  }

  /**
   * Generate QR code from config
   */
  static async generateQRCode(config) {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(config, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });
      return qrCodeDataURL;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate QR code as buffer
   */
  static async generateQRCodeBuffer(config) {
    try {
      const buffer = await QRCode.toBuffer(config, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300,
        margin: 1,
      });
      return buffer;
    } catch (error) {
      throw new Error(`Failed to generate QR code buffer: ${error.message}`);
    }
  }
}

module.exports = ConfigGenerator;
