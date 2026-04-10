const express = require('express');
const { getDb } = require('../database/init');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/export', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const db = getDb();
    const [users, products, customers, sales, saleItems, inventory, payments] = await Promise.all([
      db.from('users').select('user_id, username, full_name, role, created_at'),
      db.from('products').select('*'),
      db.from('customers').select('*'),
      db.from('sales').select('*'),
      db.from('sale_items').select('*'),
      db.from('inventory').select('*'),
      db.from('payments').select('*'),
    ]);

    const data = {
      exportDate: new Date().toISOString(),
      users: users.data, products: products.data, customers: customers.data,
      sales: sales.data, sale_items: saleItems.data, inventory: inventory.data, payments: payments.data,
    };

    const filename = `pos_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.json({ message: 'Backup created successfully.', filename, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/list', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  res.json([]);
});

module.exports = router;
