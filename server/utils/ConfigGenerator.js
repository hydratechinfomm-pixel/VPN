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
