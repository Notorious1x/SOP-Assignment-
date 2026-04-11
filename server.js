require('dotenv').config();

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_KEY', 'JWT_SECRET'];
for (const envVar of requiredEnv) {
  if (!process.env[envVar]) {
    console.error(`CRITICAL: Missing environment variable ${envVar}`);
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./database/init');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false })); // Disabled CSP to avoid breaking inline scripts and CDNs
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api', limiter); // Apply rate limiter to API routes

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/paystack', require('./routes/paystack'));

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'An internal server error occurred.' });
});

app.get('/api/config', (req, res) => {
  res.json({ paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || '' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

async function start() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`POS System running at http://localhost:${PORT}`);
  });
}

start();
