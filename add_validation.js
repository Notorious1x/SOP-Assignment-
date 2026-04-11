const fs = require('fs');
const path = require('path');

const prodFile = path.join(__dirname, 'routes', 'products.js');
let content = fs.readFileSync(prodFile, 'utf8');
content = content.replace(
  "if (!product_name || price === undefined) return res.status(400).json({ error: 'Product name and price are required.' });",
  "if (!product_name || price === undefined) return res.status(400).json({ error: 'Product name and price are required.' });\n    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Invalid price.' });\n    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) return res.status(400).json({ error: 'Invalid quantity.' });"
);

content = content.replace(
  "const e = existing[0];",
  "const e = existing[0];\n\n    if (price !== undefined && (isNaN(price) || price < 0)) return res.status(400).json({ error: 'Invalid price.' });\n    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) return res.status(400).json({ error: 'Invalid quantity.' });"
);
fs.writeFileSync(prodFile, content);

const salesFile = path.join(__dirname, 'routes', 'sales.js');
let salesContent = fs.readFileSync(salesFile, 'utf8');
salesContent = salesContent.replace(
  "if (!payment_method) return res.status(400).json({ error: 'Payment method is required.' });",
  "if (!payment_method) return res.status(400).json({ error: 'Payment method is required.' });\n    if (amount_paid !== undefined && (isNaN(amount_paid) || amount_paid < 0)) return res.status(400).json({ error: 'Invalid amount paid.' });\n    if (discount_amount !== undefined && (isNaN(discount_amount) || discount_amount < 0)) return res.status(400).json({ error: 'Invalid discount amount.' });"
);
fs.writeFileSync(salesFile, salesContent);
console.log("Validation added.");
