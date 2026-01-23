const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ROLES = require('../config/constants').ROLES;

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    plan: {
      type: String,
      enum: ['FREE', 'PREMIUM', 'ENTERPRISE'],
      default: 'FREE',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    devices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
      },
    ],
    allowedServers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VpnServer',
      },
    ],
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
    profile: {
      phone: String,
      nickname: String,
      country: String,
      timezone: String,
      avatar: String,
    },
    securitySettings: {
      twoFactorEnabled: Boolean,
      twoFactorSecret: String,
      lastLoginAt: Date,
      loginAttempts: {
        type: Number,
        default: 0,
      },
      lockedUntil: Date,
    },
    // Session management for tracking active logins
    activeSessions: [
      {
        deviceId: String, // Browser/device identifier
        userAgent: String,
        ipAddress: String,
        token: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: Date,
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Method to get user data without sensitive fields
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  if (obj.securitySettings) {
    delete obj.securitySettings.twoFactorSecret;
  }
  return obj;
};

module.exports = mongoose.model('User', userSchema);
