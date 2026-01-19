const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Data limit in bytes (null for unlimited)
    dataLimit: {
      bytes: Number,
      isUnlimited: {
        type: Boolean,
        default: false,
      },
    },
    // Pricing
    price: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly', 'one-time'],
      default: 'monthly',
    },
    // Features
    features: [String],
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    // Statistics
    stats: {
      totalDevices: {
        type: Number,
        default: 0,
      },
      activeDevices: {
        type: Number,
        default: 0,
      },
    },
  },
  { timestamps: true }
);

// Index
planSchema.index({ isActive: 1 });

// Virtual for data limit in GB
planSchema.virtual('dataLimitGB').get(function () {
  if (this.dataLimit.isUnlimited) {
    return 'Unlimited';
  }
  return this.dataLimit.bytes ? (this.dataLimit.bytes / (1024 * 1024 * 1024)).toFixed(2) : 0;
});

module.exports = mongoose.model('Plan', planSchema);
