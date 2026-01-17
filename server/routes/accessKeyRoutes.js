const express = require('express');
const { body } = require('express-validator');
const accessKeyController = require('../controllers/accessKeyController');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken);

// Create access key
router.post(
  '/',
  [
    body('serverId').notEmpty(),
    body('name').trim().notEmpty(),
    body('dataLimit').optional().isInt({ min: 0 }),
    body('expiresAt').optional().isISO8601(),
  ],
  validateRequest,
  accessKeyController.createAccessKey
);

// Get all access keys for user
router.get('/', accessKeyController.getAccessKeys);

// Get single access key
router.get('/:keyId', accessKeyController.getAccessKey);

// Update access key
router.put(
  '/:keyId',
  [
    body('name').optional().trim(),
    body('dataLimit').optional().isInt({ min: 0 }),
    body('expiresAt').optional().isISO8601(),
  ],
  validateRequest,
  accessKeyController.updateAccessKey
);

// Delete access key
router.delete('/:keyId', accessKeyController.deleteAccessKey);

// Toggle access key status (suspend/resume)
router.patch(
  '/:keyId/status',
  [
    body('status').isIn(['ACTIVE', 'SUSPENDED', 'EXPIRED', 'DISABLED']),
  ],
  validateRequest,
  accessKeyController.toggleAccessKeyStatus
);

module.exports = router;
