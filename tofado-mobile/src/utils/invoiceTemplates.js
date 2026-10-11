import { money, date, title } from "./format";

export const INVOICE_TEMPLATES = [
  { id: "modern", name: "Modern Blue", description: "Friendly and polished", accent: "#1A73E8", preview: "#E8F0FE" },
  { id: "executive", name: "Executive Gold", description: "Premium and formal", accent: "#C6922E", preview: "#152238" },
  { id: "clean", name: "Clean Emerald", description: "Minimal and crisp", accent: "#0F8B6D", preview: "#E7F6F1" },
];
export const INVOICE_COLORS = ["#1A73E8", "#0F8B6D", "#C6922E", "#7C3AED", "#DC2626", "#334155"];
export const normalizeInvoiceColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : "#1A73E8";

export const normalizeInvoiceTemplate = (value) =>
  INVOICE_TEMPLATES.some((template) => template.id === value) ? value : "modern";

const escapeHtml = (value) => String(value ?? "—")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const lineTotal = (item) => Number(item.line_total ?? (Number(item.quantity || 0) * Number(item.unit_price || 0)));
const themeFor = (templateId, color) => {
  const theme = ({
  modern: { accent:"#1A73E8", soft:"#F3F8FF", page:"#F8FAFD", ink:"#172B3A", muted:"#5F6F7B", border:"#DDE7F0", radius:"18px", header:"#F3F8FF", headerText:"#172B3A", table:"#EDF5FF", balance:"#FFF4DD", balanceText:"#9A5A00" },
  executive: { accent:"#C6922E", soft:"#F8F3E8", page:"#F3F1EC", ink:"#152238", muted:"#6D685D", border:"#D8CCB2", radius:"2px", header:"#152238", headerText:"#FFFFFF", table:"#152238", balance:"#F5E7C8", balanceText:"#76500F" },
  clean: { accent:"#0F8B6D", soft:"#F0FAF7", page:"#FFFFFF", ink:"#17352E", muted:"#60756F", border:"#D8EAE4", radius:"10px", header:"#FFFFFF", headerText:"#17352E", table:"#E7F6F1", balance:"#E7F6F1", balanceText:"#08664F" },
  }[normalizeInvoiceTemplate(templateId)]);
  return { ...theme, accent: normalizeInvoiceColor(color || theme.accent) };
};

