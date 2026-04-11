const express = require('express');
const { getDb } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.from('payments')
      .select('*, sales(date, total_amount, user_id, users!sales_user_id_fkey(full_name))')
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw error;

    const payments = data.map(p => ({
      ...p,
      sale_date: p.sales?.date,
      sale_total: p.sales?.total_amount,
      cashier_name: p.sales?.users?.full_name,
      sales: undefined
    }));
    res.json(payments);
  } catch (err) {
    next(err);
  }
});

router.get('/:sale_id', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.from('payments').select('*').eq('sale_id', req.params.sale_id).limit(1);
    if (error) throw error;
    if (!data[0]) return res.status(404).json({ error: 'Payment not found.' });
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
