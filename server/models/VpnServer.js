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
    maxAccessKeys: {
      type: Number,
      default: 100,
    },
    accessKeys: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AccessKey',
      },
    ],
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
  },
  { timestamps: true }
);

module.exports = mongoose.model('VpnServer', vpnServerSchema);
