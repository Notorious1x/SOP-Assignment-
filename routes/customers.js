const express = require('express');
const { getDb } = require('../database/init');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    let query = db.from('customers').select('*');
    const { search } = req.query;
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    query = query.order('name');

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { data: customers, error } = await db.from('customers').select('*').eq('customer_id', req.params.id).limit(1);
    if (error) throw error;
    if (!customers[0]) return res.status(404).json({ error: 'Customer not found.' });

    const { data: purchases } = await db.from('sales').select('sale_id, date, total_amount, payment_method')
      .eq('customer_id', req.params.id).order('date', { ascending: false }).limit(20);

    res.json({ ...customers[0], purchases: purchases || [] });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Customer name is required.' });

    const { data, error } = await db.from('customers').insert({
      name, phone: phone || null, email: email || null, address: address || null
    }).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { name, phone, email, address } = req.body;

    const { data: existing } = await db.from('customers').select('*').eq('customer_id', req.params.id).limit(1);
    if (!existing[0]) return res.status(404).json({ error: 'Customer not found.' });
    const e = existing[0];

    const { data, error } = await db.from('customers').update({
      name: name || e.name,
      phone: phone !== undefined ? phone : e.phone,
      email: email !== undefined ? email : e.email,
      address: address !== undefined ? address : e.address
    }).eq('customer_id', req.params.id).select();
    if (error) throw error;
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateToken, authorizeRoles('admin', 'manager'), async (req, res, next) => {
  try {
    const db = getDb();
    const { data: existing } = await db.from('customers').select('customer_id').eq('customer_id', req.params.id).limit(1);
    if (!existing[0]) return res.status(404).json({ error: 'Customer not found.' });

    const { error } = await db.from('customers').delete().eq('customer_id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Customer deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
