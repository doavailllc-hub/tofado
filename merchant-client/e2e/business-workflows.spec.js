import { expect, test } from '@playwright/test';

async function merchantSession(page, role) {
  const user = {
    id: role === 'retailer' ? 11 : 22,
    role,
    status: 'active',
    verification_status: 'verified',
    business_name: role === 'retailer' ? 'Test Retailer' : 'Test Wholesaler',
  };
  await page.addInitScript(session => {
    localStorage.setItem('tofado_token', 'e2e-token');
    localStorage.setItem('tofado_refresh_token', 'e2e-refresh');
    localStorage.setItem('tofado_user', JSON.stringify(session));
  }, user);
  await page.route('**/api/auth/me', route => route.fulfill({ json: user }));
}

test('retailer opens a canonical invoice and submits a payment', async ({ page }) => {
  await merchantSession(page, 'retailer');
  await page.route('**/api/retailer/invoices/501/payments', async route => {
    const request = route.request().postDataJSON();
    expect(request.amount).toBe(75);
    await route.fulfill({ status: 201, json: { payment: { id: 901, status: 'pending' } } });
  });
  await page.route('**/api/retailer/invoices/501', route => route.fulfill({ json: {
      invoice: {
        id: 501, invoice_no: 'INV-E2E-501', order_no: 'ORD-E2E-1', source_type: 'catalog_order',
        wholesaler_name: 'Test Wholesaler', business_name: 'Test Retailer', customer_name: 'Buyer',
        total_amount: 100, paid_amount: 25, pending_payment_amount: 0, outstanding_amount: 75,
        status: 'partial', calculated_payment_status: 'partial', payment_type: 'due',
      },
      items: [{ id: 1, product_name: 'Coffee', quantity: 2, unit: 'case', unit_price: 50, line_total: 100 }],
      payments: [{ id: 1, payment_no: 'PAY-1', amount: 25, method: 'cash', status: 'paid' }],
    } }));
  await page.goto('/retailer/invoices/501');
  await expect(page.getByRole('heading', { name: 'INV-E2E-501' })).toBeVisible();
  await expect(page.getByText('Coffee')).toBeVisible();
  await page.getByLabel('Payment amount').fill('75');
  await page.getByLabel('Payment method').selectOption('cash');
  await page.getByRole('button', { name: 'Submit payment' }).click();
  await expect(page.getByText('Payment submitted for verification.')).toBeVisible();
});

test('wholesaler tracks a delivery through the complete web workflow', async ({ page }) => {
  await merchantSession(page, 'wholesaler');
  let status = 'ready';
  const delivery = () => ({
    id: 71, delivery_no: 'DEL-000071', order_id: 61, order_no: 'CO-E2E-61',
    retailer_name: 'Test Retailer', business_name: 'Test Retailer', delivery_address: 'Riyadh',
    delivery_type: 'merchant_delivery', status, driver_name: 'Test Driver', driver_phone: '0500000000',
    vehicle_number: 'TEST-1', delivery_notes: 'Handle carefully', created_at: new Date().toISOString(),
    ...(status === 'dispatched' ? { dispatched_at: new Date().toISOString() } : {}),
    ...(status === 'out_for_delivery' ? { dispatched_at: new Date().toISOString(), out_for_delivery_at: new Date().toISOString() } : {}),
    ...(status === 'delivered' ? { dispatched_at: new Date().toISOString(), out_for_delivery_at: new Date().toISOString(), delivered_at: new Date().toISOString() } : {}),
  });
  await page.route('**/api/wholesaler/deliveries/71', async route => {
    if (route.request().method() === 'PATCH') {
      status = route.request().postDataJSON().status || status;
      return route.fulfill({ json: { message: 'Updated', delivery: delivery() } });
    }
    return route.fulfill({ json: { delivery: delivery(), items: [{ id: 1, product_name: 'Coffee', quantity: 2, unit: 'case' }] } });
  });
  await page.route('**/api/wholesaler/deliveries', route => route.fulfill({ json: { deliveries: [delivery()] } }));
  await page.goto('/wholesaler/deliveries');
  await expect(page.getByText('DEL-000071')).toBeVisible();
  await page.getByText('DEL-000071').click();
  await expect(page.getByText('Coffee')).toBeVisible();
  for (const step of ['Dispatched', 'Out for delivery', 'Delivered']) {
    await page.getByRole('button', { name: new RegExp(step, 'i') }).click();
  }
  await expect(page.getByText('100% complete')).toBeVisible();
  await expect(page.getByText('Delivered', { exact: true }).first()).toBeVisible();
});
