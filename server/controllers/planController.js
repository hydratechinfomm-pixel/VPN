const Plan = require('../models/Plan');
const Device = require('../models/Device');
const { logActivity } = require('../middleware/auth');

/**
 * Create new plan
 */
exports.createPlan = async (req, res) => {
  try {
    const { name, description, dataLimit, isUnlimited, price, currency, billingCycle, expiryMonths, features } = req.body;

    // Check if plan name already exists
    const existingPlan = await Plan.findOne({ name });
    if (existingPlan) {
      return res.status(400).json({ error: 'Plan with this name already exists' });
    }

    const plan = new Plan({
      name,
      description,
      dataLimit: {
        bytes: isUnlimited ? null : dataLimit,
        isUnlimited: isUnlimited || false,
      },
      price: price || 0,
      currency: currency || 'USD',
      billingCycle: billingCycle || '1-month',
      expiryMonths: expiryMonths || 1,
      features: features || [],
    });

    await plan.save();
    await logActivity(req.userId, 'CREATE_PLAN', 'PLAN', plan._id, true);

    res.status(201).json({
      message: 'Plan created successfully',
      plan,
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get all plans
 */
exports.getPlans = async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const plans = await Plan.find(query).sort({ createdAt: -1 });

    res.json({
      total: plans.length,
      plans,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get single plan
 */
exports.getPlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update plan
 */
exports.updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, description, dataLimit, isUnlimited, price, currency, billingCycle, expiryMonths, features, isActive } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (name) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (price !== undefined) plan.price = price;
    if (currency) plan.currency = currency;
    if (billingCycle) plan.billingCycle = billingCycle;
    if (expiryMonths !== undefined) plan.expiryMonths = expiryMonths;
    if (features) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;

    if (dataLimit !== undefined || isUnlimited !== undefined) {
      plan.dataLimit = {
        bytes: isUnlimited ? null : (dataLimit || plan.dataLimit.bytes),
        isUnlimited: isUnlimited || false,
      };
    }

    await plan.save();
    await logActivity(req.userId, 'UPDATE_PLAN', 'PLAN', plan._id, true);

    res.json({
      message: 'Plan updated successfully',
      plan,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete plan
 */
exports.deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Check if plan is assigned to any devices
    const devicesWithPlan = await Device.countDocuments({ plan: planId });
    if (devicesWithPlan > 0) {
      return res.status(400).json({ 
        error: `Cannot delete plan. It is assigned to ${devicesWithPlan} device(s). Remove plan assignments first.` 
      });
    }

    await Plan.findByIdAndDelete(planId);
    await logActivity(req.userId, 'DELETE_PLAN', 'PLAN', planId, true);

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Assign plan to device
 */
exports.assignPlanToDevice = async (req, res) => {
  try {
    const { planId, deviceId } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    device.plan = planId;
    
    // Update data limit based on plan
    if (plan.dataLimit.isUnlimited) {
      device.isUnlimited = true;
      device.dataLimit = { isEnabled: false };
    } else {
      device.isUnlimited = false;
      device.dataLimit = {
        bytes: plan.dataLimit.bytes,
        isEnabled: true,
      };
    }

    await device.save();
    await logActivity(req.userId, 'ASSIGN_PLAN', 'DEVICE', deviceId, true);

    res.json({
      message: 'Plan assigned to device successfully',
      device,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get plan statistics
 */
exports.getPlanStats = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const devices = await Device.find({ plan: planId });
    const activeDevices = devices.filter(d => d.status === 'ACTIVE' && d.isEnabled);

    plan.stats.totalDevices = devices.length;
    plan.stats.activeDevices = activeDevices.length;
    await plan.save();

    res.json({
      plan,
      stats: {
        totalDevices: devices.length,
        activeDevices: activeDevices.length,
        suspendedDevices: devices.filter(d => d.status === 'SUSPENDED').length,
        disabledDevices: devices.filter(d => d.status === 'DISABLED').length,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
