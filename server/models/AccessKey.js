const mongoose = require('mongoose');

const accessKeySchema = new mongoose.Schema(
  {
    // Reference to the Outline server
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VpnServer',
      required: true,
    },
    // Reference to the user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Optional for unassigned synced keys
    },
    // Reference to the device
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },
    // Unique ID from Outline server
    accessKeyId: {
      type: String,
      required: true,
      // Unique constraint removed - use compound index instead
    },
    // Access URL provided by Outline server
    accessUrl: {
      type: String,
      required: true,
    },
    // Key name/identifier
    name: {
      type: String,
      required: true,
    },
    // Data limit (in bytes)
    dataLimit: {
      bytes: Number,
      isEnabled: {
        type: Boolean,
        default: false,
      },
    },
    // Usage metrics
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
    // Key status
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'DISABLED', 'EXPIRED'],
      default: 'ACTIVE',
    },
    // Expiration
    expiresAt: Date,
    // Connection info
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
    },
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
accessKeySchema.index({ server: 1, user: 1 });
// Compound unique index per server - allows same accessKeyId on different servers
accessKeySchema.index({ server: 1, accessKeyId: 1 }, { unique: true, sparse: true });
accessKeySchema.index({ device: 1 });
accessKeySchema.index({ status: 1 });

// Virtual for total usage
accessKeySchema.virtual('totalUsage').get(function () {
  return (this.usage.bytesSent || 0) + (this.usage.bytesReceived || 0);
});

// Method to check if key has exceeded limit
accessKeySchema.methods.hasExceededLimit = function () {
  if (!this.dataLimit.isEnabled) {
    return false;
  }
  const totalUsage = this.totalUsage;
  return totalUsage >= this.dataLimit.bytes;
};

module.exports = mongoose.model('AccessKey', accessKeySchema);
