export function invoiceState(total, paid, currentStatus = 'unpaid') {
  const totalAmount = Number(total);
  const paidAmount = Number(paid);
  if (!Number.isFinite(totalAmount) || totalAmount < 0 || !Number.isFinite(paidAmount) || paidAmount < 0) {
    throw new Error('Invalid invoice totals.');
  }
  if (currentStatus === 'cancelled') return { paidAmount, status: 'cancelled' };
  if (paidAmount > totalAmount + 0.001) throw new Error('Paid amount exceeds invoice total.');
  return {
    paidAmount: Number(paidAmount.toFixed(2)),
    status: totalAmount > 0 && paidAmount >= totalAmount - 0.001
      ? 'paid'
      : paidAmount > 0
        ? 'partial'
        : 'unpaid',
  };
}

export function availableInvoiceBalance(total, paid, pending = 0) {
  const values = [total, paid, pending].map(Number);
  if (values.some(value => !Number.isFinite(value) || value < 0)) throw new Error('Invalid payment totals.');
  return Number(Math.max(values[0] - values[1] - values[2], 0).toFixed(2));
}

export function validPaymentAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 9999999999.99 && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.00001;
}

export function paymentIdempotencyKey(value) {
  const key = String(value || '').trim();
  if (!key) return null;
  if (!/^[A-Za-z0-9._:-]{8,64}$/.test(key)) throw Object.assign(new Error('Invalid Idempotency-Key.'), { status: 400 });
  return key;
}
