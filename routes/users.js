const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/init');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const db = getDb();
    const { data, error } = await db.from('users').select('user_id, username, full_name, role, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const db = getDb();
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name || !role) return res.status(400).json({ error: 'All fields are required.' });
    if (!['admin', 'manager', 'cashier'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });

    const { data, error } = await db.from('users').insert({
      username, password: bcrypt.hashSync(password, 10), full_name, role
    }).select('user_id, username, full_name, role, created_at');
    if (error) {
      if (error.message.includes('duplicate')) return res.status(400).json({ error: 'Username already exists.' });
      throw error;
    }
    res.status(201).json(data[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res, next) => {
  try {
    const db = getDb();
    const { username, password, full_name, role } = req.body;

    const { data: existing } = await db.from('users').select('*').eq('user_id', req.params.id).limit(1);
    if (!existing[0]) return res.status(404).json({ error: 'User not found.' });
    if (role && !['admin', 'manager', 'cashier'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });

    const updates = {
      username: username || existing[0].username,
      password: password ? bcrypt.hashSync(password, 10) : existing[0].password,
      full_name: full_name || existing[0].full_name,
      role: role || existing[0].role
    };

    const { data, error } = await db.from('users').update(updates).eq('user_id', req.params.id).select('user_id, username, full_name, role, created_at');
    if (error) {
      if (error.message.includes('duplicate')) return res.status(400).json({ error: 'Username already exists.' });
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
    if (parseInt(req.params.id) === req.user.user_id) return res.status(400).json({ error: 'Cannot delete your own account.' });

    const { data: existing } = await db.from('users').select('user_id').eq('user_id', req.params.id).limit(1);
    if (!existing[0]) return res.status(404).json({ error: 'User not found.' });

    const { error } = await db.from('users').delete().eq('user_id', req.params.id);
    if (error) throw error;
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
