const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken, authorizeAdmin);

// Get all users
router.get('/', userController.getAllUsers);

// Get user by ID
router.get('/:userId', userController.getUser);

// Update user
router.put(
  '/:userId',
  [
    body('role').optional().isIn(['admin', 'moderator', 'user']),
    body('plan').optional().isIn(['FREE', 'PREMIUM', 'ENTERPRISE']),
    body('isActive').optional().isBoolean(),
    body('allowedServers').optional().isArray(),
  ],
  validateRequest,
  userController.updateUser
);

// Delete user
router.delete('/:userId', userController.deleteUser);

// Get user activity logs
router.get('/:userId/activity', userController.getUserActivityLogs);

// Get user data usage
router.get('/:userId/data-usage', userController.getUserDataUsage);

module.exports = router;
