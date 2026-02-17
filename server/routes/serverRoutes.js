const express = require('express');
const { body } = require('express-validator');
const serverController = require('../controllers/serverController');
const { authenticateToken, authorizeAdmin, authorizePanelAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

router.use(authenticateToken);

// Get user's accessible servers (anyone)
router.get('/accessible', serverController.getUserServers);

// Get all servers (panel admin or staff)
router.get('/', authorizePanelAdmin, serverController.getAllServers);

// Create server (admin only) - supports WireGuard and Outline
router.post(
  '/',
  authorizeAdmin,
  [
    body('name').trim().notEmpty().withMessage('Server name is required'),
    body('host').notEmpty().withMessage('Host/IP address is required'),
    body('vpnType')
      .optional()
      .isIn(['wireguard', 'outline', 'v2ray'])
      .withMessage('VPN type must be either "wireguard", "outline" or "v2ray"'),
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
    body('wireguardAccessMethod')
      .optional()
      .isIn(['local', 'ssh'])
      .withMessage('WireGuard access method must be either local or ssh'),

    // Outline specific validation
    body('outlineApiPort')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('Outline API port must be between 1 and 65535'),
    body('outlineAdminAccessKey')
      .if(body('outlineAccessMethod').equals('api'))
      .notEmpty()
      .withMessage('Outline admin access key is required when using API'),
    body('outlineAdminAccessKey')
      .optional()
      .isString()
      .withMessage('Outline admin access key must be a string'),
    body('outlineAccessKeyPort')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('Outline access key port must be between 1 and 65535'),
    body('outlineCertSha256')
      .optional()
      .isString()
      .withMessage('Outline certificate SHA256 must be a string'),
    body('outlineAccessMethod')
      .optional()
      .isIn(['api', 'ssh'])
      .withMessage('Outline access method must be either api or ssh'),

    // SSH conditional validators (if any VPN access method uses SSH)
    body('sshHost')
      .if((value, { req }) =>
        req.body.wireguardAccessMethod === 'ssh' ||
        req.body.outlineAccessMethod === 'ssh' ||
        req.body.v2rayAccessMethod === 'ssh'
      )
      .notEmpty()
      .withMessage('SSH host is required when SSH access is selected'),
    body('sshPort')
      .if((value, { req }) =>
        req.body.wireguardAccessMethod === 'ssh' ||
        req.body.outlineAccessMethod === 'ssh' ||
        req.body.v2rayAccessMethod === 'ssh'
      )
      .isInt({ min: 1, max: 65535 })
      .withMessage('SSH port must be a valid port'),
    body('sshUsername')
      .if((value, { req }) =>
        req.body.wireguardAccessMethod === 'ssh' ||
        req.body.outlineAccessMethod === 'ssh' ||
        req.body.v2rayAccessMethod === 'ssh'
      )
      .notEmpty()
      .withMessage('SSH username is required when SSH access is selected'),
    body()
      .custom((value, { req }) => {
        if (
          (req.body.wireguardAccessMethod === 'ssh' ||
            req.body.outlineAccessMethod === 'ssh' ||
            req.body.v2rayAccessMethod === 'ssh') &&
          !req.body.sshPassword &&
          !req.body.sshPrivateKey
        ) {
          throw new Error('When SSH is selected, provide an SSH password or private key');
        }
        return true;
      }),

    // V2Ray specific validation
    body('v2rayApiPort')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('v2ray API port must be between 1 and 65535'),
    body('v2rayApiBaseUrl')
      .optional()
      .isString()
      .withMessage('v2ray API base URL must be a string'),
    body('v2rayApiToken')
      .optional()
      .isString()
      .withMessage('v2ray API token must be a string'),
    body('v2rayTlsVerify')
      .optional()
      .isBoolean()
      .withMessage('v2ray TLS verify must be a boolean'),
    body('v2rayAccessMethod')
      .optional()
      .isIn(['api', 'ssh'])
      .withMessage('v2ray access method must be either api or ssh'),
    body('v2rayConfigPath')
      .optional()
      .isString()
      .withMessage('v2ray config path must be a string'),
    body('v2rayPublicHost')
      .optional()
      .isString()
      .withMessage('v2ray public host must be a string'),
  ],
  validateRequest,
  serverController.createServer
);

// Get server details (panel admin or staff)
router.get('/:serverId', authorizePanelAdmin, serverController.getServer);

// Update server (admin only)
router.put(
  '/:serverId',
  authorizeAdmin,
  [
    body('name').optional().trim(),
    body('description').optional().trim(),
    body('region').optional().isIn(['US', 'EU', 'ASIA', 'SOUTH_AMERICA', 'AFRICA', 'OCEANIA']),
    body('provider').optional().isIn(['AWS', 'Google Cloud', 'Azure', 'DigitalOcean', 'Linode', 'Custom']),
    body('serverType').optional().isIn(['REGULAR', 'PREMIUM', 'ENTERPRISE']),

    // Allow optional SSH updates when admin edits server
    body('sshHost')
      .optional()
      .isString()
      .withMessage('SSH host must be a string'),
    body('sshPort')
      .optional()
      .isInt({ min: 1, max: 65535 })
      .withMessage('SSH port must be a valid port'),
    body('sshUsername')
      .optional()
      .isString()
      .withMessage('SSH username must be a string'),
    body('sshPrivateKey')
      .optional()
      .isString()
      .withMessage('SSH private key must be a string'),
  ],
  validateRequest,
  serverController.updateServer
);

// Delete server (admin only)
router.delete('/:serverId', authorizeAdmin, serverController.deleteServer);

// Get server metrics (panel admin or staff)
router.get('/:serverId/metrics', authorizePanelAdmin, serverController.getServerMetrics);

// Health check server (admin only - VPN server operation)
router.post('/:serverId/health-check', authorizeAdmin, serverController.healthCheckServer);

// Get all devices on server (panel admin or staff)
router.get('/:serverId/devices', authorizePanelAdmin, serverController.getServerDevices);

// Get WireGuard status (panel admin or staff)
router.get('/:serverId/wireguard-status', authorizePanelAdmin, serverController.getWireGuardStatus);

// Get Outline server status (panel admin or staff)
router.get('/:serverId/outline-status', authorizePanelAdmin, serverController.getOutlineStatus);

// Sync Outline access keys from server to database (admin only)
router.post('/:serverId/sync-outline', authorizeAdmin, serverController.syncOutlineAccessKeys);

// V2Ray: list remote users (panel admin) and sync remote users into DB (admin)
router.get('/:serverId/v2ray/users', authorizePanelAdmin, serverController.listV2rayUsers);
router.post('/:serverId/v2ray/sync', authorizeAdmin, serverController.syncV2rayUsers);

module.exports = router;
