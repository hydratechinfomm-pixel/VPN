const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const accessKeySchema = new mongoose.Schema(
  {
    keyId: {
      type: String,
      required: true,
      unique: true,
      default: () => uuidv4(),
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    accessUrl: String,
    port: Number,
    method: {
      type: String,
      default: 'chacha20-ietf-poly1305',
      enum: [
        'chacha20-ietf-poly1305',
        'aes-256-gcm',
        'aes-192-gcm',
        'aes-128-gcm',
      ],
    },
    password: String,
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'DISABLED'],
      default: 'ACTIVE',
    },
    expiresAt: Date,
    isUnlimited: {
      type: Boolean,
      default: false,
    },
    dataLimit: {
      bytes: Number, // in bytes
      isEnabled: {
        type: Boolean,
        default: false,
      },
    },
    dataUsage: {
      bytes: {
        type: Number,
        default: 0,
      },
      lastReset: {
        type: Date,
        default: Date.now,
      },
    },
    metadata: {
      devices: [
        {
          name: String,
          os: String,
          lastConnected: Date,
        },
      ],
      notes: String,
    },
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
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
accessKeySchema.index({ user: 1, server: 1 });
accessKeySchema.index({ keyId: 1 });
accessKeySchema.index({ status: 1 });

module.exports = mongoose.model('AccessKey', accessKeySchema);
