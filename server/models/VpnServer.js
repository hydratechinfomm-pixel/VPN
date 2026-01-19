const mongoose = require('mongoose');

const vpnServerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
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

module.exports = mongoose.model('VpnServer', vpnServerSchema);
