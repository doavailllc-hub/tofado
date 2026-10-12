import test from 'node:test';
import assert from 'node:assert/strict';
import { creditPassport, expiryAction, groupBuyProgress, gstAnalytics, parseConversationalOrder, rankQuotes, reconcileUpi, reorderRecommendation, supplierTrust } from '../src/utils/commerce-intelligence.js';

test('reorder engine explains stock urgency and rounds to pack size', () => {
  assert.deepEqual(reorderRecommendation({ stock: 8, average_daily_sales: 4, lead_days: 3, safety_days: 2, pack_size: 6 }), { stock_cover_days: 2, suggested_quantity: 12, urgency: 'urgent', explanation: 'Target covers 5 days including safety stock.' });
});
test('quote comparison ranks landed value with trust and credit', () => {
  const ranked = rankQuotes([{ id: 1, unit_price: 100, quantity: 10, gst_rate: 18, delivery_fee: 50, trust_score: 60 }, { id: 2, unit_price: 98, quantity: 10, gst_rate: 18, delivery_fee: 0, trust_score: 90, credit_days: 15 }]);
  assert.equal(ranked[0].id, 2); assert.equal(ranked[0].recommended, true); assert.equal(ranked[0].landed_cost, 1156.4);
});
test('deal-room comparison normalizes discounts, free units and shelf life', () => {
  const [offer] = rankQuotes([{ id: 3, unit_price: 100, quantity: 10, free_units: 2, discount_percent: 10, gst_rate: 18, delivery_fee: 20, trust_score: 80, expiry_date: '2099-01-01' }]);
  assert.equal(offer.list_subtotal, 800);
  assert.equal(offer.discount_amount, 80);
  assert.equal(offer.landed_cost, 869.6);
  assert.equal(offer.effective_unit_cost, 86.96);
  assert.ok(offer.shelf_life_days > 90);
});
test('UPI reconciliation uses amount and invoice reference without auto-approving uncertainty', () => {
  const result = reconcileUpi({ amount: 500, reference_no: 'upi INV-7' }, [{ id: 7, invoice_no: 'INV-7', total_amount: 700, paid_amount: 200 }]);
  assert.equal(result.match.invoice_id, 7); assert.equal(result.match.confidence, 100); assert.equal(result.needs_review, false);
});
test('credit passport requires consent and is explainable', () => {
  assert.equal(creditPassport({}, false).available, false);
  const result = creditPassport({ on_time_payment_rate: .95, completed_order_rate: .9, tenure_months: 24, dispute_rate: .01, average_monthly_purchases: 10000 }, true);
  assert.ok(result.score >= 800); assert.ok(result.suggested_limit > 0); assert.ok(result.factors);
});
test('conversation parser supports India English and transliterated Hindi', () => {
  const result = parseConversationalOrder('do carton Rice and 5 kg Sugar', [{ id: 1, name: 'Rice' }, { id: 2, name: 'Sugar' }]);
  assert.equal(result.language, 'hi-IN'); assert.deepEqual(result.items.map(item => item.quantity), [2, 5]); assert.ok(result.items.every(item => item.matched));
});
test('expiry, group buying, trust, and GST metrics are deterministic', () => {
  assert.equal(groupBuyProgress({ target_quantity: 100, committed_quantity: 75, base_price: 12, group_price: 10 }).remaining_quantity, 25);
  assert.equal(supplierTrust({ fulfilment_rate: 1, on_time_rate: 1, quality_acceptance_rate: 1, dispute_rate: 0 }).score, 100);
  assert.deepEqual(gstAnalytics([{ subtotal: 100, tax_amount: 18, total_amount: 118, cost_amount: 70 }]), { taxable_value: 100, gst_collected: 18, gross_revenue: 118, gross_margin: 30, record_count: 1 });
  assert.ok(['monitor','discount_or_transfer','quarantine'].includes(expiryAction({ expiry_date: '2099-01-01' }).action));
});
