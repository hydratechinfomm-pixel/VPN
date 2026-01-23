const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const deviceHistoryController = require('../controllers/deviceHistoryController');
const { authenticateToken, authorizePanelAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get all history with filters (admin/moderator only) - must be before /:deviceId routes
router.get('/history', authorizePanelAdmin, deviceHistoryController.getAllHistory);

// Device CRUD
router.post('/', deviceController.createDevice);
router.get('/', deviceController.getDevices);
router.get('/:deviceId', deviceController.getDevice);
router.put('/:deviceId', deviceController.updateDevice);
router.delete('/:deviceId', deviceController.deleteDevice);

// Device actions
router.patch('/:deviceId/status', deviceController.toggleDeviceStatus);
router.get('/:deviceId/config', deviceController.getDeviceConfig);
router.get('/:deviceId/qr', deviceController.getDeviceQR);
router.post('/:deviceId/disconnect', deviceController.disconnectDevice);

// Device history (specific device)
router.get('/:deviceId/history', deviceHistoryController.getDeviceHistory);

module.exports = router;
