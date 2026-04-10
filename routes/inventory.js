const express = require('express');
const { getDb } = require('../database/init');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db.from('inventory')
      .select('*, products(product_name), users(full_name)')
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw error;

    const logs = data.map(i => ({
      ...i,
      product_name: i.products?.product_name,
      user_name: i.users?.full_name,
      products: undefined,
      users: undefined
    }));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const threshold = req.query.threshold || 10;
    const { data, error } = await db.from('products').select('*').lte('quantity', threshold).order('quantity');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/adjust', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res) => {
  try {
    const db = getDb();
    const { product_id, adjustment_type, quantity_change, notes } = req.body;
    if (!product_id || !adjustment_type || quantity_change === undefined) {
      return res.status(400).json({ error: 'Product ID, adjustment type, and quantity change are required.' });
    }

    const { data, error } = await db.rpc('adjust_stock', {
      p_product_id: parseInt(product_id),
      p_adjustment_type: adjustment_type,
      p_quantity_change: quantity_change,
      p_notes: notes || null,
      p_user_id: req.user.user_id
    });

    if (error) throw error;
    res.json({ message: 'Stock adjusted successfully.', product: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
