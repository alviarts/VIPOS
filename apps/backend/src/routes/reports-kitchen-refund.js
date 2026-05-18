/**
 * Kitchen & Refund Reports API Routes
 *
 * Additional reports for F&B operations and compliance
 */

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../db/prisma');
const { logger } = require('../lib/logger');

const router = express.Router();

// ============================================================================
// KITCHEN REPORTS
// ============================================================================

// GET /api/v1/reports/kitchen/orders - Kitchen orders report
router.get('/kitchen/orders', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { start_date, end_date, outlet_id } = req.query;

    const whereClause = {
      tenant_id,
      status: { not: 'VOID' },
    };

    if (start_date) {
      whereClause.created_at = { ...whereClause.created_at, gte: new Date(start_date) };
    }

    if (end_date) {
      whereClause.created_at = { ...whereClause.created_at, lte: new Date(end_date) };
    }

    if (outlet_id) {
      whereClause.outlet_id = parseInt(outlet_id);
    }

    const transactions = await prisma.transactions.findMany({
      where: whereClause,
      include: {
        transaction_items: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Group by date
    const groupedData = {};
    transactions.forEach((t) => {
      const orderDate = t.created_at.toISOString().split('T')[0];
      if (!groupedData[orderDate]) {
        groupedData[orderDate] = {
          order_date: orderDate,
          total_orders: 0,
          total_items: 0,
          total_quantity: 0,
          prep_times: [],
        };
      }
      groupedData[orderDate].total_orders += 1;
      groupedData[orderDate].total_items += t.transaction_items.length;
      groupedData[orderDate].total_quantity += t.transaction_items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      // Calculate prep time if updated_at exists
      if (t.updated_at && t.created_at) {
        const prepTime = (t.updated_at - t.created_at) / (1000 * 60); // minutes
        groupedData[orderDate].prep_times.push(prepTime);
      }
    });

    const data = Object.values(groupedData).map((group) => ({
      order_date: group.order_date,
      total_orders: group.total_orders,
      total_items: group.total_items,
      total_quantity: group.total_quantity,
      avg_prep_time_minutes:
        group.prep_times.length > 0
          ? group.prep_times.reduce((a, b) => a + b, 0) / group.prep_times.length
          : null,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get kitchen orders report');
    res.status(500).json({ success: false, error: 'Failed to get kitchen orders report' });
  }
});

// GET /api/v1/reports/kitchen/items - Kitchen items by category
router.get('/kitchen/items', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { start_date, end_date } = req.query;

    const whereClause = {
      tenant_id,
      status: { not: 'VOID' },
    };

    if (start_date) {
      whereClause.created_at = { ...whereClause.created_at, gte: new Date(start_date) };
    }

    if (end_date) {
      whereClause.created_at = { ...whereClause.created_at, lte: new Date(end_date) };
    }

    const transactionItems = await prisma.transaction_items.findMany({
      where: {
        tenant_id,
        transactions: whereClause,
      },
      include: {
        products: {
          include: {
            categories: true,
          },
        },
        transactions: true,
      },
      take: 50,
    });

    // Group by category and product
    const groupedData = {};
    transactionItems.forEach((item) => {
      const categoryName = item.products?.categories?.name || 'Uncategorized';
      const productName = item.product_name;
      const key = `${categoryName}|${productName}`;

      if (!groupedData[key]) {
        groupedData[key] = {
          category_name: categoryName,
          product_name: productName,
          total_quantity: 0,
          order_count: new Set(),
          prices: [],
        };
      }

      groupedData[key].total_quantity += item.quantity;
      groupedData[key].order_count.add(item.transaction_id);
      groupedData[key].prices.push(item.price);
    });

    const data = Object.values(groupedData)
      .map((group) => ({
        category_name: group.category_name,
        product_name: group.product_name,
        total_quantity: group.total_quantity,
        order_count: group.order_count.size,
        avg_price: group.prices.reduce((a, b) => a + b, 0) / group.prices.length,
      }))
      .sort((a, b) => b.total_quantity - a.total_quantity);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get kitchen items report');
    res.status(500).json({ success: false, error: 'Failed to get kitchen items report' });
  }
});

// GET /api/v1/reports/kitchen/performance - Kitchen performance metrics
router.get('/kitchen/performance', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { start_date, end_date } = req.query;

    const whereClause = {
      tenant_id,
      status: { not: 'VOID' },
    };

    if (start_date) {
      whereClause.created_at = { ...whereClause.created_at, gte: new Date(start_date) };
    }

    if (end_date) {
      whereClause.created_at = { ...whereClause.created_at, lte: new Date(end_date) };
    }

    const transactions = await prisma.transactions.findMany({
      where: whereClause,
      include: {
        transaction_items: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Group by date and hour
    const performanceData = [];
    const hourlyStats = {};

    transactions.forEach((t) => {
      const date = t.created_at.toISOString().split('T')[0];
      const hour = t.created_at.getHours();
      const key = `${date}|${hour}`;

      if (!performanceData[key]) {
        performanceData[key] = {
          date,
          hour,
          orders: 0,
          items: 0,
          prep_times: [],
        };
      }

      performanceData[key].orders += 1;
      performanceData[key].items += t.transaction_items.length;

      if (t.updated_at && t.created_at) {
        const prepTime = (t.updated_at - t.created_at) / (1000 * 60);
        performanceData[key].prep_times.push(prepTime);
      }

      // Track hourly stats for peak hours
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { hour, total_orders: 0, total_items: 0 };
      }
      hourlyStats[hour].total_orders += 1;
      hourlyStats[hour].total_items += t.transaction_items.length;
    });

    const hourlyPerformance = Object.values(performanceData).map((p) => ({
      date: p.date,
      hour: p.hour,
      orders: p.orders,
      items: p.items,
      avg_prep_time:
        p.prep_times.length > 0 ? p.prep_times.reduce((a, b) => a + b, 0) / p.prep_times.length : null,
    }));

    const peakHours = Object.values(hourlyStats)
      .sort((a, b) => b.total_orders - a.total_orders)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        hourly_performance: hourlyPerformance,
        peak_hours: peakHours,
      },
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get kitchen performance report');
    res.status(500).json({ success: false, error: 'Failed to get kitchen performance report' });
  }
});

// ============================================================================
// KITCHEN REPORTS - WASTE/VOID TRACKING
// ============================================================================

// GET /api/v1/reports/kitchen/waste - Waste/void items tracking
router.get('/kitchen/waste', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { start_date, end_date } = req.query;

    const whereClause = {
      tenant_id,
      status: 'voided',
    };

    if (start_date) {
      whereClause.created_at = { ...whereClause.created_at, gte: new Date(start_date) };
    }

    if (end_date) {
      whereClause.created_at = { ...whereClause.created_at, lte: new Date(end_date) };
    }

    const voidedTransactions = await prisma.transactions.findMany({
      where: whereClause,
      include: {
        transaction_items: {
          include: {
            products: true,
          },
        },
        users: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const wasteData = voidedTransactions.map((t) => ({
      transaction_id: t.id,
      invoice_number: t.invoice_number,
      voided_at: t.created_at,
      voided_by: t.users?.name || 'Unknown',
      total_amount: t.total_amount,
      items: t.transaction_items.map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        subtotal: item.subtotal,
      })),
      notes: t.notes,
    }));

    const summary = {
      total_voided: voidedTransactions.length,
      total_amount: voidedTransactions.reduce((sum, t) => sum + t.total_amount, 0),
      total_items: voidedTransactions.reduce((sum, t) => sum + t.transaction_items.length, 0),
    };

    res.json({
      success: true,
      data: wasteData,
      summary,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get kitchen waste report');
    res.status(500).json({ success: false, error: 'Failed to get kitchen waste report' });
  }
});

// ============================================================================
// REFUND REPORTS
// ============================================================================

// GET /api/v1/reports/refunds - Refund report
// Note: Using voided transactions as refunds since schema doesn't have refund fields
router.get('/refunds', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { start_date, end_date, outlet_id } = req.query;

    const whereClause = {
      tenant_id,
      status: 'voided',
    };

    if (start_date) {
      whereClause.created_at = { ...whereClause.created_at, gte: new Date(start_date) };
    }

    if (end_date) {
      whereClause.created_at = { ...whereClause.created_at, lte: new Date(end_date) };
    }

    if (outlet_id) {
      whereClause.outlet_id = parseInt(outlet_id);
    }

    const refunds = await prisma.transactions.findMany({
      where: whereClause,
      include: {
        users: true,
        customers: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const data = refunds.map((t) => ({
      transaction_id: t.id,
      invoice_number: t.invoice_number,
      transaction_date: t.created_at,
      total_amount: t.total_amount,
      refund_amount: t.total_amount,
      refund_reason: t.notes || 'No reason provided',
      refund_at: t.created_at,
      refunded_by: t.users?.name || 'Unknown',
      customer_name: t.customers?.name || 'Walk-in',
    }));

    res.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get refund report');
    res.status(500).json({ success: false, error: 'Failed to get refund report' });
  }
});

// GET /api/v1/reports/refunds/summary - Refund summary
router.get('/refunds/summary', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { start_date, end_date, group_by = 'day' } = req.query;

    const whereClause = {
      tenant_id,
      status: 'voided',
    };

    if (start_date) {
      whereClause.created_at = { ...whereClause.created_at, gte: new Date(start_date) };
    }

    if (end_date) {
      whereClause.created_at = { ...whereClause.created_at, lte: new Date(end_date) };
    }

    const refunds = await prisma.transactions.findMany({
      where: whereClause,
    });

    // Overall summary
    const summary = {
      total_refunds: refunds.length,
      total_refund_amount: refunds.reduce((sum, t) => sum + t.total_amount, 0),
      avg_refund_amount: refunds.length > 0 ? refunds.reduce((sum, t) => sum + t.total_amount, 0) / refunds.length : 0,
      min_refund_amount: refunds.length > 0 ? Math.min(...refunds.map((t) => t.total_amount)) : 0,
      max_refund_amount: refunds.length > 0 ? Math.max(...refunds.map((t) => t.total_amount)) : 0,
    };

    // Group by period
    const groupedData = {};
    refunds.forEach((t) => {
      let period;
      const date = new Date(t.created_at);
      
      switch (group_by) {
        case 'hour':
          period = date.toISOString().slice(0, 13) + ':00:00';
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          period = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          period = date.toISOString().slice(0, 7) + '-01';
          break;
        default:
          period = date.toISOString().split('T')[0];
      }

      if (!groupedData[period]) {
        groupedData[period] = {
          period,
          refund_count: 0,
          total_refund_amount: 0,
        };
      }

      groupedData[period].refund_count += 1;
      groupedData[period].total_refund_amount += t.total_amount;
    });

    const trend = Object.values(groupedData).sort((a, b) => b.period.localeCompare(a.period));

    res.json({
      success: true,
      data: {
        summary,
        trend,
      },
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get refund summary');
    res.status(500).json({ success: false, error: 'Failed to get refund summary' });
  }
});

// GET /api/v1/reports/refunds/by-reason - Refunds by reason
router.get('/refunds/by-reason', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { start_date, end_date } = req.query;

    const whereClause = {
      tenant_id,
      status: 'voided',
    };

    if (start_date) {
      whereClause.created_at = { ...whereClause.created_at, gte: new Date(start_date) };
    }

    if (end_date) {
      whereClause.created_at = { ...whereClause.created_at, lte: new Date(end_date) };
    }

    const refunds = await prisma.transactions.findMany({
      where: whereClause,
    });

    // Group by reason (using notes field)
    const groupedByReason = {};
    refunds.forEach((t) => {
      const reason = t.notes || 'No reason provided';
      if (!groupedByReason[reason]) {
        groupedByReason[reason] = {
          reason,
          count: 0,
          total_amount: 0,
          amounts: [],
        };
      }
      groupedByReason[reason].count += 1;
      groupedByReason[reason].total_amount += t.total_amount;
      groupedByReason[reason].amounts.push(t.total_amount);
    });

    const data = Object.values(groupedByReason)
      .map((group) => ({
        reason: group.reason,
        count: group.count,
        total_amount: group.total_amount,
        avg_amount: group.total_amount / group.count,
      }))
      .sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get refunds by reason');
    res.status(500).json({ success: false, error: 'Failed to get refunds by reason' });
  }
});

