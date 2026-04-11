const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

async function paystackRequest(endpoint, method, body) {
  const res = await fetch(`https://api.paystack.co${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${PAYSTACK_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

router.post('/initialize', authenticateToken, async (req, res, next) => {
  try {
    const { amount, email, payment_type, momo_provider, momo_phone } = req.body;

    if (!amount) return res.status(400).json({ error: 'Amount is required.' });

    const amountInPesewas = Math.round(amount * 100);
    const reference = `POS-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    if (payment_type === 'momo') {
      if (!momo_phone) return res.status(400).json({ error: 'Phone number is required for MoMo.' });

      const providerMap = { mtn: 'mtn', telecel: 'vod', airteltigo: 'tgo' };
      const provider = providerMap[momo_provider];
      if (!provider) return res.status(400).json({ error: 'Invalid MoMo provider.' });

      const result = await paystackRequest('/charge', 'POST', {
        amount: amountInPesewas,
        email: email || 'pos@adamsstore.com',
        currency: 'GHS',
        reference,
        mobile_money: {
          phone: momo_phone,
          provider
        }
      });

      if (!result.status) return res.status(400).json({ error: result.message || 'MoMo charge failed.' });

      res.json({
        reference,
        status: result.data.status,
        display_text: result.data.display_text || 'Check your phone to approve the payment.',
        paystack_status: result.data.status
      });
    } else {
      const result = await paystackRequest('/transaction/initialize', 'POST', {
        amount: amountInPesewas,
        email: email || 'pos@adamsstore.com',
        currency: 'GHS',
        reference,
        channels: ['card']
      });

      if (!result.status) return res.status(400).json({ error: result.message || 'Failed to initialize payment.' });

      res.json({
        reference,
        authorization_url: result.data.authorization_url,
        access_code: result.data.access_code
      });
    }
  } catch (err) {
    next(err);
  }
});

router.get('/verify/:reference', authenticateToken, async (req, res, next) => {
  try {
    const result = await paystackRequest(`/transaction/verify/${req.params.reference}`, 'GET');

    if (!result.status) return res.status(400).json({ error: result.message || 'Verification failed.' });

    res.json({
      reference: result.data.reference,
      status: result.data.status,
      amount: result.data.amount / 100,
      channel: result.data.channel,
      paid_at: result.data.paid_at
    });
  } catch (err) {
    next(err);
  }
});

router.post('/submit_otp', authenticateToken, async (req, res, next) => {
  try {
    const { reference, otp } = req.body;
    if (!reference || !otp) return res.status(400).json({ error: 'Reference and OTP are required.' });

    const result = await paystackRequest('/charge/submit_otp', 'POST', { reference, otp });
    
    if (!result.status) return res.status(400).json({ error: result.message || 'OTP submission failed.' });

    res.json({
      reference: result.data.reference || reference,
      status: result.data.status,
      display_text: result.data.display_text || result.message || 'Payment processed.',
      paystack_status: result.data.status
    });
  } catch (err) {
    next(err);
  }
});

router.post('/submit_phone', authenticateToken, async (req, res, next) => {
  try {
    const { reference, phone } = req.body;
    if (!reference || !phone) return res.status(400).json({ error: 'Reference and Phone are required.' });

    const result = await paystackRequest('/charge/submit_phone', 'POST', { reference, phone });
    
    if (!result.status) return res.status(400).json({ error: result.message || 'Phone submission failed.' });

    res.json({
      reference: result.data.reference || reference,
      status: result.data.status,
      display_text: result.data.display_text || result.message || 'Payment processed.',
      paystack_status: result.data.status
    });
  } catch (err) {
    next(err);
  }
});

router.post('/submit_birthday', authenticateToken, async (req, res, next) => {
  try {
    const { reference, birthday } = req.body;
    if (!reference || !birthday) return res.status(400).json({ error: 'Reference and Birthday are required.' });

    const result = await paystackRequest('/charge/submit_birthday', 'POST', { reference, birthday });
    
    if (!result.status) return res.status(400).json({ error: result.message || 'Birthday submission failed.' });

    res.json({
      reference: result.data.reference || reference,
      status: result.data.status,
      display_text: result.data.display_text || result.message || 'Payment processed.',
      paystack_status: result.data.status
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
