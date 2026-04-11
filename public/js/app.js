const API = '';
let token = localStorage.getItem('pos_token');
let currentUser = JSON.parse(localStorage.getItem('pos_user') || 'null');
let cart = [];
let allProducts = [];
let allCustomers = [];
let activeShift = null;
let paystackKey = '';

function fmt(v) { return Number(v || 0).toFixed(2); }

if (!token || !currentUser) {
  window.location.href = '/';
}

function headers() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

async function api(url, options = {}) {
  const res = await fetch(API + url, { ...options, headers: headers() });
  if (res.status === 401) {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    window.location.href = '/';
    return;
  }
  if (res.status === 403) {
    const errData = await res.json();
    throw new Error(errData.error || 'Access denied. Insufficient permissions.');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!token || !currentUser) return; // Prevent execution if unauthenticated
  setupUI();
  setupNavigation();
  setupPOS();
  setupProducts();
  setupCustomers();
  setupInventory();
  setupSales();
  setupReports();
  setupUsers();
  setupBackup();
  setupSettings();
  setupModals();
  setupShifts();
  loadConfig();
  loadActiveShift();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  loadPOS();
});

function setupUI() {
  document.getElementById('navUserName').textContent = currentUser.full_name;
  document.getElementById('navUserRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);

  if (currentUser.role === 'admin' || currentUser.role === 'manager') {
    document.getElementById('adminNav').classList.remove('hidden');
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  }

  if (currentUser.role === 'admin') {
    document.querySelectorAll('.admin-only-strict').forEach(el => el.classList.remove('hidden'));
  }

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
    window.location.href = '/';
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.toggle('hidden');
  });
  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.add('hidden');
  });
}

function updateDateTime() {
  const now = new Date();
  document.getElementById('currentDateTime').textContent = now.toLocaleString();
}

function setupNavigation() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      switchView(view);
      document.getElementById('sidebar').classList.add('-translate-x-full');
      document.getElementById('sidebarOverlay').classList.add('hidden');
    });
  });
}

function switchView(view) {
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.remove('active', 'bg-blue-50', 'text-blue-700');
    l.classList.add('text-gray-600', 'hover:bg-gray-100');
  });
  const activeLink = document.querySelector(`.nav-link[data-view="${view}"]`);
  if (activeLink) {
    activeLink.classList.add('active', 'bg-blue-50', 'text-blue-700');
    activeLink.classList.remove('text-gray-600', 'hover:bg-gray-100');
  }

  if (view === 'products') loadProducts();
  else if (view === 'inventory') loadInventory();
  else if (view === 'customers') loadCustomersTable();
  else if (view === 'sales') loadSales();
  else if (view === 'reports') loadReport('daily');
  else if (view === 'users') loadUsers();
  else if (view === 'backup') loadBackups();
  else if (view === 'shifts') loadShifts();
  else if (view === 'settings') {} // static view
  else if (view === 'pos') loadPOS();
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const msg = document.getElementById('toastMsg');
  msg.textContent = message;
  icon.className = type === 'success' ? 'fas fa-check-circle text-green-400' :
    type === 'error' ? 'fas fa-times-circle text-red-400' : 'fas fa-info-circle text-blue-400';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function setupModals() {
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });
}

async function loadPOS() {
  try {
    allProducts = (await api('/api/products')).map(p => ({ ...p, price: Number(p.price), quantity: Number(p.quantity) }));
    allCustomers = await api('/api/customers');
    renderPOSProducts(allProducts);
    loadPOSCategories();
    loadPOSCustomers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function loadPOSCategories() {
  const select = document.getElementById('posCategoryFilter');
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
  select.innerHTML = '<option value="">All Categories</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function loadPOSCustomers() {
  const select = document.getElementById('posCustomer');
  select.innerHTML = '<option value="">Walk-in Customer</option>' +
    allCustomers.map(c => `<option value="${c.customer_id}">${c.name}</option>`).join('');
}

function renderPOSProducts(products) {
  const grid = document.getElementById('posProductGrid');
  if (products.length === 0) {
    grid.innerHTML = '<p class="col-span-full text-center text-gray-400 py-8">No products found</p>';
    return;
  }
  grid.innerHTML = products.map(p => `
    <button onclick="addToCart(${p.product_id})"
      class="bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 text-left transition ${p.quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}"
      ${p.quantity <= 0 ? 'disabled' : ''}>
      <p class="font-medium text-gray-800 text-sm truncate">${p.product_name}</p>
      <p class="text-xs text-gray-500 mt-1">${p.category || 'Uncategorized'}</p>
      <div class="flex justify-between items-center mt-2">
        <span class="text-blue-600 font-bold text-sm">GH₵${fmt(p.price)}</span>
        <span class="text-xs ${p.quantity <= 10 ? 'text-red-500' : 'text-gray-400'}">Qty: ${p.quantity}</span>
      </div>
    </button>
  `).join('');
}

function setupPOS() {
  let searchTimeout;
  document.getElementById('posSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const search = e.target.value.toLowerCase();
      const category = document.getElementById('posCategoryFilter').value;
      let filtered = allProducts.filter(p =>
        (p.product_name.toLowerCase().includes(search) || (p.barcode && p.barcode.includes(search)))
      );
      if (category) filtered = filtered.filter(p => p.category === category);
      renderPOSProducts(filtered);
    }, 300);
  });

  document.getElementById('posCategoryFilter').addEventListener('change', (e) => {
    const search = document.getElementById('posSearch').value.toLowerCase();
    let filtered = allProducts;
    if (search) filtered = filtered.filter(p =>
      p.product_name.toLowerCase().includes(search) || (p.barcode && p.barcode.includes(search)));
    if (e.target.value) filtered = filtered.filter(p => p.category === e.target.value);
    renderPOSProducts(filtered);
  });

  document.getElementById('cartDiscount').addEventListener('input', updateCartTotals);
  document.getElementById('cartTax').addEventListener('input', updateCartTotals);

  document.getElementById('paymentMethod').addEventListener('change', (e) => {
    document.getElementById('cashPaymentSection').style.display = e.target.value === 'cash' ? 'block' : 'none';
    document.getElementById('momoPaymentSection').classList.toggle('hidden', e.target.value !== 'momo');
    document.getElementById('cardPaymentSection').classList.toggle('hidden', e.target.value !== 'card');
  });

  document.getElementById('amountPaid').addEventListener('input', (e) => {
    const total = parseFloat(document.getElementById('cartTotal').textContent.replace('GH₵', '')) || 0;
    const paid = parseFloat(e.target.value) || 0;
    const change = paid - total;
    const display = document.getElementById('changeDisplay');
    if (paid > 0) {
      display.classList.remove('hidden');
      display.innerHTML = `Change: <span class="font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}">GH₵${change.toFixed(2)}</span>`;
    } else {
      display.classList.add('hidden');
    }
  });

  document.getElementById('checkoutBtn').addEventListener('click', processCheckout);

  document.getElementById('clearCartBtn').addEventListener('click', () => {
    cart = [];
    renderCart();
  });

  document.getElementById('paystackActionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reference = document.getElementById('paystackActionRef').value;
    const type = document.getElementById('paystackActionType').value;
    const inputValue = document.getElementById('paystackActionInput').value.trim();
    if (!inputValue) return;

    const submitBtn = document.getElementById('paystackActionSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    const endpointMap = {
      'send_otp': '/api/paystack/submit_otp',
      'send_phone': '/api/paystack/submit_phone',
      'send_birthday': '/api/paystack/submit_birthday'
    };

    const bodyField = type.replace('send_', '');
    try {
      const response = await api(endpointMap[type], {
        method: 'POST',
        body: JSON.stringify({ reference, [bodyField]: inputValue })
      });
      document.getElementById('paystackActionModal').classList.add('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit';
      await handlePaystackStatus(response, window._paystackContext);
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit';
    }
  });
}

