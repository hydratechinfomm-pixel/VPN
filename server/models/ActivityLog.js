const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: [
        'LOGIN',
        'LOGOUT',
        'CREATE_KEY',
        'DELETE_KEY',
        'UPDATE_KEY',
        'SUSPEND_KEY',
        'ADD_SERVER',
        'REMOVE_SERVER',
        'UPDATE_PROFILE',
        'CHANGE_PASSWORD',
        'ENABLE_2FA',
        'DISABLE_2FA',
        'CREATE_DEVICE',
        'UPDATE_DEVICE',
        'DELETE_DEVICE',
        'TOGGLE_DEVICE',
        'DISCONNECT_DEVICE',
        'CREATE_PLAN',
        'UPDATE_PLAN',
        'DELETE_PLAN',
        'ASSIGN_PLAN',
        'CREATE_USER',
        'UPDATE_USER',
        'DELETE_USER',
        'SYNC_OUTLINE',
        'ADMIN_ACCESS_DENIED',
        'PANEL_ADMIN_ACCESS_DENIED',
        'UNAUTHORIZED_ACCESS',
        'LOGOUT_OTHER_DEVICES',
        'LOGOUT_DEVICE',
        'UPDATE_SERVER'
      ],
      required: true,
    },
    resource: {
      type: String,
      enum: ['USER', 'ACCESS_KEY', 'SERVER', 'PROFILE', 'DEVICE', 'PLAN', 'SECURITY'],
    },
    resourceId: mongoose.Schema.Types.ObjectId,
    details: {
      type: Map,
      of: String,
    },
    ipAddress: String,
    userAgent: String,
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING'],
      default: 'SUCCESS',
    },
    errorMessage: String,
  },
  { timestamps: true }
);

// Index for faster queries
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
