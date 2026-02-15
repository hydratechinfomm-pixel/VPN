const mongoose = require('mongoose');

const v2rayUserSchema = new mongoose.Schema(
  {
    server: { type: mongoose.Schema.Types.ObjectId, ref: 'VpnServer', required: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    // Server-side identifier (UUID or generated id)
    userId: { type: String, required: true },
    // Client config: vmess:// URL or JSON
    clientConfig: { type: String },
    name: { type: String, required: true },
    dataLimit: {
      bytes: Number,
      isEnabled: { type: Boolean, default: false },
    },
    usage: {
      bytesSent: { type: Number, default: 0 },
      bytesReceived: { type: Number, default: 0 },
      lastSync: { type: Date, default: Date.now },
    },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED', 'DISABLED', 'EXPIRED'], default: 'ACTIVE' },
    expiresAt: Date,
    metadata: { notes: String },
  },
  { timestamps: true }
);

v2rayUserSchema.index({ server: 1, userId: 1 }, { unique: true, sparse: true });
v2rayUserSchema.index({ device: 1 });

module.exports = mongoose.model('V2rayUser', v2rayUserSchema);
