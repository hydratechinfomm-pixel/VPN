const mongoose = require('mongoose');

const salesTransactionSchema = new mongoose.Schema(
  {
    // References (may be deleted later; we also store snapshots below)
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: false,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: false,
    },
    server: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VpnServer',
      required: false,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },

    // Snapshots for reporting even if records are deleted/changed
    deviceName: String,

    planName: String,
    planPrice: {
      type: Number,
      default: 0,
    },
    planCurrency: {
      type: String,
      default: 'USD',
    },
    planBillingCycle: String,

    serverName: String,
    serverType: {
      type: String,
      enum: ['REGULAR', 'PREMIUM', 'ENTERPRISE'],
    },

    userName: String,
    createdByName: String,

    // Snapshot of device expiration at time of setup
    expiresAt: Date,

    metadata: {
      deviceStatus: String,
      notes: String,
    },
  },
  { timestamps: true }
);

// Indexes for reporting queries
salesTransactionSchema.index({ createdAt: -1 });
salesTransactionSchema.index({ serverType: 1, createdAt: -1 });
salesTransactionSchema.index({ plan: 1, createdAt: -1 });
salesTransactionSchema.index({ user: 1, createdAt: -1 });
salesTransactionSchema.index({ server: 1, createdAt: -1 });

module.exports = mongoose.model('SalesTransaction', salesTransactionSchema);

