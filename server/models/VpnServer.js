const mongoose = require('mongoose');
const { encryptString } = require('../utils/crypto');

const vpnServerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    // VPN Type: wireguard, outline or v2ray
    vpnType: {
      type: String,
      enum: ['wireguard', 'outline', 'v2ray'],
      default: 'wireguard',
      required: true,
    },
    host: {
      type: String,
      required: true,
      unique: true,
    },
    port: {
      type: Number,
      required: true,
    },
    apiUrl: {
      type: String,
      required: true,
    },
    apiCertFingerprint: String,
    managementApiPort: {
      type: Number,
      default: 7837,
    },
    accessKeyPort: {
      type: Number,
      default: 8388,
    },
    region: {
      type: String,
      enum: ['US', 'EU', 'ASIA', 'SOUTH_AMERICA', 'AFRICA', 'OCEANIA'],
    },
    country: String,
    city: String,
    provider: {
      type: String,
      enum: ['AWS', 'Google Cloud', 'Azure', 'DigitalOcean', 'Linode', 'Custom'],
      default: 'Custom',
    },
    // Server tier/type for categorization
    serverType: {
      type: String,
      enum: ['REGULAR', 'PREMIUM', 'ENTERPRISE'],
      default: 'REGULAR',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    stats: {
      totalUsers: {
        type: Number,
        default: 0,
      },
      totalDataTransferred: {
        type: Number,
        default: 0,
      },
      uptime: {
        type: Number,
        default: 100,
      },
      lastHealthCheck: Date,
      isHealthy: {
        type: Boolean,
        default: true,
      },
    },
    credentials: {
      apiToken: String,
      password: String,
    },
    settings: {
      ipv6Enabled: Boolean,
      metricsEnabled: {
        type: Boolean,
        default: true,
      },
      allowedCountries: [String],
      blockedCountries: [String],
    },
    // Outline specific fields
    outline: {
      apiBaseUrl: String,
      apiPort: {
        type: Number,
        default: 8081,
      },
      // Certificate SHA256 fingerprint for API verification
      certSha256: String,
      // Admin access key for Outline API
      adminAccessKey: {
        type: String,
        select: false,
      },
      // Access key port for users
      accessKeyPort: {
        type: Number,
        default: 8388,
      },
      // Method to access Outline: 'api' or 'ssh'
      accessMethod: {
        type: String,
        enum: ['api', 'ssh'],
        default: 'api',
      },
      // SSH credentials (if accessMethod is 'ssh')
      ssh: {
        host: String,
        port: {
          type: Number,
          default: 22,
        },
        username: String,
        password: String,
        privateKey: {
          type: String,
          select: false,
        },
      },
      // Outline version
      version: String,
      // Next key ID to use
      nextKeyId: {
        type: Number,
        default: 1,
      },
    },

    // V2Ray specific fields
    v2ray: {
      accessMethod: {
        type: String,
        enum: ['api', 'ssh'],
        default: 'api',
      },
      apiBaseUrl: String,
      apiPort: {
        type: Number,
        default: 8080,
      },
      tlsVerify: {
        type: Boolean,
        default: true,
      },
      apiToken: {
        type: String,
        select: false,
      },
      ssh: {
        host: String,
        port: {
          type: Number,
          default: 22,
        },
        username: String,
        password: String,
        privateKey: {
          type: String,
          select: false,
        },
      },
      // Path to v2ray config for SSH editing
      configPath: {
        type: String,
        default: '/usr/local/etc/v2ray/config.json',
      },
      // Default inbound port
      inboundsPort: Number,
      version: String,
    },
    // WireGuard specific fields
    wireguard: {
      interfaceName: {
        type: String,
        default: 'wg0',
      },
      vpnIpRange: {
        type: String,
        default: '10.0.0.0/24',
      },
      port: {
        type: Number,
        default: 51820,
      },
      serverPublicKey: String,
      serverPrivateKey: {
        type: String,
        select: false, // Don't return private key by default
      },
      // Access method: 'ssh' or 'local'
      accessMethod: {
        type: String,
        enum: ['ssh', 'local'],
        default: 'local',
      },
      // SSH credentials (if accessMethod is 'ssh')
      ssh: {
        host: String,
        port: {
          type: Number,
          default: 22,
        },
        username: String,
        password: String,
        privateKey: {
          type: String,
          select: false,
        },
      },
    },
    devices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
      },
    ],
  },
  { timestamps: true }
);

// Encrypt sensitive v2ray fields at rest (if ENCRYPTION_KEY provided)
vpnServerSchema.pre('save', function (next) {
  try {
    if (this.v2ray) {
      if (this.v2ray.apiToken && typeof this.v2ray.apiToken === 'string' && !this.v2ray.apiToken.startsWith('ENC:')) {
        this.v2ray.apiToken = 'ENC:' + encryptString(this.v2ray.apiToken);
      }
      if (this.v2ray.ssh && this.v2ray.ssh.privateKey && typeof this.v2ray.ssh.privateKey === 'string' && !this.v2ray.ssh.privateKey.startsWith('ENC:')) {
        this.v2ray.ssh.privateKey = 'ENC:' + encryptString(this.v2ray.ssh.privateKey);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('VpnServer', vpnServerSchema);
