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
    body('name').trim().notEmpty().withMessage('Server name is required'),
    body('host').notEmpty().withMessage('Host/IP address is required'),
    body('port')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('Port must be between 1 and 65535'),
    body('region')
      .optional()
      .isIn(['US', 'EU', 'ASIA', 'SOUTH_AMERICA', 'AFRICA', 'OCEANIA'])
      .withMessage('Invalid region'),
    body('provider')
      .optional()
      .isIn(['AWS', 'Google Cloud', 'Azure', 'DigitalOcean', 'Linode', 'Custom'])
      .withMessage('Invalid provider'),
    body('description').optional().trim(),
    body('country').optional().trim(),
    body('city').optional().trim(),

    // WireGuard specific validation
    body('wireguardInterfaceName')
      .optional()
      .isString()
      .withMessage('WireGuard interface name must be a string'),
    body('wireguardVpnIpRange')
      .optional()
      .isString()
      .withMessage('WireGuard VPN IP range must be a string'),
    body('wireguardPort')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('WireGuard port must be between 1 and 65535'),
    body('accessMethod')
      .optional()
      .isIn(['local', 'ssh'])
      .withMessage('Access method must be either local or ssh'),
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

// Get all devices on server
router.get('/:serverId/devices', serverController.getServerDevices);

// Get WireGuard status
router.get('/:serverId/wireguard-status', serverController.getWireGuardStatus);

module.exports = router;
