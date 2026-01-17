const express = require('express');
const { body } = require('express-validator');
const serverController = require('../controllers/serverController');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken);

// Get user's accessible servers (anyone)
router.get('/accessible', serverController.getUserServers);

// Get all servers (admin only)
router.get('/', authorizeAdmin, serverController.getAllServers);

// Create server (admin only)
router.post(
  '/',
  authorizeAdmin,
  [
    body('name').trim().notEmpty(),
    body('host').notEmpty(),
    body('port').isInt({ min: 1, max: 65535 }),
    body('apiUrl').isURL(),
    body('region').optional().isIn(['US', 'EU', 'ASIA', 'SOUTH_AMERICA', 'AFRICA', 'OCEANIA']),
    body('provider').optional().isIn(['AWS', 'Google Cloud', 'Azure', 'DigitalOcean', 'Linode', 'Custom']),
    body('apiToken').notEmpty(),
  ],
  validateRequest,
  serverController.createServer
);

// Get server details
router.get('/:serverId', serverController.getServer);

// Update server (admin only)
router.put(
  '/:serverId',
  authorizeAdmin,
  [
    body('name').optional().trim(),
    body('description').optional().trim(),
    body('region').optional().isIn(['US', 'EU', 'ASIA', 'SOUTH_AMERICA', 'AFRICA', 'OCEANIA']),
    body('provider').optional().isIn(['AWS', 'Google Cloud', 'Azure', 'DigitalOcean', 'Linode', 'Custom']),
  ],
  validateRequest,
  serverController.updateServer
);

// Delete server (admin only)
router.delete('/:serverId', authorizeAdmin, serverController.deleteServer);

// Get server metrics
router.get('/:serverId/metrics', serverController.getServerMetrics);

// Health check server
router.post('/:serverId/health-check', serverController.healthCheckServer);

// Get all access keys on server
router.get('/:serverId/access-keys', serverController.getServerAccessKeys);

module.exports = router;
