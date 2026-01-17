/**
 * Generate QR code for access key
 */
exports.generateQRCode = (accessUrl) => {
  // Using qrcode library
  const qrcode = require('qrcode');
  return qrcode.toDataURL(accessUrl);
};

/**
 * Format bytes to human readable format
 */
exports.formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Validate Outline API URL format
 */
exports.isValidOutlineUrl = (url) => {
  try {
    new URL(url);
    return url.includes('://');
  } catch {
    return false;
  }
};

/**
 * Generate random password
 */
exports.generateRandomPassword = (length = 16) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Check if data limit exceeded
 */
exports.isDataLimitExceeded = (used, limit) => {
  if (!limit) return false;
  return used >= limit;
};

/**
 * Calculate percentage
 */
exports.calculatePercentage = (used, total) => {
  if (total === 0) return 0;
  return (used / total) * 100;
};

/**
 * Get data limit status
 */
exports.getDataLimitStatus = (used, limit) => {
  if (!limit) return 'unlimited';
  const percentage = this.calculatePercentage(used, limit);
  
  if (percentage < 50) return 'low';
  if (percentage < 80) return 'medium';
  if (percentage < 95) return 'high';
  return 'critical';
};
