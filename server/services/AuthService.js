const jwt = require('jsonwebtoken');
const constants = require('../config/constants');

/**
 * Generate JWT token
 */
exports.generateToken = (userId, expiresIn = constants.JWT_EXPIRES_IN) => {
  return jwt.sign({ userId }, constants.JWT_SECRET, { expiresIn });
};

/**
 * Generate refresh token
 */
exports.generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    constants.JWT_SECRET,
    { expiresIn: constants.JWT_REFRESH_EXPIRES_IN }
  );
};

/**
 * Verify token
 */
exports.verifyToken = (token) => {
  try {
    return jwt.verify(token, constants.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * Decode token without verification
 */
exports.decodeToken = (token) => {
  return jwt.decode(token);
};
