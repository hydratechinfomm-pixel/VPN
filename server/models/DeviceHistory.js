const mongoose = require('mongoose');

const deviceHistorySchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // null for system-initiated actions
    },
    action: {
      type: String,
      enum: [
        'CREATED',
        'UPDATED',
        'DELETED',
        'PAUSED',
        'RESUMED',
        'AUTO_PAUSED_LIMIT',
        'AUTO_PAUSED_EXPIRED',
        'AUTO_RESUMED',
        'DATA_LIMIT_CHANGED',
        'EXPIRE_DATE_CHANGED',
        'STATUS_CHANGED',
        'ENABLED',
        'DISABLED',
        'NAME_CHANGED',
        'PLAN_CHANGED',
      ],
      required: true,
    },
    changes: {
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
    },
    reason: {
      type: String,
      enum: ['manual', 'auto_limit_reached', 'auto_expired', 'auto_resumed', 'system'],
      default: 'manual',
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      notes: String,
      deviceName: String, // Store device name at time of action
    },
  },
  { timestamps: true }
);

// Index for faster queries
deviceHistorySchema.index({ device: 1, createdAt: -1 });
deviceHistorySchema.index({ user: 1, createdAt: -1 });
deviceHistorySchema.index({ action: 1 });
deviceHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('DeviceHistory', deviceHistorySchema);