// GET /api/v1/reports/refunds/by-product - Refunds by product
router.get('/refunds/by-product', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { start_date, end_date } = req.query;

    const whereClause = {
      tenant_id,
      status: 'voided',
    };

    if (start_date) {
      whereClause.created_at = { ...whereClause.created_at, gte: new Date(start_date) };
    }

    if (end_date) {
      whereClause.created_at = { ...whereClause.created_at, lte: new Date(end_date) };
    }

    const voidedTransactions = await prisma.transactions.findMany({
      where: whereClause,
      include: {
        transaction_items: {
          include: {
            products: true,
          },
        },
      },
    });

    // Group by product
    const groupedByProduct = {};
    voidedTransactions.forEach((t) => {
      t.transaction_items.forEach((item) => {
        const productName = item.product_name;
        const sku = item.products?.sku || 'N/A';
        const key = `${productName}|${sku}`;

        if (!groupedByProduct[key]) {
          groupedByProduct[key] = {
            product_name: productName,
            sku,
            refund_count: new Set(),
            total_quantity_refunded: 0,
            total_amount_refunded: 0,
          };
        }

        groupedByProduct[key].refund_count.add(t.id);
        groupedByProduct[key].total_quantity_refunded += item.quantity;
        groupedByProduct[key].total_amount_refunded += item.subtotal;
      });
    });

    const data = Object.values(groupedByProduct)
      .map((group) => ({
        product_name: group.product_name,
        sku: group.sku,
        refund_count: group.refund_count.size,
        total_quantity_refunded: group.total_quantity_refunded,
        total_amount_refunded: group.total_amount_refunded,
      }))
      .sort((a, b) => b.refund_count - a.refund_count)
      .slice(0, 50);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error({ error, user: req.user }, 'Failed to get refunds by product');
    res.status(500).json({ success: false, error: 'Failed to get refunds by product' });
  }
});

module.exports = router;
