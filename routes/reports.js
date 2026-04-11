const express = require('express');
const { getDb } = require('../database/init');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/daily', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { data, error } = await db.rpc('get_daily_report', { p_date: date });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/weekly', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.rpc('get_weekly_report');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/products', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.rpc('get_product_report');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/inventory', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.rpc('get_inventory_report');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/cashier', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.rpc('get_cashier_report');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
