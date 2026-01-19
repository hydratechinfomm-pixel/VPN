const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VpnServer',
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
    },
    // WireGuard keys
    publicKey: {
      type: String,
      required: true,
      unique: true,
    },
    privateKey: {
      type: String,
      required: true,
      select: false, // Don't return private key by default
    },
    // Assigned VPN IP address
    vpnIp: {
      type: String,
      required: true,
    },
    // Device status
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'DISABLED', 'EXPIRED'],
      default: 'ACTIVE',
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    // Usage tracking
    usage: {
      bytesSent: {
        type: Number,
        default: 0,
      },
      bytesReceived: {
        type: Number,
        default: 0,
      },
      lastSync: {
        type: Date,
        default: Date.now,
      },
    },
    // Plan limits
    dataLimit: {
      bytes: Number, // in bytes
      isEnabled: {
        type: Boolean,
        default: false,
      },
    },
    isUnlimited: {
      type: Boolean,
      default: false,
    },
    // Expiration
    expiresAt: Date,
    // Connectivity
    connectivity: {
      lastConnectedAt: Date,
      isConnected: {
        type: Boolean,
        default: false,
      },
      connectionCount: {
        type: Number,
        default: 0,
      },
      lastHandshake: Date,
    },
    // Config file
    configFile: String,
    // Metadata
    metadata: {
      notes: String,
      deviceType: String,
      os: String,
    },
  },
  { timestamps: true }
);

// Index for faster queries
deviceSchema.index({ user: 1, server: 1 });
deviceSchema.index({ publicKey: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ vpnIp: 1 });

// Virtual for total usage
deviceSchema.virtual('totalUsage').get(function () {
  return (this.usage.bytesSent || 0) + (this.usage.bytesReceived || 0);
});

// Method to check if device has exceeded limit
deviceSchema.methods.hasExceededLimit = function () {
  if (this.isUnlimited || !this.dataLimit.isEnabled) {
    return false;
  }
  const totalUsage = this.totalUsage;
  return totalUsage >= this.dataLimit.bytes;
};

module.exports = mongoose.model('Device', deviceSchema);
