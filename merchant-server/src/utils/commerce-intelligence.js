const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, digits = 2) => Number(finite(value).toFixed(digits));

export function reorderRecommendation({ stock = 0, average_daily_sales = 0, lead_days = 3, safety_days = 2, pack_size = 1 }) {
  const daily = Math.max(0, finite(average_daily_sales));
  const available = Math.max(0, finite(stock));
  const coverDays = daily ? available / daily : null;
  const target = daily * (Math.max(0, finite(lead_days)) + Math.max(0, finite(safety_days)));
  const pack = Math.max(1, finite(pack_size, 1));
  const suggested = Math.ceil(Math.max(0, target - available) / pack) * pack;
  return {
    stock_cover_days: coverDays === null ? null : round(coverDays, 1),
    suggested_quantity: round(suggested),
    urgency: !daily ? 'monitor' : coverDays <= lead_days ? 'urgent' : coverDays <= lead_days + safety_days ? 'soon' : 'healthy',
    explanation: !daily ? 'More sales history is needed.' : `Target covers ${lead_days + safety_days} days including safety stock.`,
  };
}

export function rankQuotes(quotes = []) {
  return quotes.map(quote => {
    const subtotal = finite(quote.unit_price) * finite(quote.quantity, 1);
    const gst = subtotal * finite(quote.gst_rate) / 100;
    const landed = subtotal + gst + finite(quote.delivery_fee);
    const reliability = clamp(finite(quote.trust_score, 50), 0, 100);
    const creditBonus = Math.min(10, Math.max(0, finite(quote.credit_days)) / 3);
    const score = landed > 0 ? (100000 / landed) + reliability + creditBonus - Math.max(0, finite(quote.delivery_days)) : reliability;
    return { ...quote, subtotal: round(subtotal), gst_amount: round(gst), landed_cost: round(landed), comparison_score: round(score) };
  }).sort((a, b) => b.comparison_score - a.comparison_score).map((quote, index) => ({ ...quote, rank: index + 1, recommended: index === 0 }));
}

export function reconcileUpi(payment, invoices = []) {
  const amount = finite(payment?.amount);
  const reference = String(payment?.reference_no || '').trim().toLowerCase();
  const candidates = invoices.map(invoice => {
    const outstanding = Math.max(0, finite(invoice.total_amount) - finite(invoice.paid_amount));
    const amountMatch = Math.abs(outstanding - amount) < 0.01;
    const referenceMatch = reference && [invoice.invoice_no, invoice.order_no].filter(Boolean).some(value => reference.includes(String(value).toLowerCase()));
    const confidence = (amountMatch ? 70 : Math.max(0, 50 - Math.abs(outstanding - amount) / Math.max(1, outstanding) * 50)) + (referenceMatch ? 30 : 0);
    return { invoice_id: invoice.id, invoice_no: invoice.invoice_no, outstanding: round(outstanding), confidence: round(clamp(confidence, 0, 100)) };
  }).sort((a, b) => b.confidence - a.confidence);
  return { match: candidates[0]?.confidence >= 70 ? candidates[0] : null, candidates: candidates.slice(0, 5), needs_review: !candidates[0] || candidates[0].confidence < 90 };
}

export function creditPassport(metrics = {}, consent = false) {
  if (!consent) return { available: false, reason: 'Retailer consent is required.' };
  const paidOnTime = clamp(finite(metrics.on_time_payment_rate), 0, 1);
  const fulfilment = clamp(finite(metrics.completed_order_rate), 0, 1);
  const tenure = clamp(finite(metrics.tenure_months) / 24, 0, 1);
  const disputes = clamp(finite(metrics.dispute_rate), 0, 1);
  const score = Math.round(300 + 600 * (paidOnTime * .5 + fulfilment * .25 + tenure * .15 + (1 - disputes) * .1));
  return { available: true, score, band: score >= 750 ? 'strong' : score >= 650 ? 'good' : score >= 550 ? 'building' : 'limited', factors: { paid_on_time: paidOnTime, completed_orders: fulfilment, tenure, low_disputes: 1 - disputes }, suggested_limit: round(Math.max(0, finite(metrics.average_monthly_purchases)) * (score >= 750 ? 1.5 : score >= 650 ? 1 : .5)) };
}

