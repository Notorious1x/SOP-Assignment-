const express = require('express');
const { getDb } = require('../database/init');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    let query = db.from('products').select('*');
    const { search, category } = req.query;

    if (search) query = query.or(`product_name.ilike.%${search}%,barcode.ilike.%${search}%`);
    if (category) query = query.eq('category', category);
    query = query.order('product_name');

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/categories', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.from('products').select('category').not('category', 'is', null);
    if (error) throw error;
    const categories = [...new Set(data.map(c => c.category))].sort();
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

router.get('/barcode/:barcode', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.from('products').select('*').eq('barcode', req.params.barcode).limit(1);
    if (error) throw error;
    if (!data[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.from('products').select('*').eq('product_id', req.params.id).limit(1);
    if (error) throw error;
    if (!data[0]) return res.status(404).json({ error: 'Product not found.' });
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const { product_name, category, price, quantity, barcode, supplier } = req.body;
    if (!product_name || price === undefined) return res.status(400).json({ error: 'Product name and price are required.' });
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Invalid price.' });
    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) return res.status(400).json({ error: 'Invalid quantity.' });

    const { data, error } = await db.from('products').insert({
      product_name, category: category || null, price, quantity: quantity || 0, barcode: barcode || null, supplier: supplier || null
    }).select();
    if (error) {
      if (error.message.includes('duplicate')) return res.status(400).json({ error: 'A product with that barcode already exists.' });
      throw error;
    }
    res.status(201).json(data[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const { product_name, category, price, quantity, barcode, supplier } = req.body;

    const { data: existing } = await db.from('products').select('*').eq('product_id', req.params.id).limit(1);
    if (!existing[0]) return res.status(404).json({ error: 'Product not found.' });
    const e = existing[0];

    if (price !== undefined && (isNaN(price) || price < 0)) return res.status(400).json({ error: 'Invalid price.' });
    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) return res.status(400).json({ error: 'Invalid quantity.' });

    if (price !== undefined && (isNaN(price) || price < 0)) return res.status(400).json({ error: 'Invalid price.' });
    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) return res.status(400).json({ error: 'Invalid quantity.' });

    const { data, error } = await db.from('products').update({
      product_name: product_name || e.product_name,
      category: category !== undefined ? category : e.category,
      price: price !== undefined ? price : e.price,
      quantity: quantity !== undefined ? quantity : e.quantity,
      barcode: barcode !== undefined ? barcode : e.barcode,
      supplier: supplier !== undefined ? supplier : e.supplier
    }).eq('product_id', req.params.id).select();
    if (error) {
      if (error.message.includes('duplicate')) return res.status(400).json({ error: 'A product with that barcode already exists.' });
      throw error;
    }
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const db = getDb();
    const { data: existing } = await db.from('products').select('product_id').eq('product_id', req.params.id).limit(1);
    if (!existing[0]) return res.status(404).json({ error: 'Product not found.' });

    const { error } = await db.from('products').delete().eq('product_id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
