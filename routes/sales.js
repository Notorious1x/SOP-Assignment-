const express = require('express');
const { getDb } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    let query = db.from('sales').select('*, users!sales_user_id_fkey(full_name), customers(name)');
    const { date_from, date_to, user_id } = req.query;

    if (date_from) query = query.gte('date', date_from);
    if (date_to) query = query.lte('date', date_to + 'T23:59:59');
    if (user_id) query = query.eq('user_id', user_id);
    query = query.order('date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const sales = data.map(s => ({
      ...s,
      cashier_name: s.users?.full_name || null,
      customer_name: s.customers?.name || null,
      users: undefined,
      customers: undefined
    }));
    res.json(sales);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { data: sales, error } = await db.from('sales')
      .select('*, users!sales_user_id_fkey(full_name), customers(name)')
      .eq('sale_id', req.params.id).limit(1);
    if (error) throw error;
    if (!sales[0]) return res.status(404).json({ error: 'Sale not found.' });

    const sale = sales[0];
    const { data: items } = await db.from('sale_items')
      .select('*, products(product_name, barcode)')
      .eq('sale_id', req.params.id);

    const { data: payments } = await db.from('payments').select('*').eq('sale_id', req.params.id).limit(1);

    const saleItems = (items || []).map(i => ({
      ...i,
      product_name: i.products?.product_name,
      barcode: i.products?.barcode,
      products: undefined
    }));

    res.json({
      ...sale,
      cashier_name: sale.users?.full_name || null,
      customer_name: sale.customers?.name || null,
      users: undefined,
      customers: undefined,
      items: saleItems,
      payment: payments?.[0] || null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const db = getDb();
    const { customer_id, items, payment_method, amount_paid, discount_amount, tax_rate, shift_id, paystack_reference, momo_provider, momo_phone } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ error: 'Sale must have at least one item.' });
    if (!payment_method) return res.status(400).json({ error: 'Payment method is required.' });
    if (amount_paid !== undefined && (isNaN(amount_paid) || amount_paid < 0)) return res.status(400).json({ error: 'Invalid amount paid.' });
    if (discount_amount !== undefined && (isNaN(discount_amount) || discount_amount < 0)) return res.status(400).json({ error: 'Invalid discount amount.' });

    const { data, error } = await db.rpc('process_sale', {
      p_user_id: req.user.user_id,
      p_customer_id: customer_id ? parseInt(customer_id) : null,
      p_items: items,
      p_payment_method: payment_method,
      p_amount_paid: amount_paid || null,
      p_discount: discount_amount || 0,
      p_tax_rate: tax_rate || 0,
      p_shift_id: shift_id || null,
      p_paystack_reference: paystack_reference || null,
      p_momo_provider: momo_provider || null,
      p_momo_phone: momo_phone || null
    });

    if (error) throw error;

    const saleId = data.sale_id;

    // Fetch complete sale
    const { data: sales } = await db.from('sales')
      .select('*, users!sales_user_id_fkey(full_name), customers(name)')
      .eq('sale_id', saleId).limit(1);

    const { data: saleItems } = await db.from('sale_items')
      .select('*, products(product_name, barcode)')
      .eq('sale_id', saleId);

    const { data: payments } = await db.from('payments').select('*').eq('sale_id', saleId).limit(1);

    const sale = sales[0];
    res.status(201).json({
      ...sale,
      cashier_name: sale.users?.full_name || null,
      customer_name: sale.customers?.name || null,
      users: undefined,
      customers: undefined,
      items: (saleItems || []).map(i => ({
        ...i, product_name: i.products?.product_name, barcode: i.products?.barcode, products: undefined
      })),
      payment: payments?.[0] || null,
      change_amount: data.change_amount
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