export function supplierTrust(metrics = {}) {
  const fulfilment = clamp(finite(metrics.fulfilment_rate), 0, 1);
  const onTime = clamp(finite(metrics.on_time_rate), 0, 1);
  const quality = clamp(finite(metrics.quality_acceptance_rate, 1), 0, 1);
  const disputes = clamp(finite(metrics.dispute_rate), 0, 1);
  const score = Math.round(100 * (fulfilment * .35 + onTime * .3 + quality * .25 + (1 - disputes) * .1));
  return { score, band: score >= 90 ? 'excellent' : score >= 75 ? 'trusted' : score >= 60 ? 'developing' : 'review', explainable: true };
}

const numberWords = new Map([['one',1],['two',2],['three',3],['four',4],['five',5],['six',6],['seven',7],['eight',8],['nine',9],['ten',10],['ek',1],['do',2],['teen',3],['char',4],['paanch',5],['das',10]]);
export function parseConversationalOrder(text, catalog = []) {
  const source = String(text || '').trim();
  if (!source) return { language: 'unknown', items: [], needs_confirmation: true };
  const language = /[\u0900-\u097F]/.test(source) || /\b(ek|do|teen|char|paanch|das|carton|dabba)\b/i.test(source) ? 'hi-IN' : 'en-IN';
  const segments = source.split(/[,;\n]|\band\b|\baur\b/i).map(value => value.trim()).filter(Boolean);
  const items = segments.map(segment => {
    const numeric = segment.match(/\b(\d+(?:\.\d+)?)\b/);
    const word = [...numberWords.entries()].find(([key]) => new RegExp(`\\b${key}\\b`, 'i').test(segment));
    const quantity = numeric ? finite(numeric[1], 1) : word?.[1] || 1;
    const product = catalog.map(item => ({ ...item, match: String(item.name || '').toLowerCase() })).filter(item => item.match && segment.toLowerCase().includes(item.match)).sort((a,b) => b.match.length-a.match.length)[0];
    return { product_id: product?.id || null, product_name: product?.name || segment.replace(/\b\d+(?:\.\d+)?\b/, '').trim(), quantity, unit: /carton|case/i.test(segment) ? 'carton' : /kg|kilo/i.test(segment) ? 'kg' : 'unit', matched: Boolean(product) };
  });
  return { language, items, needs_confirmation: true, source_text: source };
}

export function expiryAction({ expiry_date, quantity = 0, cost_price = 0 }) {
  const days = Math.ceil((new Date(expiry_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);
  const discount = days < 0 ? 100 : days <= 7 ? 40 : days <= 30 ? 20 : days <= 60 ? 10 : 0;
  return { days_to_expiry: days, action: days < 0 ? 'quarantine' : discount ? 'discount_or_transfer' : 'monitor', suggested_discount_percent: discount, inventory_value_at_risk: round(finite(quantity) * finite(cost_price)) };
}

export function groupBuyProgress({ target_quantity = 0, committed_quantity = 0, base_price = 0, group_price = 0 }) {
  const target = Math.max(1, finite(target_quantity, 1));
  const committed = Math.max(0, finite(committed_quantity));
  return { progress_percent: round(clamp(committed / target * 100, 0, 100), 1), remaining_quantity: round(Math.max(0, target - committed)), unlocked: committed >= target, savings_per_unit: round(Math.max(0, finite(base_price) - finite(group_price))) };
}

export function gstAnalytics(records = []) {
  const totals = records.reduce((result, row) => {
    const taxable = finite(row.subtotal ?? row.taxable_amount);
    const gst = finite(row.tax_amount ?? row.gst_amount);
    const revenue = finite(row.total_amount, taxable + gst);
    const cost = finite(row.cost_amount);
    result.taxable_value += taxable; result.gst += gst; result.revenue += revenue; result.cost += cost;
    return result;
  }, { taxable_value: 0, gst: 0, revenue: 0, cost: 0 });
  return { taxable_value: round(totals.taxable_value), gst_collected: round(totals.gst), gross_revenue: round(totals.revenue), gross_margin: round(totals.revenue - totals.gst - totals.cost), record_count: records.length };
}
