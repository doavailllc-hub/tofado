import { randomUUID } from 'node:crypto';
export const ORDER_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
  delivered: [], cancelled: [],
};
export const canTransition = (from, to) => from === to || (ORDER_TRANSITIONS[from] || []).includes(to);
export const recordNumber = prefix => prefix + '-' + randomUUID().replaceAll('-', '').slice(0, 24);
export function validatePurchaseOrder(body = {}) {
  const error = message => { throw Object.assign(new Error(message), { status: 400 }); };
  const wholesalerId = Number(body.wholesaler_id);
  if (!Number.isSafeInteger(wholesalerId) || wholesalerId <= 0) error('Select a wholesaler.');
  const address = String(body.delivery_address || '').trim();
  if (!address || address.length > 2000) error('Enter a delivery address of at most 2000 characters.');
  if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) error('Orders require 1 to 100 items.');
  const items = body.items.map(item => {
    if (!item || typeof item !== 'object') error('Invalid order item.');
    const name = String(item.product_name || '').trim();
    const unit = String(item.unit || '').trim();
    const quantity = Number(item.quantity);
    if (!name || name.length > 200 || !unit || unit.length > 30 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 99999999.99 || Math.abs(quantity * 100 - Math.round(quantity * 100)) > 0.00001) error('Each item requires a name, unit and positive quantity with at most two decimals.');
    if (String(item.notes || '').length > 255) error('Item notes must be at most 255 characters.');
    return { name, unit, quantity, notes: item.notes || null };
  });
  const date = body.required_date || null;
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) error('Invalid required date.');
  if (String(body.notes || '').length > 4000) error('Order notes must be at most 4000 characters.');
  return { wholesalerId, address, date, notes: body.notes || null, items };
}