function addToCart(productId) {
  const product = allProducts.find(p => p.product_id === productId);
  if (!product || product.quantity <= 0) return;

  const existing = cart.find(item => item.product_id === productId);
  if (existing) {
    if (existing.quantity >= product.quantity) {
      showToast('Not enough stock', 'error');
      return;
    }
    existing.quantity++;
  } else {
    cart.push({ product_id: productId, product_name: product.product_name, price: product.price, quantity: 1, max_qty: product.quantity });
  }
  renderCart();
}

function updateCartItemQty(productId, delta) {
  const item = cart.find(i => i.product_id === productId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.product_id !== productId);
  } else if (item.quantity > item.max_qty) {
    item.quantity = item.max_qty;
    showToast('Not enough stock', 'error');
  }
  renderCart();
}

function removeCartItem(productId) {
  cart = cart.filter(i => i.product_id !== productId);
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItems');
  if (cart.length === 0) {
    container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">Cart is empty</p>';
    document.getElementById('checkoutBtn').disabled = true;
  } else {
    container.innerHTML = cart.map(item => `
      <div class="flex items-center justify-between bg-gray-50 rounded-lg p-2">
        <div class="flex-1 min-w-0 mr-2">
          <p class="text-sm font-medium text-gray-800 truncate">${item.product_name}</p>
          <p class="text-xs text-gray-500">GH₵${item.price.toFixed(2)} each</p>
        </div>
        <div class="flex items-center gap-1">
          <button onclick="updateCartItemQty(${item.product_id}, -1)" class="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs flex items-center justify-center">-</button>
          <span class="w-8 text-center text-sm font-medium">${item.quantity}</span>
          <button onclick="updateCartItemQty(${item.product_id}, 1)" class="w-6 h-6 bg-gray-200 hover:bg-gray-300 rounded text-xs flex items-center justify-center">+</button>
          <button onclick="removeCartItem(${item.product_id})" class="w-6 h-6 text-red-500 hover:bg-red-50 rounded text-xs flex items-center justify-center ml-1">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <span class="text-sm font-medium text-gray-800 w-16 text-right">GH₵${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');
    document.getElementById('checkoutBtn').disabled = false;
  }
  updateCartTotals();
}

function updateCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = parseFloat(document.getElementById('cartDiscount').value) || 0;
  const taxRate = parseFloat(document.getElementById('cartTax').value) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - discount;

  document.getElementById('cartSubtotal').textContent = `GH₵${subtotal.toFixed(2)}`;
  document.getElementById('cartTotal').textContent = `GH₵${Math.max(0, total).toFixed(2)}`;
}

async function processCheckout() {
  if (cart.length === 0) return;

  const paymentMethod = document.getElementById('paymentMethod').value;
  const total = parseFloat(document.getElementById('cartTotal').textContent.replace('GH₵', ''));
  const customerId = document.getElementById('posCustomer').value || null;
  const discount = parseFloat(document.getElementById('cartDiscount').value) || 0;
  const taxRate = parseFloat(document.getElementById('cartTax').value) || 0;

  if (paymentMethod === 'cash') {
    const amountPaid = parseFloat(document.getElementById('amountPaid').value) || 0;
    if (amountPaid < total) { showToast('Insufficient payment amount', 'error'); return; }
    await completeSale({ paymentMethod, amountPaid, customerId, discount, taxRate });

  } else if (paymentMethod === 'momo') {
    const momoProvider = document.getElementById('momoProvider').value;
    const momoPhone = document.getElementById('momoPhone').value.trim();
    if (!momoPhone) { showToast('Enter phone number for MoMo', 'error'); return; }

    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing MoMo...';

    try {
      const init = await api('/api/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({ amount: total, payment_type: 'momo', momo_provider: momoProvider, momo_phone: momoPhone })
      });

      const context = { paymentMethod: 'momo', total, customerId, discount, taxRate, momoProvider, momoPhone };
      await handlePaystackStatus(init, context);
    } catch (err) {
      showToast(err.message, 'error');
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale';
    }

  } else if (paymentMethod === 'card') {
    if (!paystackKey) { showToast('Paystack not configured', 'error'); return; }

    try {
      const init = await api('/api/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({ amount: total, payment_type: 'card' })
      });

      const handler = PaystackPop.setup({
        key: paystackKey,
        email: 'pos@adamsstore.com',
        amount: Math.round(total * 100),
        currency: 'GHS',
        ref: init.reference,
        callback: async (response) => {
          try {
            const verify = await api(`/api/paystack/verify/${response.reference}`);
            if (verify.status === 'success') {
              await completeSale({ paymentMethod: 'card', amountPaid: total, customerId, discount, taxRate, paystackReference: response.reference });
            } else {
              showToast('Card payment failed', 'error');
            }
          } catch (err) {
            showToast(err.message, 'error');
          }
        },
        onClose: () => { showToast('Payment cancelled', 'info'); }
      });
      handler.openIframe();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

async function completeSale({ paymentMethod, amountPaid, customerId, discount, taxRate, paystackReference, momoProvider, momoPhone }) {
  try {
    const sale = await api('/api/sales', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId ? parseInt(customerId) : null,
        items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        payment_method: paymentMethod,
        amount_paid: amountPaid,
        discount_amount: discount,
        tax_rate: taxRate,
        shift_id: activeShift ? activeShift.shift_id : null,
        paystack_reference: paystackReference || null,
        momo_provider: momoProvider || null,
        momo_phone: momoPhone || null
      })
    });

    showToast('Sale completed successfully!');
    showReceipt(sale);
    cart = [];
    renderCart();
    document.getElementById('cartDiscount').value = 0;
    document.getElementById('amountPaid').value = '';
    document.getElementById('momoPhone').value = '';
    document.getElementById('changeDisplay').classList.add('hidden');
    document.getElementById('checkoutBtn').disabled = false;
    document.getElementById('checkoutBtn').innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale';
    loadPOS();
  } catch (err) {
    showToast(err.message, 'error');
    document.getElementById('checkoutBtn').disabled = false;
    document.getElementById('checkoutBtn').innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale';
  }
}

async function handlePaystackStatus(init, context) {
  const { paymentMethod, total, customerId, discount, taxRate, momoProvider, momoPhone } = context;
  const status = init.paystack_status || init.status;
  
  if (status === 'send_otp' || status === 'send_phone' || status === 'send_birthday') {
    document.getElementById('paystackActionRef').value = init.reference;
    document.getElementById('paystackActionType').value = status;
    const titleObj = {
      'send_otp': 'Enter OTP',
      'send_phone': 'Enter Phone Number',
      'send_birthday': 'Enter Birthday (YYYY-MM-DD)'
    };
    document.getElementById('paystackActionTitle').innerHTML = `<i class="fas fa-mobile-alt text-blue-600 mr-2"></i>${titleObj[status]}`;
    document.getElementById('paystackActionDesc').textContent = init.display_text || `Please enter your ${status.split('_')[1]}`;
    document.getElementById('paystackActionInput').value = '';
    document.getElementById('paystackActionInput').placeholder = titleObj[status];
    document.getElementById('paystackActionInput').type = status === 'send_birthday' ? 'date' : 'text';
    document.getElementById('paystackActionModal').classList.remove('hidden');
    window._paystackContext = context;
    return;
  }
  
  if (status === 'pay_offline' || status === 'pending') {
    showToast(init.display_text || 'Check your phone to approve payment', 'info');
    pollPaystackPayment(init.reference, context);
    return;
  }
  
  if (status === 'success') {
    await completeSale({ paymentMethod, amountPaid: total, customerId, discount, taxRate, paystackReference: init.reference, momoProvider, momoPhone });
    return;
  }
  
  showToast(init.display_text || 'Payment failed', 'error');
  const checkoutBtn = document.getElementById('checkoutBtn');
  checkoutBtn.disabled = false;
  checkoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale';
}

function pollPaystackPayment(reference, context) {
  const { paymentMethod, total, customerId, discount, taxRate, momoProvider, momoPhone } = context;
  const checkoutBtn = document.getElementById('checkoutBtn');
  let attempts = 0;
  const pollInterval = setInterval(async () => {
    attempts++;
    try {
      const verify = await api(`/api/paystack/verify/${reference}`);
      if (verify.status === 'success') {
        clearInterval(pollInterval);
        await completeSale({ paymentMethod, amountPaid: total, customerId, discount, taxRate, paystackReference: reference, momoProvider, momoPhone });
      } else if (attempts >= 60) {
        clearInterval(pollInterval);
        showToast('Payment timed out. Try again.', 'error');
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale';
      }
    } catch (e) {
      if (attempts >= 60) {
        clearInterval(pollInterval);
        showToast('Payment verification failed', 'error');
        checkoutBtn.disabled = false;
        checkoutBtn.innerHTML = '<i class="fas fa-check-circle"></i> Complete Sale';
      }
    }
  }, 5000);
}

function showReceipt(sale) {
  sale.subtotal = Number(sale.subtotal);
  sale.tax_amount = Number(sale.tax_amount);
  sale.discount_amount = Number(sale.discount_amount);
  sale.total_amount = Number(sale.total_amount);
  sale.change_amount = Number(sale.change_amount || 0);
  if (sale.payment) sale.payment.amount_paid = Number(sale.payment.amount_paid);
  if (sale.items) sale.items.forEach(i => { i.subtotal = Number(i.subtotal); });
  const content = document.getElementById('receiptContent');
  const date = new Date(sale.date).toLocaleString();
  content.innerHTML = `
    <div class="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
      <h4 class="font-bold text-lg">ADAMS STORE</h4>
      <p class="text-xs text-gray-500">Accra, Ghana</p>
      <p class="text-xs text-gray-500">Tel: +233 30 000 0000</p>
    </div>
    <div class="text-xs space-y-1 mb-3">
      <p><strong>Receipt #:</strong> ${sale.sale_id}</p>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Cashier:</strong> ${sale.cashier_name}</p>
      ${sale.customer_name ? `<p><strong>Customer:</strong> ${sale.customer_name}</p>` : ''}
    </div>
    <div class="border-t border-dashed border-gray-300 pt-2 mb-2">
      <table class="w-full text-xs">
        <thead><tr class="border-b border-gray-200"><th class="text-left py-1">Item</th><th class="text-center">Qty</th><th class="text-right">Amount</th></tr></thead>
        <tbody>
          ${sale.items.map(i => `
            <tr><td class="py-1">${i.product_name}</td><td class="text-center">${i.quantity}</td><td class="text-right">GH₵${fmt(i.subtotal)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="border-t border-dashed border-gray-300 pt-2 text-xs space-y-1">
      <div class="flex justify-between"><span>Subtotal:</span><span>GH₵${fmt(sale.subtotal)}</span></div>
      ${sale.tax_amount > 0 ? `<div class="flex justify-between"><span>Tax:</span><span>GH₵${fmt(sale.tax_amount)}</span></div>` : ''}
      ${sale.discount_amount > 0 ? `<div class="flex justify-between"><span>Discount:</span><span>-GH₵${fmt(sale.discount_amount)}</span></div>` : ''}
      <div class="flex justify-between font-bold text-sm border-t border-gray-300 pt-1"><span>TOTAL:</span><span>GH₵${fmt(sale.total_amount)}</span></div>
      <div class="flex justify-between"><span>Payment:</span><span>${sale.payment_method}</span></div>
      ${sale.payment ? `<div class="flex justify-between"><span>Paid:</span><span>GH₵${fmt(sale.payment.amount_paid)}</span></div>` : ''}
      ${sale.change_amount > 0 ? `<div class="flex justify-between"><span>Change:</span><span>GH₵${fmt(sale.change_amount)}</span></div>` : ''}
    </div>
    <div class="text-center border-t border-dashed border-gray-300 mt-3 pt-3">
      <p class="text-xs text-gray-500">Thank you for your purchase!</p>
    </div>
  `;
  document.getElementById('receiptModal').classList.remove('hidden');

  document.getElementById('printReceiptBtn').onclick = () => {
    const printWin = window.open('', '_blank', 'width=300,height=600');
    printWin.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;padding:10px;}</style></head><body>${content.innerHTML}</body></html>`);
    printWin.document.close();
    printWin.print();
  };
}

function setupProducts() {
  let searchTimeout;
  document.getElementById('productSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadProducts(), 300);
  });
  document.getElementById('productCategoryFilter').addEventListener('change', () => loadProducts());

  document.getElementById('addProductBtn').addEventListener('click', () => {
    document.getElementById('productModalTitle').textContent = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('productFormId').value = '';
    document.getElementById('productModal').classList.remove('hidden');
  });

  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('productFormId').value;
    const data = {
      product_name: document.getElementById('productFormName').value,
      category: document.getElementById('productFormCategory').value,
      price: parseFloat(document.getElementById('productFormPrice').value),
      quantity: parseInt(document.getElementById('productFormQuantity').value) || 0,
      barcode: document.getElementById('productFormBarcode').value,
      supplier: document.getElementById('productFormSupplier').value
    };

    try {
      if (id) {
        await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showToast('Product updated');
      } else {
        await api('/api/products', { method: 'POST', body: JSON.stringify(data) });
        showToast('Product added');
      }
      document.getElementById('productModal').classList.add('hidden');
      loadProducts();
      loadPOS();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadProducts() {
  try {
    const search = document.getElementById('productSearch').value;
    const category = document.getElementById('productCategoryFilter').value;
    let url = '/api/products?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (category) url += `category=${encodeURIComponent(category)}&`;

    const products = (await api(url)).map(p => ({ ...p, price: Number(p.price), quantity: Number(p.quantity) }));

    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    const catSelect = document.getElementById('productCategoryFilter');
    const currentCat = catSelect.value;
    catSelect.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c}" ${c === currentCat ? 'selected' : ''}>${c}</option>`).join('');

    const tbody = document.getElementById('productTableBody');
    tbody.innerHTML = products.map(p => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3">${p.product_id}</td>
        <td class="px-4 py-3 font-medium">${p.product_name}</td>
        <td class="px-4 py-3">${p.category || '-'}</td>
        <td class="px-4 py-3">GH₵${fmt(p.price)}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${p.quantity <= 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${p.quantity}</span></td>
        <td class="px-4 py-3 text-gray-500">${p.barcode || '-'}</td>
        <td class="px-4 py-3 admin-only ${currentUser.role === 'admin' || currentUser.role === 'manager' ? '' : 'hidden'}">
          <button onclick="editProduct(${p.product_id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
          ${currentUser.role === 'admin' ? `<button onclick="deleteProduct(${p.product_id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editProduct(id) {
  try {
    const p = await api(`/api/products/${id}`);
    document.getElementById('productModalTitle').textContent = 'Edit Product';
    document.getElementById('productFormId').value = p.product_id;
    document.getElementById('productFormName').value = p.product_name;
    document.getElementById('productFormCategory').value = p.category || '';
    document.getElementById('productFormPrice').value = p.price;
    document.getElementById('productFormQuantity').value = p.quantity;
    document.getElementById('productFormBarcode').value = p.barcode || '';
    document.getElementById('productFormSupplier').value = p.supplier || '';
    document.getElementById('productModal').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    showToast('Product deleted');
    loadProducts();
    loadPOS();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupInventory() {
  document.getElementById('stockAdjustForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const productId = document.getElementById('adjProduct').value;
    const type = document.getElementById('adjType').value;
    const qty = parseInt(document.getElementById('adjQuantity').value);
    const notes = document.getElementById('adjNotes').value;

    if (!productId || !qty) {
      showToast('Select a product and enter quantity', 'error');
      return;
    }

    try {
      await api('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({ product_id: parseInt(productId), adjustment_type: type, quantity_change: qty, notes })
      });
      showToast('Stock adjusted successfully');
      document.getElementById('stockAdjustForm').reset();
      loadInventory();
      loadPOS();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadInventory() {
  try {
    const [lowStock, logs, rawProducts] = await Promise.all([
      api('/api/inventory/low-stock?threshold=10'),
      api('/api/inventory'),
      api('/api/products')
    ]);
    const products = rawProducts.map(p => ({ ...p, price: Number(p.price), quantity: Number(p.quantity) }));

    document.getElementById('lowStockCount').textContent = lowStock.length;
    document.getElementById('totalProductsCount').textContent = products.length;
    const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
    document.getElementById('totalStockValue').textContent = `GH₵${totalValue.toFixed(2)}`;

    const lowStockList = document.getElementById('lowStockList');
    if (lowStock.length === 0) {
      lowStockList.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">All products are well stocked!</p>';
    } else {
      lowStockList.innerHTML = lowStock.map(p => `
        <div class="flex items-center justify-between bg-red-50 rounded-lg p-3">
          <div>
            <p class="font-medium text-sm text-gray-800">${p.product_name}</p>
            <p class="text-xs text-gray-500">${p.category || 'Uncategorized'}</p>
          </div>
          <span class="px-2 py-1 rounded-full text-xs font-bold ${p.quantity === 0 ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}">${p.quantity === 0 ? 'OUT OF STOCK' : `${p.quantity} left`}</span>
        </div>
      `).join('');
    }

    const adjSelect = document.getElementById('adjProduct');
    adjSelect.innerHTML = '<option value="">Select Product</option>' +
      products.map(p => `<option value="${p.product_id}">${p.product_name} (Stock: ${p.quantity})</option>`).join('');

    const logContainer = document.getElementById('inventoryLog');
    if (logs.length === 0) {
      logContainer.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No activity yet</p>';
    } else {
      logContainer.innerHTML = logs.slice(0, 20).map(l => `
        <div class="flex items-center gap-3 text-sm py-2 border-b border-gray-100">
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs ${l.quantity_change > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}">
            <i class="fas fa-${l.quantity_change > 0 ? 'plus' : 'minus'}"></i>
          </span>
          <div class="flex-1">
            <span class="font-medium">${l.product_name}</span>
            <span class="text-gray-500 ml-1">(${l.quantity_change > 0 ? '+' : ''}${l.quantity_change})</span>
          </div>
          <span class="text-xs text-gray-400">${l.adjustment_type}</span>
        </div>
      `).join('');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupCustomers() {
  let searchTimeout;
  document.getElementById('customerSearch').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadCustomersTable(), 300);
  });

  document.getElementById('addCustomerBtn').addEventListener('click', () => {
    document.getElementById('customerModalTitle').textContent = 'Add Customer';
    document.getElementById('customerForm').reset();
    document.getElementById('customerFormId').value = '';
    document.getElementById('customerModal').classList.remove('hidden');
  });

  document.getElementById('customerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('customerFormId').value;
    const data = {
      name: document.getElementById('customerFormName').value,
      phone: document.getElementById('customerFormPhone').value,
      email: document.getElementById('customerFormEmail').value,
      address: document.getElementById('customerFormAddress').value
    };

    try {
      if (id) {
        await api(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showToast('Customer updated');
      } else {
        await api('/api/customers', { method: 'POST', body: JSON.stringify(data) });
        showToast('Customer added');
      }
      document.getElementById('customerModal').classList.add('hidden');
      loadCustomersTable();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadCustomersTable() {
  try {
    const search = document.getElementById('customerSearch').value;
    let url = '/api/customers';
    if (search) url += `?search=${encodeURIComponent(search)}`;

    const customers = await api(url);
    const tbody = document.getElementById('customerTableBody');
    tbody.innerHTML = customers.map(c => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3">${c.customer_id}</td>
        <td class="px-4 py-3 font-medium">${c.name}</td>
        <td class="px-4 py-3">${c.phone || '-'}</td>
        <td class="px-4 py-3">${c.email || '-'}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">${c.loyalty_points} pts</span></td>
        <td class="px-4 py-3">
          <button onclick="editCustomer(${c.customer_id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
          <button onclick="deleteCustomer(${c.customer_id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editCustomer(id) {
  try {
    const c = await api(`/api/customers/${id}`);
    document.getElementById('customerModalTitle').textContent = 'Edit Customer';
    document.getElementById('customerFormId').value = c.customer_id;
    document.getElementById('customerFormName').value = c.name;
    document.getElementById('customerFormPhone').value = c.phone || '';
    document.getElementById('customerFormEmail').value = c.email || '';
    document.getElementById('customerFormAddress').value = c.address || '';
    document.getElementById('customerModal').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCustomer(id) {
  if (!confirm('Are you sure you want to delete this customer?')) return;
  try {
    await api(`/api/customers/${id}`, { method: 'DELETE' });
    showToast('Customer deleted');
    loadCustomersTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupSales() {
  document.getElementById('filterSalesBtn').addEventListener('click', loadSales);
}

async function loadSales() {
  try {
    const from = document.getElementById('salesDateFrom').value;
    const to = document.getElementById('salesDateTo').value;
    let url = '/api/sales?';
    if (from) url += `date_from=${from}&`;
    if (to) url += `date_to=${to}&`;

    const sales = (await api(url)).map(s => ({ ...s, total_amount: Number(s.total_amount) }));
    const tbody = document.getElementById('salesTableBody');
    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">No sales found</td></tr>';
      return;
    }
    tbody.innerHTML = sales.map(s => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 font-medium">#${s.sale_id}</td>
        <td class="px-4 py-3">${new Date(s.date).toLocaleString()}</td>
        <td class="px-4 py-3">${s.cashier_name || '-'}</td>
        <td class="px-4 py-3">${s.customer_name || 'Walk-in'}</td>
        <td class="px-4 py-3 font-medium">GH₵${fmt(s.total_amount)}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">${s.payment_method}</span></td>
        <td class="px-4 py-3">
          <button onclick="viewSaleReceipt(${s.sale_id})" class="text-blue-600 hover:text-blue-800"><i class="fas fa-receipt"></i> View</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewSaleReceipt(saleId) {
  try {
    const sale = await api(`/api/sales/${saleId}`);
    showReceipt(sale);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupReports() {
  document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.report-tab').forEach(t => {
        t.classList.remove('bg-blue-600', 'text-white');
        t.classList.add('bg-gray-200', 'text-gray-700');
      });
      tab.classList.remove('bg-gray-200', 'text-gray-700');
      tab.classList.add('bg-blue-600', 'text-white');
      loadReport(tab.dataset.report);
    });
  });
}

async function loadReport(type) {
  document.querySelectorAll('[id^="report"][id$="Content"]').forEach(el => el.classList.add('hidden'));

  try {
    if (type === 'daily') {
      const data = await api('/api/reports/daily');
      const container = document.getElementById('reportDailyContent');
      container.classList.remove('hidden');
      container.innerHTML = `
        <h3 class="font-bold text-gray-800 mb-4">Daily Sales Report - ${data.date}</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-blue-50 rounded-lg p-3"><p class="text-xs text-gray-500">Transactions</p><p class="text-xl font-bold text-blue-700">${data.summary.total_transactions}</p></div>
          <div class="bg-green-50 rounded-lg p-3"><p class="text-xs text-gray-500">Revenue</p><p class="text-xl font-bold text-green-700">GH₵${fmt(data.summary.total_revenue)}</p></div>
          <div class="bg-yellow-50 rounded-lg p-3"><p class="text-xs text-gray-500">Tax Collected</p><p class="text-xl font-bold text-yellow-700">GH₵${fmt(data.summary.total_tax)}</p></div>
          <div class="bg-purple-50 rounded-lg p-3"><p class="text-xs text-gray-500">Avg Transaction</p><p class="text-xl font-bold text-purple-700">GH₵${fmt(data.summary.avg_transaction)}</p></div>
        </div>
        ${data.topProducts.length > 0 ? `
          <h4 class="font-medium text-gray-700 mb-2">Top Selling Products</h4>
          <div class="overflow-x-auto mb-4">
            <table class="w-full text-sm"><thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left">Product</th><th class="px-3 py-2 text-right">Qty Sold</th><th class="px-3 py-2 text-right">Revenue</th></tr></thead>
            <tbody>${data.topProducts.map(p => `<tr class="border-b border-gray-100"><td class="px-3 py-2">${p.product_name}</td><td class="px-3 py-2 text-right">${p.total_qty}</td><td class="px-3 py-2 text-right">GH₵${fmt(p.total_revenue)}</td></tr>`).join('')}</tbody></table>
          </div>
        ` : '<p class="text-gray-400 text-sm">No sales data for this date.</p>'}
        ${data.byPaymentMethod.length > 0 ? `
          <h4 class="font-medium text-gray-700 mb-2">By Payment Method</h4>
          <div class="flex flex-wrap gap-3">
            ${data.byPaymentMethod.map(pm => `<div class="bg-gray-50 rounded-lg px-4 py-2"><p class="text-xs text-gray-500">${pm.payment_method}</p><p class="font-bold">GH₵${fmt(pm.total)} <span class="text-xs font-normal text-gray-400">(${pm.count})</span></p></div>`).join('')}
          </div>
        ` : ''}
      `;

    } else if (type === 'weekly') {
      const data = await api('/api/reports/weekly');
      const container = document.getElementById('reportWeeklyContent');
      container.classList.remove('hidden');
      container.innerHTML = `
        <h3 class="font-bold text-gray-800 mb-4">Weekly Sales Report (Last 7 Days)</h3>
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-blue-50 rounded-lg p-3"><p class="text-xs text-gray-500">Total Transactions</p><p class="text-xl font-bold text-blue-700">${data.summary.total_transactions}</p></div>
          <div class="bg-green-50 rounded-lg p-3"><p class="text-xs text-gray-500">Total Revenue</p><p class="text-xl font-bold text-green-700">GH₵${fmt(data.summary.total_revenue)}</p></div>
          <div class="bg-purple-50 rounded-lg p-3"><p class="text-xs text-gray-500">Avg Transaction</p><p class="text-xl font-bold text-purple-700">GH₵${fmt(data.summary.avg_transaction)}</p></div>
        </div>
        <canvas id="weeklyChart" height="200"></canvas>
      `;
      if (data.dailySales.length > 0) {
        new Chart(document.getElementById('weeklyChart'), {
          type: 'bar',
          data: {
            labels: data.dailySales.map(d => d.day),
            datasets: [{
              label: 'Revenue (GH₵)',
              data: data.dailySales.map(d => d.revenue),
              backgroundColor: 'rgba(59, 130, 246, 0.5)',
              borderColor: 'rgb(59, 130, 246)',
              borderWidth: 1
            }]
          },
          options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
      }

    } else if (type === 'products') {
      const data = await api('/api/reports/products');
      const container = document.getElementById('reportProductsContent');
      container.classList.remove('hidden');
      container.innerHTML = `
        <h3 class="font-bold text-gray-800 mb-4">Product Performance Report</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm"><thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left">Product</th><th class="px-3 py-2">Category</th><th class="px-3 py-2 text-right">Price</th><th class="px-3 py-2 text-right">Stock</th><th class="px-3 py-2 text-right">Total Sold</th><th class="px-3 py-2 text-right">Revenue</th></tr></thead>
          <tbody>${data.map(p => `<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="px-3 py-2 font-medium">${p.product_name}</td><td class="px-3 py-2 text-center">${p.category || '-'}</td><td class="px-3 py-2 text-right">GH₵${fmt(p.price)}</td><td class="px-3 py-2 text-right">${p.current_stock}</td><td class="px-3 py-2 text-right">${p.total_sold}</td><td class="px-3 py-2 text-right font-medium">GH₵${fmt(p.total_revenue)}</td></tr>`).join('')}</tbody></table>
        </div>
      `;

    } else if (type === 'inventory') {
      const data = await api('/api/reports/inventory');
      const container = document.getElementById('reportInventoryContent');
      container.classList.remove('hidden');
      container.innerHTML = `
        <h3 class="font-bold text-gray-800 mb-4">Inventory Report</h3>
        <div class="grid grid-cols-3 gap-4 mb-6">
          <div class="bg-green-50 rounded-lg p-3"><p class="text-xs text-gray-500">Total Stock Value</p><p class="text-xl font-bold text-green-700">GH₵${data.totalValue.toFixed(2)}</p></div>
          <div class="bg-yellow-50 rounded-lg p-3"><p class="text-xs text-gray-500">Low Stock Items</p><p class="text-xl font-bold text-yellow-700">${data.lowStockCount}</p></div>
          <div class="bg-red-50 rounded-lg p-3"><p class="text-xs text-gray-500">Out of Stock</p><p class="text-xl font-bold text-red-700">${data.outOfStockCount}</p></div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm"><thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left">Product</th><th class="px-3 py-2">Category</th><th class="px-3 py-2 text-right">Price</th><th class="px-3 py-2 text-right">Quantity</th><th class="px-3 py-2 text-right">Stock Value</th></tr></thead>
          <tbody>${data.stock.map(p => `<tr class="border-b border-gray-100 ${p.quantity <= 10 ? 'bg-red-50' : ''}"><td class="px-3 py-2 font-medium">${p.product_name}</td><td class="px-3 py-2 text-center">${p.category || '-'}</td><td class="px-3 py-2 text-right">GH₵${fmt(p.price)}</td><td class="px-3 py-2 text-right">${p.quantity}</td><td class="px-3 py-2 text-right">GH₵${fmt(p.stock_value)}</td></tr>`).join('')}</tbody></table>
        </div>
      `;

    } else if (type === 'cashier') {
      const data = await api('/api/reports/cashier');
      const container = document.getElementById('reportCashierContent');
      container.classList.remove('hidden');
      container.innerHTML = `
        <h3 class="font-bold text-gray-800 mb-4">Cashier Performance Report</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-sm"><thead><tr class="bg-gray-50"><th class="px-3 py-2 text-left">Cashier</th><th class="px-3 py-2">Username</th><th class="px-3 py-2 text-right">Transactions</th><th class="px-3 py-2 text-right">Total Revenue</th><th class="px-3 py-2 text-right">Avg Transaction</th></tr></thead>
          <tbody>${data.map(c => `<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="px-3 py-2 font-medium">${c.full_name}</td><td class="px-3 py-2 text-center">${c.username}</td><td class="px-3 py-2 text-right">${c.total_transactions}</td><td class="px-3 py-2 text-right font-medium">GH₵${fmt(c.total_revenue)}</td><td class="px-3 py-2 text-right">GH₵${fmt(c.avg_transaction)}</td></tr>`).join('')}</tbody></table>
        </div>
      `;
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupUsers() {
  document.getElementById('addUserBtn').addEventListener('click', () => {
    document.getElementById('userModalTitle').textContent = 'Add User';
    document.getElementById('userForm').reset();
    document.getElementById('userFormId').value = '';
    document.getElementById('userFormPassword').required = true;
    document.getElementById('pwdHint').textContent = '(required)';
    document.getElementById('userModal').classList.remove('hidden');
  });

  document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('userFormId').value;
    const data = {
      full_name: document.getElementById('userFormFullName').value,
      username: document.getElementById('userFormUsername').value,
      role: document.getElementById('userFormRole').value
    };
    const password = document.getElementById('userFormPassword').value;
    if (password) data.password = password;

    if (!id && !password) {
      showToast('Password is required for new users', 'error');
      return;
    }

    try {
      if (id) {
        await api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
        showToast('User updated');
      } else {
        await api('/api/users', { method: 'POST', body: JSON.stringify(data) });
        showToast('User created');
      }
      document.getElementById('userModal').classList.add('hidden');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadUsers() {
  try {
    const users = await api('/api/users');
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = users.map(u => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3">${u.user_id}</td>
        <td class="px-4 py-3 font-medium">${u.username}</td>
        <td class="px-4 py-3">${u.full_name}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'manager' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}">${u.role}</span></td>
        <td class="px-4 py-3 text-gray-500">${new Date(u.created_at).toLocaleDateString()}</td>
        <td class="px-4 py-3">
          <button onclick="editUser(${u.user_id})" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fas fa-edit"></i></button>
          ${u.user_id !== currentUser.user_id ? `<button onclick="deleteUser(${u.user_id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function editUser(id) {
  try {
    const users = await api('/api/users');
    const u = users.find(u => u.user_id === id);
    if (!u) return;

    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('userFormId').value = u.user_id;
    document.getElementById('userFormFullName').value = u.full_name;
    document.getElementById('userFormUsername').value = u.username;
    document.getElementById('userFormRole').value = u.role;
    document.getElementById('userFormPassword').value = '';
    document.getElementById('userFormPassword').required = false;
    document.getElementById('pwdHint').textContent = '(leave blank to keep current)';
    document.getElementById('userModal').classList.remove('hidden');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(id) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  try {
    await api(`/api/users/${id}`, { method: 'DELETE' });
    showToast('User deleted');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupBackup() {
  document.getElementById('exportBackupBtn').addEventListener('click', async () => {
    try {
      const data = await api('/api/backup/export');
      showToast(`Backup created: ${data.filename}`);

      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);

      loadBackups();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function setupSettings() {
  document.getElementById('storeSettingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    localStorage.setItem('pos_store_name', document.getElementById('settingStoreName').value);
    localStorage.setItem('pos_store_address', document.getElementById('settingStoreAddress').value);
    localStorage.setItem('pos_store_phone', document.getElementById('settingStorePhone').value);
    showToast('Store settings saved');
  });

  const savedName = localStorage.getItem('pos_store_name');
  const savedAddr = localStorage.getItem('pos_store_address');
  const savedPhone = localStorage.getItem('pos_store_phone');
  if (savedName) document.getElementById('settingStoreName').value = savedName;
  if (savedAddr) document.getElementById('settingStoreAddress').value = savedAddr;
  if (savedPhone) document.getElementById('settingStorePhone').value = savedPhone;

  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showToast('Password change feature coming soon', 'info');
  });
}

async function loadBackups() {
  try {
    const backups = await api('/api/backup/list');
    const container = document.getElementById('backupList');
    if (backups.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No backups yet</p>';
      return;
    }
    container.innerHTML = backups.map(b => `
      <div class="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <div>
          <p class="text-sm font-medium text-gray-800">${b.filename}</p>
          <p class="text-xs text-gray-500">${new Date(b.created).toLocaleString()} - ${(b.size / 1024).toFixed(1)} KB</p>
        </div>
        <i class="fas fa-file-archive text-gray-400"></i>
      </div>
    `).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadConfig() {
  try {
    const config = await api('/api/config');
    paystackKey = config.paystackPublicKey || '';
  } catch (e) {}
}

async function loadActiveShift() {
  try {
    activeShift = await api('/api/shifts/active');
    updateShiftBar();
  } catch (e) {}
}

function updateShiftBar() {
  const bar = document.getElementById('shiftBar');
  const text = document.getElementById('shiftBarText');
  const btn = document.getElementById('shiftBarBtn');
  bar.classList.remove('hidden');

  if (activeShift) {
    const start = new Date(activeShift.start_time).toLocaleTimeString();
    text.innerHTML = '<i class="fas fa-circle text-green-500 text-xs"></i> Shift active since ' + start;
    btn.textContent = 'End Shift';
    btn.className = 'text-xs font-medium px-2 py-1 rounded bg-red-200 hover:bg-red-300 text-red-800';
    btn.onclick = () => document.getElementById('shiftEndModal').classList.remove('hidden');
  } else {
    text.innerHTML = '<i class="fas fa-circle text-yellow-500 text-xs"></i> No active shift';
    btn.textContent = 'Start Shift';
    btn.className = 'text-xs font-medium px-2 py-1 rounded bg-yellow-200 hover:bg-yellow-300 text-yellow-800';
    btn.onclick = () => document.getElementById('shiftStartModal').classList.remove('hidden');
  }
}

function setupShifts() {
  document.getElementById('confirmStartShift').addEventListener('click', async () => {
    try {
      const startingCash = parseFloat(document.getElementById('startingCashInput').value) || 0;
      activeShift = await api('/api/shifts/start', {
        method: 'POST',
        body: JSON.stringify({ starting_cash: startingCash })
      });
      document.getElementById('shiftStartModal').classList.add('hidden');
      showToast('Shift started!');
      updateShiftBar();
      loadShifts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('confirmEndShift').addEventListener('click', async () => {
    try {
      const endingCash = parseFloat(document.getElementById('endingCashInput').value) || 0;
      const notes = document.getElementById('shiftEndNotes').value;
      const summary = await api('/api/shifts/end', {
        method: 'POST',
        body: JSON.stringify({ ending_cash: endingCash, notes })
      });
      document.getElementById('shiftEndModal').classList.add('hidden');
      activeShift = null;
      updateShiftBar();
      showShiftSummary(summary);
      loadShifts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('toggleShiftBtn').addEventListener('click', () => {
    if (activeShift) {
      document.getElementById('shiftEndModal').classList.remove('hidden');
    } else {
      document.getElementById('shiftStartModal').classList.remove('hidden');
    }
  });

  document.getElementById('qrCartBtn').addEventListener('click', generateCartQR);
  document.getElementById('barcodeScanBtn').addEventListener('click', startBarcodeScanner);
  document.getElementById('closeScannerBtn').addEventListener('click', stopBarcodeScanner);
}

function showShiftSummary(summary) {
  const diff = Number(summary.cash_difference);
  const diffClass = diff >= 0 ? 'text-green-700' : 'text-red-700';
  const diffLabel = diff >= 0 ? 'Over' : 'Short';

  document.getElementById('shiftSummaryContent').innerHTML = `
    <h3 class="text-lg font-bold text-gray-800 mb-4"><i class="fas fa-clipboard-check text-blue-600 mr-2"></i>Shift Summary</h3>
    <div class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-blue-50 rounded-lg p-3 text-center">
          <p class="text-xs text-gray-500">Transactions</p>
          <p class="text-xl font-bold text-blue-700">${summary.total_transactions}</p>
        </div>
        <div class="bg-green-50 rounded-lg p-3 text-center">
          <p class="text-xs text-gray-500">Total Sales</p>
          <p class="text-xl font-bold text-green-700">GH₵${fmt(summary.total_sales)}</p>
        </div>
      </div>
      <div class="border-t pt-3 space-y-2 text-sm">
        <div class="flex justify-between"><span class="text-gray-500">Starting Cash:</span><span class="font-medium">GH₵${fmt(summary.starting_cash)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">Cash Sales:</span><span class="font-medium">GH₵${fmt(summary.cash_sales)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">Expected Cash:</span><span class="font-medium">GH₵${fmt(summary.expected_cash)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500">Actual Cash:</span><span class="font-medium">GH₵${fmt(summary.ending_cash)}</span></div>
        <div class="flex justify-between border-t pt-2"><span class="text-gray-500 font-medium">Difference:</span><span class="font-bold ${diffClass}">${diffLabel} GH₵${fmt(Math.abs(diff))}</span></div>
      </div>
    </div>
  `;
  document.getElementById('shiftSummaryModal').classList.remove('hidden');
}

async function loadShifts() {
  try {
    const shifts = await api('/api/shifts/history');
    const tbody = document.getElementById('shiftTableBody');

    if (activeShift) {
      document.getElementById('activeShiftInfo').classList.remove('hidden');
      document.getElementById('activeShiftTime').textContent = 'Started: ' + new Date(activeShift.start_time).toLocaleString();
      document.getElementById('activeShiftCash').textContent = 'GH₵' + fmt(activeShift.starting_cash);
      document.getElementById('toggleShiftBtn').innerHTML = '<i class="fas fa-stop"></i> End Shift';
      document.getElementById('toggleShiftBtn').className = 'bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2';
    } else {
      document.getElementById('activeShiftInfo').classList.add('hidden');
      document.getElementById('toggleShiftBtn').innerHTML = '<i class="fas fa-play"></i> Start Shift';
      document.getElementById('toggleShiftBtn').className = 'bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2';
    }

    if (!shifts.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-400">No shift history</td></tr>';
      return;
    }
    tbody.innerHTML = shifts.map(s => {
      const diff = Number(s.cash_difference || 0);
      const diffClass = s.status === 'ended' ? (diff >= 0 ? 'text-green-600' : 'text-red-600') : '';
      return `
      <tr class="hover:bg-gray-50 border-b border-gray-100">
        <td class="px-4 py-3 font-medium">${s.full_name || '-'}</td>
        <td class="px-4 py-3 text-sm">${new Date(s.start_time).toLocaleString()}</td>
        <td class="px-4 py-3 text-sm">${s.end_time ? new Date(s.end_time).toLocaleString() : '-'}</td>
        <td class="px-4 py-3 text-right font-medium">GH₵${fmt(s.total_sales)}</td>
        <td class="px-4 py-3 text-right ${diffClass}">${s.status === 'ended' ? 'GH₵' + fmt(diff) : '-'}</td>
        <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${s.status}</span></td>
      </tr>`;
    }).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

let scannerStream = null;

function startBarcodeScanner() {
  const container = document.getElementById('scannerContainer');
  const video = document.getElementById('scannerVideo');
  container.classList.remove('hidden');

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      scannerStream = stream;
      video.srcObject = stream;
      video.play();
      scanBarcode();
    })
    .catch(() => {
      showToast('Camera access denied. Use a USB barcode scanner instead.', 'error');
      container.classList.add('hidden');
    });
}

function stopBarcodeScanner() {
  if (scannerStream) {
    scannerStream.getTracks().forEach(t => t.stop());
    scannerStream = null;
  }
  document.getElementById('scannerContainer').classList.add('hidden');
}

function scanBarcode() {
  if (!scannerStream) return;
  const video = document.getElementById('scannerVideo');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const scan = () => {
    if (!scannerStream) return;
    if (video.videoWidth === 0) { requestAnimationFrame(scan); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector();
      detector.detect(canvas).then(barcodes => {
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          stopBarcodeScanner();
          showToast('Barcode: ' + code);
          const product = allProducts.find(p => p.barcode === code);
          if (product) {
            addToCart(product.product_id);
          } else {
            document.getElementById('posSearch').value = code;
            document.getElementById('posSearch').dispatchEvent(new Event('input'));
          }
          return;
        }
        requestAnimationFrame(scan);
      }).catch(() => requestAnimationFrame(scan));
    } else {
      showToast('Camera barcode detection not supported. Use a USB scanner.', 'info');
      stopBarcodeScanner();
    }
  };
  requestAnimationFrame(scan);
}

function generateCartQR() {
  if (cart.length === 0) { showToast('Cart is empty', 'error'); return; }

  const total = document.getElementById('cartTotal').textContent;
  const qrText = 'ADAMS POS CART\n' + cart.map(i => i.quantity + 'x ' + i.product_name + ' GH₵' + fmt(i.price * i.quantity)).join('\n') + '\n\nTOTAL: ' + total;

  const display = document.getElementById('qrCodeDisplay');
  display.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    const canvas = document.createElement('canvas');
    display.appendChild(canvas);
    QRCode.toCanvas(canvas, qrText, { width: 250, margin: 2 }, (err) => {
      if (err) showToast('QR generation failed', 'error');
    });
  } else {
    display.innerHTML = '<p class="text-gray-500 text-sm">QR library not loaded</p>';
  }

  document.getElementById('qrModal').classList.remove('hidden');
}