export function buildInvoiceHtml({ invoice = {}, merchant = {}, retailer = {}, items = [], payments = [] }, templateId = "modern", color) {
  const selected = normalizeInvoiceTemplate(templateId);
  const t = themeFor(selected, color);
  const subtotal = Number(invoice.subtotal || items.reduce((sum, item) => sum + lineTotal(item), 0));
  const tax = Number(invoice.tax_amount || 0);
  const total = Number(invoice.total_amount || subtotal + tax);
  const paid = Number(invoice.paid_amount || 0);
  const balance = Number(invoice.outstanding_amount ?? Math.max(total - paid, 0));
  const seller = merchant.business_name || invoice.wholesaler_name || "Tofado Wholesaler";
  const buyer = retailer.business_name || invoice.retailer_name || "Retailer";
  const rows = items.map((item, index) => `<tr><td>${index + 1}</td><td><b>${escapeHtml(item.product_name || item.name || "Product")}</b>${item.notes ? `<small>${escapeHtml(item.notes)}</small>` : ""}</td><td>${escapeHtml(item.quantity || 0)} ${escapeHtml(item.unit || "")}</td><td>${escapeHtml(money(item.unit_price))}</td><td>${escapeHtml(money(lineTotal(item)))}</td></tr>`).join("");
  const paymentRows = payments.map((payment) => `<div class="payment"><span>${escapeHtml(payment.payment_no || `Payment #${payment.id}`)} · ${escapeHtml(title(payment.method))}</span><b>${escapeHtml(money(payment.amount))}</b></div>`).join("");
  const executive = selected === "executive";
  const clean = selected === "clean";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
    @page{margin:26px;size:A4}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:${t.ink};background:${t.page};margin:0;font-size:11px;line-height:1.45}.doc{border:${clean?"0":"1px solid "+t.border};border-radius:${t.radius};overflow:hidden;background:#fff}.accent{height:${executive?"10px":"6px"};background:${t.accent}}.head{padding:${executive?"30px":"26px"};display:flex;justify-content:space-between;gap:24px;background:${t.header};color:${t.headerText}}.brand h1{font-size:${executive?"24px":"22px"};letter-spacing:${executive?"1px":"0"};margin:0}.brand p{margin:7px 0 0;color:${executive?"#D8DCE4":t.muted}}.title{text-align:right;min-width:220px}.title h2{margin:12px 0 5px;font-size:20px}.amount{font-size:16px}.pill{display:inline-block;padding:6px 11px;border-radius:${executive?"2px":"99px"};color:${executive?"#152238":t.accent};background:${executive?t.accent:t.soft};font-weight:700;text-transform:capitalize}.parties{display:flex;gap:12px;padding:20px;background:${clean?"#fff":t.soft}}.party{flex:1;padding:16px;border:${clean?"0":"1px solid "+t.border};border-left:${clean?"3px solid "+t.accent:""};border-radius:${clean?"0":t.radius};background:#fff}.party small{color:${t.accent};font-weight:bold;letter-spacing:.7px;text-transform:uppercase}.party h3{margin:9px 0 6px;font-size:13px}.meta{line-height:1.65;color:${t.muted}}.section{padding:20px}.section h3{margin:0 0 12px;font-size:14px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid ${t.border};text-align:left;vertical-align:top}th{background:${t.table};color:${executive?"#fff":t.muted};font-size:9px;letter-spacing:.4px;text-transform:uppercase}td small{display:block;color:${t.muted};margin-top:3px}th:nth-last-child(-n+2),td:nth-last-child(-n+2){text-align:right}.bottom{display:flex;gap:18px;padding:20px;background:${clean?"#fff":t.soft};border-top:${clean?"2px solid "+t.accent:"0"}}.payments{flex:1}.payments h3{margin-top:0}.payment{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid ${t.border}}.muted{color:${t.muted}}.totals{width:255px;padding:15px;border:1px solid ${t.border};border-top:4px solid ${t.accent};border-radius:${t.radius};background:#fff}.total{display:flex;justify-content:space-between;gap:12px;padding:8px 0}.grand{font-size:15px;border-top:2px solid ${t.accent};margin-top:4px}.balance{margin-top:7px;padding:11px;color:${t.balanceText};background:${t.balance};border-radius:${clean?"4px":t.radius}}.foot{padding:17px 20px;color:${t.muted};text-align:center;border-top:1px solid ${t.border}}.template-mark{font-size:8px;letter-spacing:.8px;text-transform:uppercase}
  </style></head><body><main class="doc ${selected}"><div class="accent"></div><header class="head"><div class="brand"><h1>${escapeHtml(seller)}</h1><p>Wholesale merchant and B2B supplier</p></div><div class="title"><span class="pill">${escapeHtml(invoice.payment_status || invoice.status || "unpaid")}</span><h2>${escapeHtml(invoice.invoice_no || `Invoice #${invoice.id}`)}</h2><b class="amount">${escapeHtml(money(total))}</b></div></header>
  <section class="parties"><div class="party"><small>Seller</small><h3>${escapeHtml(seller)}</h3><div class="meta">${escapeHtml(merchant.name)}<br>${escapeHtml([merchant.address, merchant.location].filter(Boolean).join(", "))}<br>${escapeHtml(merchant.phone)} · ${escapeHtml(merchant.email)}<br>GSTIN: ${escapeHtml(merchant.tax_number)}</div></div><div class="party"><small>Bill to</small><h3>${escapeHtml(buyer)}</h3><div class="meta">${escapeHtml(retailer.name)}<br>${escapeHtml([retailer.address, retailer.location].filter(Boolean).join(", "))}<br>${escapeHtml(retailer.phone)} · ${escapeHtml(retailer.email)}<br>GSTIN: ${escapeHtml(retailer.tax_number)}</div></div><div class="party"><small>Invoice details</small><div class="meta"><b>Order</b> ${escapeHtml(invoice.order_no || invoice.order_id)}<br><b>Issued</b> ${escapeHtml(date(invoice.created_at))}<br><b>Due</b> ${escapeHtml(date(invoice.payment_due_date || invoice.due_date))}<br><b>Terms</b> ${escapeHtml(title(invoice.payment_type || invoice.payment_terms))}</div></div></section>
  <section class="section"><h3>Invoice items</h3><table><thead><tr><th>#</th><th>Product</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No invoice items.</td></tr>'}</tbody></table></section>
  <section class="bottom"><div class="payments"><h3>Payment history</h3>${paymentRows || '<p class="muted">No payments recorded.</p>'}</div><div class="totals"><div class="total"><span>Subtotal</span><b>${escapeHtml(money(subtotal))}</b></div><div class="total"><span>GST</span><b>${escapeHtml(money(tax))}</b></div><div class="total grand"><span>Total</span><b>${escapeHtml(money(total))}</b></div><div class="total"><span>Paid</span><b>${escapeHtml(money(paid))}</b></div><div class="total balance"><span>Balance due</span><b>${escapeHtml(money(balance))}</b></div></div></section><footer class="foot">Thank you for your business · Generated by Tofado <span class="template-mark">${escapeHtml(selected)} template</span></footer></main></body></html>`;
}
