const SalesTransaction = require('../models/SalesTransaction');

/**
 * Build MongoDB match object from query params
 */
function buildMatch(query) {
  const {
    startDate,
    endDate,
    serverType,
    userId,
    planId,
  } = query;

  const match = {};

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) {
      match.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      // Include the entire end day
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }

  if (serverType) {
    match.serverType = serverType;
  }

  if (userId) {
    match.user = userId;
  }

  if (planId) {
    match.plan = planId;
  }

  // Only consider transactions that have a plan (sales with plans)
  match.planPrice = { $gt: 0 };

  return match;
}

/**
 * GET /api/sales/report
 * Main sales report with filters & breakdowns
 */
exports.getSalesReport = async (req, res) => {
  try {
    const match = buildMatch(req.query);

    const [result] = await SalesTransaction.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$planPrice' },
                deviceCount: { $sum: 1 },
              },
            },
          ],
          byPlan: [
            {
              $group: {
                _id: '$planName',
                revenue: { $sum: '$planPrice' },
                count: { $sum: 1 },
              },
            },
            { $sort: { revenue: -1 } },
          ],
          byServerType: [
            {
              $group: {
                _id: '$serverType',
                revenue: { $sum: '$planPrice' },
                count: { $sum: 1 },
              },
            },
            { $sort: { revenue: -1 } },
          ],
          byUser: [
            {
              $group: {
                _id: '$userName',
                revenue: { $sum: '$planPrice' },
                count: { $sum: 1 },
              },
            },
            { $sort: { revenue: -1 } },
          ],
        },
      },
    ]);

    const totals = (result && result.totals && result.totals[0]) || {
      totalRevenue: 0,
      deviceCount: 0,
    };

    // Detailed transactions list for drill-down views
    const transactions = await SalesTransaction.find(match)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      totalRevenue: totals.totalRevenue || 0,
      deviceCount: totals.deviceCount || 0,
      byPlan: (result && result.byPlan) || [],
      byServerType: (result && result.byServerType) || [],
      byUser: (result && result.byUser) || [],
      transactions,
    });
  } catch (error) {
    console.error('[getSalesReport] Error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/sales/summary
 * Quick sales summary (can use same filters)
 */
exports.getSalesSummary = async (req, res) => {
  try {
    const match = buildMatch(req.query);

    const [totals] = await SalesTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$planPrice' },
          deviceCount: { $sum: 1 },
        },
      },
    ]);

    res.json({
      totalRevenue: totals ? totals.totalRevenue : 0,
      deviceCount: totals ? totals.deviceCount : 0,
    });
  } catch (error) {
    console.error('[getSalesSummary] Error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/sales/by-period
 * Sales grouped by period (daily, monthly, yearly)
 */
exports.getSalesByPeriod = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const match = buildMatch(req.query);

    let format;
    if (period === 'monthly') {
      format = '%Y-%m';
    } else if (period === 'yearly') {
      format = '%Y';
    } else {
      // default daily
      format = '%Y-%m-%d';
    }

    const data = await SalesTransaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            period: {
              $dateToString: { format, date: '$createdAt' },
            },
          },
          totalRevenue: { $sum: '$planPrice' },
          deviceCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.period': 1 } },
    ]);

    const result = data.map((item) => ({
      period: item._id.period,
      totalRevenue: item.totalRevenue,
      deviceCount: item.deviceCount,
    }));

    res.json({ period, data: result });
  } catch (error) {
    console.error('[getSalesByPeriod] Error:', error);
    res.status(500).json({ error: error.message });
  }
};

