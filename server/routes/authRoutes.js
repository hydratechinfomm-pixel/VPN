const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

// Register
router.post(
  '/register',
  [
    body('username').trim().isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
  ],
  validateRequest,
  authController.register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty(),
  ],
  validateRequest,
  authController.login
);

// Refresh token
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.use(authenticateToken);

// Logout
router.post('/logout', authController.logout);

// Get current user
router.get('/me', authController.getCurrentUser);

// Change password
router.post(
  '/change-password',
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
  ],
  validateRequest,
  authController.changePassword
);

// Update profile
router.put(
  '/profile',
  [
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('phone').optional().trim(),
    body('country').optional().trim(),
    body('timezone').optional().trim(),
  ],
  validateRequest,
  authController.updateProfile
);

module.exports = router;
