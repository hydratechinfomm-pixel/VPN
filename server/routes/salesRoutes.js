const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticateToken, authorizePanelAdmin } = require('../middleware/auth');

// All routes require authentication and panel admin access (admin or staff)
router.use(authenticateToken, authorizePanelAdmin);

// Sales report with filters
router.get('/report', salesController.getSalesReport);

// Sales summary (quick overview)
router.get('/summary', salesController.getSalesSummary);

// Sales by period (daily/monthly/yearly grouping)
router.get('/by-period', salesController.getSalesByPeriod);

module.exports = router;