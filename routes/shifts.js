const express = require('express');
const { getDb } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/active', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { data, error } = await db.from('shifts').select('*')
      .eq('user_id', req.user.user_id).eq('status', 'active').limit(1);
    if (error) throw error;
    res.json(data[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { data: existing } = await db.from('shifts').select('shift_id')
      .eq('user_id', req.user.user_id).eq('status', 'active').limit(1);
    if (existing && existing[0]) return res.status(400).json({ error: 'You already have an active shift.' });

    const { starting_cash } = req.body;
    const { data, error } = await db.from('shifts').insert({
      user_id: req.user.user_id,
      starting_cash: starting_cash || 0
    }).select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/end', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { data: active } = await db.from('shifts').select('shift_id')
      .eq('user_id', req.user.user_id).eq('status', 'active').limit(1);
    if (!active || !active[0]) return res.status(400).json({ error: 'No active shift found.' });

    const { ending_cash, notes } = req.body;
    const { data, error } = await db.rpc('end_shift', {
      p_shift_id: active[0].shift_id,
      p_ending_cash: ending_cash || 0,
      p_notes: notes || null
    });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    let query = db.from('shifts').select('*, users(full_name, username)').order('start_time', { ascending: false }).limit(50);
    if (req.user.role === 'cashier') query = query.eq('user_id', req.user.user_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data.map(s => ({
      ...s,
      full_name: s.users?.full_name,
      username: s.users?.username,
      users: undefined
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
