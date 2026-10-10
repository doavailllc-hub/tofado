import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { connectStaging, assertLocalTarget } from './staging-config.js';

// Never import the application until both its target and the actual local server are checked.
assertLocalTarget({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME });
const connection = await connectStaging();
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { config } = await import('../src/config.js');
const suffix = crypto.randomBytes(8).toString('hex');
const users = [];
let orderId, invoiceId, catalogId, productId, catalogOrderId, catalogInvoiceId;
let linkedCatalogOrderId, linkedCatalogInvoiceId, deliveryId, server;
try {
  for (const role of ['retailer', 'retailer', 'wholesaler', 'wholesaler']) {
    const [result] = await connection.query(`INSERT INTO users
      (role,name,business_name,email,phone,location,password_hash,status,verification_status)
      VALUES (?, 'Staging test', 'Synthetic test business', ?, '000', 'Test', 'disabled-test-login', 'active', 'verified')`,
    [role, `invoice-test-${suffix}-${users.length}@example.invalid`]);
    users.push(result.insertId);
  }
  const [order] = await connection.query(`INSERT INTO purchase_orders
    (order_no,retailer_id,wholesaler_id,delivery_address,subtotal,total_amount)
    VALUES (?, ?, ?, 'Synthetic staging address', 100, 100)`, [`TEST-${suffix}`, users[0], users[2]]);
  orderId = order.insertId;
  await connection.query(`INSERT INTO purchase_order_items (order_id,product_name,quantity,unit,unit_price)
    VALUES (?, 'Synthetic item', 2, 'unit', 50)`, [orderId]);
  const [invoice] = await connection.query(`INSERT INTO invoices
    (invoice_no,order_id,retailer_id,wholesaler_id,subtotal,total_amount,paid_amount,status)
    VALUES (?, ?, ?, ?, 100, 100, 25, 'partial')`, [`TEST-${suffix}`, orderId, users[0], users[2]]);
  invoiceId = invoice.insertId;
  await connection.query(`INSERT INTO payments
    (payment_no,invoice_id,retailer_id,wholesaler_id,amount,method,status)
    VALUES (?, ?, ?, ?, 25, 'cash', 'paid')`, [`TEST-${suffix}`, invoiceId, users[0], users[2]]);
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.on('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(route, user, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (user) headers.Authorization = `Bearer ${jwt.sign({ id: user }, config.jwtSecret, { algorithm: 'HS256', expiresIn: '1m' })}`;
    if (options.body) headers['Content-Type'] = 'application/json';
    return fetch(base + route, { ...options, headers, signal: AbortSignal.timeout(5000) });
  }
  assert.equal((await request(`/retailer/invoices/${invoiceId}`)).status, 401);
  assert.equal((await request(`/retailer/invoices/${invoiceId}`, users[1])).status, 404);
  assert.equal((await request(`/retailer/invoices/${invoiceId}`, users[2])).status, 403);
  assert.equal((await request('/retailer/invoices/invalid', users[0])).status, 400);
  const list = await request('/retailer/invoices', users[0]);
  assert.equal(list.status, 200);
  assert.ok((await list.json()).some(row => Number(row.id) === invoiceId));
  const detail = await request(`/retailer/invoices/${invoiceId}`, users[0]);
  assert.equal(detail.status, 200);
  const body = await detail.json();
  assert.equal(Number(body.invoice.id), invoiceId);
  assert.equal(body.invoice.paid_amount, 25);
  assert.equal(body.invoice.outstanding_amount, 75);
  assert.equal(body.items.length, 1);
  assert.equal(body.payments.length, 1);

  const paymentRequest = {
    method: 'POST',
    headers: { 'Idempotency-Key': `test:${suffix}` },
    body: JSON.stringify({ amount: 30, method: 'bank_transfer', reference_no: `REF-${suffix}` }),
  };
  const submissions = await Promise.all([
    request(`/retailer/invoices/${invoiceId}/payments`, users[0], paymentRequest),
    request(`/retailer/invoices/${invoiceId}/payments`, users[0], paymentRequest),
  ]);
  assert.deepEqual(submissions.map(response => response.status).sort(), [200, 201]);
  const submittedBodies = await Promise.all(submissions.map(response => response.json()));
  assert.equal(submittedBodies[0].payment.id, submittedBodies[1].payment.id);
  const pendingPayment = submittedBodies[0].payment;
  assert.equal(pendingPayment.status, 'pending');
  assert.equal((await request(`/retailer/invoices/${invoiceId}/payments`, users[0], {
    ...paymentRequest, body: JSON.stringify({ amount: 31, method: 'bank_transfer', reference_no: `REF-${suffix}` }),
  })).status, 409);
  assert.equal((await request(`/retailer/invoices/${invoiceId}/payments`, users[1], {
    method: 'POST', body: JSON.stringify({ amount: 1, method: 'cash' }),
  })).status, 404);
  assert.equal((await request(`/retailer/invoices/${invoiceId}/payments`, users[0], {
    method: 'POST', body: JSON.stringify({ amount: 50, method: 'cash' }),
  })).status, 400);
  assert.equal((await request(`/wholesaler/payments/${pendingPayment.id}/verify`, users[3], {
    method: 'PATCH', body: JSON.stringify({ action: 'approve' }),
  })).status, 404);
  assert.equal((await request(`/wholesaler/payments/${pendingPayment.id}/verify`, users[2], {
    method: 'PATCH', body: JSON.stringify({ action: 'reject' }),
  })).status, 200);

  const approvedSubmission = await request(`/retailer/invoices/${invoiceId}/payments`, users[0], {
    method: 'POST', body: JSON.stringify({ amount: 75, method: 'cash' }),
  });
  assert.equal(approvedSubmission.status, 201);
  const approvedPayment = (await approvedSubmission.json()).payment;
  assert.equal((await request(`/wholesaler/payments/${approvedPayment.id}/verify`, users[2], {
    method: 'PATCH', body: JSON.stringify({ action: 'approve' }),
  })).status, 200);
  const [[reconciled]] = await connection.query('SELECT paid_amount,status FROM invoices WHERE id=?', [invoiceId]);
  assert.equal(Number(reconciled.paid_amount), 100);
  assert.equal(reconciled.status, 'paid');
  assert.equal((await request(`/retailer/invoices/${invoiceId}/payments`, users[0], {
    method: 'POST', body: JSON.stringify({ amount: 1, method: 'cash' }),
  })).status, 409);
  const orderDetail = await request(`/wholesaler/orders/${orderId}`, users[2]);
  assert.equal(orderDetail.status, 200);
  const orderBody = await orderDetail.json();
  assert.equal(Number(orderBody.order.id), orderId);
  assert.equal(orderBody.items.length, 1);
  assert.equal(Number(orderBody.invoice.id), invoiceId);
  assert.equal((await request(`/wholesaler/orders/${orderId}`, users[3])).status, 404);
  assert.equal((await request(`/wholesaler/orders/${orderId}`, users[0])).status, 403);
  assert.equal((await request('/wholesaler/orders/invalid', users[2])).status, 400);
  assert.equal((await request(`/wholesaler/orders/${orderId}`)).status, 401);

  const [catalog] = await connection.query(`INSERT INTO wholesale_catalogs (wholesaler_id,slug,title,is_published) VALUES (?,?,?,1)`, [users[2], `test-${suffix}`, 'Synthetic catalog']);
  catalogId = catalog.insertId;
  const [product] = await connection.query(`INSERT INTO wholesale_products (wholesaler_id,name,category_name,unit,price_mode,price,stock_quantity) VALUES (?,'Synthetic product','Test','unit','fixed',50,100)`, [users[2]]);
  productId = product.insertId;
  const [catalogOrder] = await connection.query(`INSERT INTO wholesale_catalog_orders (order_no,catalog_id,wholesaler_id,customer_name,business_name,phone,email,delivery_address,total_amount) VALUES (?,?,?,?,?,'000',?,'Synthetic address',100)`, [`CAT-${suffix}`, catalogId, users[2], 'Guest buyer', 'Guest business', `guest-${suffix}@example.invalid`]);
  catalogOrderId = catalogOrder.insertId;
  await connection.query(`INSERT INTO wholesale_catalog_order_items (order_id,product_id,product_name,unit,price,quantity,line_total) VALUES (?,?,'Synthetic product','unit',50,2,100)`, [catalogOrderId, productId]);
  const confirmed = await request(`/wholesaler/orders/${catalogOrderId}/confirm`, users[2], { method: 'POST', body: JSON.stringify({ payment_type: 'due' }) });
  assert.equal(confirmed.status, 201);
  catalogInvoiceId = (await confirmed.json()).invoice_id;
  const [[catalogInvoice]] = await connection.query('SELECT source_type,catalog_order_id,retailer_id,total_amount FROM invoices WHERE id=?', [catalogInvoiceId]);
  assert.equal(catalogInvoice.source_type, 'catalog_order');
  assert.equal(Number(catalogInvoice.catalog_order_id), catalogOrderId);
  assert.equal(catalogInvoice.retailer_id, null);
  assert.equal(Number(catalogInvoice.total_amount), 100);
  const [[legacyCreated]] = await connection.query('SELECT COUNT(*) count FROM wholesale_catalog_invoices WHERE order_id=?', [catalogOrderId]);
  assert.equal(Number(legacyCreated.count), 0);
  const catalogDetail = await request(`/wholesaler/invoices/${catalogInvoiceId}`, users[2]);
  assert.equal(catalogDetail.status, 200);
  const catalogBody = await catalogDetail.json();
  assert.equal(catalogBody.invoice.source_type, 'catalog_order');
  assert.equal(catalogBody.items.length, 1);
  const catalogPayment = await request('/wholesaler/payments', users[2], { method: 'POST', body: JSON.stringify({ invoice_id: catalogInvoiceId, amount: 40, method: 'cash', status: 'paid' }) });
  assert.equal(catalogPayment.status, 201);
  const [[catalogBalance]] = await connection.query('SELECT paid_amount,status FROM invoices WHERE id=?', [catalogInvoiceId]);
  assert.equal(Number(catalogBalance.paid_amount), 40);
  assert.equal(catalogBalance.status, 'partial');

  const linkedOrder = await request(`/public/catalog/test-${suffix}/orders`, users[0], {
    method: 'POST', body: JSON.stringify({
      customer_name: 'Registered buyer', business_name: 'Registered business', phone: '000',
      email: `invoice-test-${suffix}-0@example.invalid`, delivery_address: 'Linked address',
      items: [{ product_id: productId, quantity: 2 }],
    }),
  });
  assert.equal(linkedOrder.status, 201);
  linkedCatalogOrderId = (await linkedOrder.json()).id;
  const linkedConfirmed = await request(`/wholesaler/orders/${linkedCatalogOrderId}/confirm`, users[2], {
    method: 'POST', body: JSON.stringify({ payment_type: 'due' }),
  });
  assert.equal(linkedConfirmed.status, 201);
  linkedCatalogInvoiceId = (await linkedConfirmed.json()).invoice_id;
  const linkedList = await (await request('/retailer/invoices', users[0])).json();
  assert.ok(linkedList.some(row => Number(row.id) === linkedCatalogInvoiceId && row.source_type === 'catalog_order'));
  const linkedDetail = await request(`/retailer/invoices/${linkedCatalogInvoiceId}`, users[0]);
  assert.equal(linkedDetail.status, 200);
  assert.equal((await linkedDetail.json()).items.length, 1);
  assert.equal((await request(`/retailer/invoices/${linkedCatalogInvoiceId}`, users[1])).status, 404);
  assert.equal((await request(`/retailer/invoices/${linkedCatalogInvoiceId}/payments`, users[0], {
    method: 'POST', body: JSON.stringify({ amount: 25, method: 'cash' }),
  })).status, 201);

  assert.equal((await request(`/wholesaler/catalog/orders/${linkedCatalogOrderId}/delivery`, users[3], {
    method: 'POST', body: JSON.stringify({ delivery_type: 'merchant_delivery' }),
  })).status, 404);
  const createdDelivery = await request(`/wholesaler/catalog/orders/${linkedCatalogOrderId}/delivery`, users[2], {
    method: 'POST', body: JSON.stringify({ delivery_type: 'merchant_delivery', delivery_notes: 'Synthetic delivery' }),
  });
  assert.equal(createdDelivery.status, 201);
  deliveryId = (await createdDelivery.json()).delivery_id;
  const deliveryList = await (await request('/wholesaler/deliveries', users[2])).json();
  assert.ok(deliveryList.deliveries.some(row => Number(row.id) === deliveryId));
  const deliveryDetail = await request(`/wholesaler/deliveries/${deliveryId}`, users[2]);
  assert.equal(deliveryDetail.status, 200);
  assert.equal((await deliveryDetail.json()).items.length, 1);
  assert.equal((await request(`/wholesaler/deliveries/${deliveryId}`, users[3])).status, 404);
  assert.equal((await request(`/wholesaler/deliveries/${deliveryId}`, users[0])).status, 403);
  assert.equal((await request(`/wholesaler/deliveries/${deliveryId}`)).status, 401);
  assert.equal((await request(`/wholesaler/deliveries/${deliveryId}`, users[2], {
    method: 'PATCH', body: JSON.stringify({ status: 'packed' }),
  })).status, 422);
  for (const status of ['dispatched', 'out_for_delivery', 'delivered']) {
    const updated = await request(`/wholesaler/deliveries/${deliveryId}`, users[2], {
      method: 'PATCH', body: JSON.stringify({
        status, driver_name: 'Test Driver', driver_phone: '000', vehicle_number: 'TEST-1',
        delivery_notes: 'Synthetic delivery',
      }),
    });
    assert.equal(updated.status, 200, `delivery transition to ${status}`);
  }
  const [[completedDelivery]] = await connection.query(
    `SELECT d.status,d.dispatched_at,d.out_for_delivery_at,d.delivered_at,o.status order_status
     FROM wholesale_catalog_deliveries d JOIN wholesale_catalog_orders o ON o.id=d.order_id
     WHERE d.id=?`, [deliveryId]);
  assert.equal(completedDelivery.status, 'delivered');
  assert.equal(completedDelivery.order_status, 'delivered');
  assert.ok(completedDelivery.dispatched_at && completedDelivery.out_for_delivery_at && completedDelivery.delivered_at);
  assert.equal((await request(`/wholesaler/catalog/orders/${linkedCatalogOrderId}/delivery`, users[2], {
    method: 'POST', body: JSON.stringify({ delivery_type: 'merchant_delivery' }),
  })).status, 409);
  // Website list and discovery must follow approval changes immediately.
  for (const verification of ['draft', 'pending', 'rejected', 'verified']) {
    await connection.query('UPDATE users SET verification_status=? WHERE id=?', [verification, users[3]]);
    for (const route of ['/retailer/wholesalers', '/retailer/wholesalers/search']) {
      const response = await request(route, users[0]);
      assert.equal(response.status, 200);
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : payload.wholesalers;
      assert.equal(rows.some(row => Number(row.id) === users[3]), verification === 'verified', `${route}: ${verification}`);
    }
  }
  await connection.query("UPDATE users SET status='suspended' WHERE id=?", [users[3]]);
  const visibleWholesalers = await (await request('/retailer/wholesalers', users[0])).json();
  assert.equal(visibleWholesalers.some(row => Number(row.id) === users[3]), false);
  await connection.query("UPDATE users SET status='suspended' WHERE id=?", [users[0]]);
  assert.equal((await request(`/retailer/invoices/${invoiceId}`, users[0])).status, 401);
  console.log('Staging finance integration passed: unified purchase/catalog invoice ledger, guest catalog customer, canonical payments, concurrency, reconciliation and tenant isolation.');
} finally {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections(); });
  try {
    if (invoiceId) {
      await connection.query('DELETE FROM payments WHERE invoice_id=?', [invoiceId]);
      await connection.query('DELETE FROM invoices WHERE id=?', [invoiceId]);
    }
    if (catalogInvoiceId) {
      await connection.query('DELETE FROM payments WHERE invoice_id=?', [catalogInvoiceId]);
      await connection.query('DELETE FROM invoices WHERE id=?', [catalogInvoiceId]);
    }
    if (deliveryId) await connection.query('DELETE FROM wholesale_catalog_deliveries WHERE id=?', [deliveryId]);
    if (linkedCatalogInvoiceId) {
      await connection.query('DELETE FROM payments WHERE invoice_id=?', [linkedCatalogInvoiceId]);
      await connection.query('DELETE FROM invoices WHERE id=?', [linkedCatalogInvoiceId]);
    }
    if (linkedCatalogOrderId) await connection.query('DELETE FROM wholesale_catalog_orders WHERE id=?', [linkedCatalogOrderId]);
    if (catalogOrderId) await connection.query('DELETE FROM wholesale_catalog_orders WHERE id=?', [catalogOrderId]);
    if (productId) await connection.query('DELETE FROM wholesale_products WHERE id=?', [productId]);
    if (catalogId) await connection.query('DELETE FROM wholesale_catalogs WHERE id=?', [catalogId]);
    if (orderId) await connection.query('DELETE FROM purchase_orders WHERE id=?', [orderId]);
    for (const id of users) await connection.query('DELETE FROM users WHERE id=?', [id]);
  } finally {
    await connection.end();
    await pool.end();
  }
}
