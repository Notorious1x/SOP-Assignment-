const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

    const db = getDb();
    const { data: users, error } = await db.from('users').select('*').eq('username', username).limit(1);
    if (error) throw error;
    const user = users[0];

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role, full_name: user.full_name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Login successful', token,
      user: { user_id: user.user_id, username: user.username, full_name: user.full_name, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateToken, (req, res, next) => {
  res.json({ user: req.user });
});

module.exports = router;
