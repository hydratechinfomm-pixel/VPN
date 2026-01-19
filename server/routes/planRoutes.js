const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { authenticateToken, authorizePanelAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Plan CRUD - write operations require panel admin or staff
router.post('/', authorizePanelAdmin, planController.createPlan);
router.get('/', planController.getPlans);
router.get('/:planId', planController.getPlan);
router.put('/:planId', authorizePanelAdmin, planController.updatePlan);
router.delete('/:planId', authorizePanelAdmin, planController.deletePlan);

// Plan actions
router.post('/assign', planController.assignPlanToDevice);
router.get('/:planId/stats', planController.getPlanStats);

module.exports = router;
