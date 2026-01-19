const express = require('express');
const router = express.Router();
const planController = require('../controllers/planController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Plan CRUD
router.post('/', planController.createPlan);
router.get('/', planController.getPlans);
router.get('/:planId', planController.getPlan);
router.put('/:planId', planController.updatePlan);
router.delete('/:planId', planController.deletePlan);

// Plan actions
router.post('/assign', planController.assignPlanToDevice);
router.get('/:planId/stats', planController.getPlanStats);

module.exports = router;
