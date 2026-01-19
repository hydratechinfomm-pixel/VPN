const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { authenticateToken, authorizeAdmin, authorizePanelAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Create panel user (admin only)
router.post(
  '/',
  authenticateToken,
  authorizeAdmin,
  [
    body('username').trim().notEmpty().isLength({ min: 3, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('role').isIn(['admin', 'moderator']),
  ],
  validateRequest,
  userController.createPanelUser
);

// All other routes: panel admin or staff
router.use(authenticateToken, authorizePanelAdmin);

// Get all users
router.get('/', userController.getAllUsers);

// Get user activity logs (before /:userId to avoid matching)
router.get('/:userId/activity', userController.getUserActivityLogs);

// Get user data usage
router.get('/:userId/data-usage', userController.getUserDataUsage);

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

module.exports = router;
