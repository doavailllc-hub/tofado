import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { money, date, title } from "./format";
import { buildInvoiceHtml as buildTemplatedInvoiceHtml } from "./invoiceTemplates";
export { INVOICE_COLORS, INVOICE_TEMPLATES, normalizeInvoiceTemplate } from "./invoiceTemplates";
export const buildInvoiceHtml = buildTemplatedInvoiceHtml;

const escapeHtml = (value) => String(value ?? "—")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const lineTotal = (item) => Number(item.line_total ?? (Number(item.quantity || 0) * Number(item.unit_price || 0)));

function legacyBuildInvoiceHtml({ invoice = {}, merchant = {}, retailer = {}, items = [], payments = [] }) {
  const subtotal = Number(invoice.subtotal || items.reduce((sum, item) => sum + lineTotal(item), 0));
  const tax = Number(invoice.tax_amount || 0);
  const total = Number(invoice.total_amount || subtotal + tax);
  const paid = Number(invoice.paid_amount || 0);
  const balance = Number(invoice.outstanding_amount ?? Math.max(total - paid, 0));
  const seller = merchant.business_name || invoice.wholesaler_name || "Tofado Wholesaler";
  const buyer = retailer.business_name || invoice.retailer_name || "Retailer";
  const rows = items.map((item, index) => `<tr><td>${index + 1}</td><td><b>${escapeHtml(item.product_name || item.name || "Product")}</b></td><td>${escapeHtml(item.quantity || 0)} ${escapeHtml(item.unit || "")}</td><td>${escapeHtml(money(item.unit_price))}</td><td>${escapeHtml(money(lineTotal(item)))}</td></tr>`).join("");
  const paymentRows = payments.map((payment) => `<div class="payment"><span>${escapeHtml(payment.payment_no || `Payment #${payment.id}`)} · ${escapeHtml(title(payment.method))}</span><b>${escapeHtml(money(payment.amount))}</b></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{margin:28px}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1f1f1f;margin:0;font-size:11px}.doc{border:1px solid #e8eaed;border-radius:18px;overflow:hidden}.accent{height:6px;background:#1a73e8}.head{padding:26px;display:flex;justify-content:space-between;background:#f8fbff}.brand h1,.title h2{margin:0}.brand p,.muted{color:#5f6368}.title{text-align:right}.pill{display:inline-block;padding:6px 10px;border-radius:99px;color:#1967d2;background:#e8f0fe;font-weight:700;text-transform:capitalize}.parties{display:flex;gap:12px;padding:20px;background:#f8f9fa}.party{flex:1;padding:16px;border:1px solid #e8eaed;border-radius:12px;background:white}.party small{color:#1a73e8;font-weight:bold;text-transform:uppercase}.party h3{margin:9px 0}.meta{line-height:1.65;color:#5f6368}.section{padding:20px}.section h3{margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #e8eaed;text-align:left}th{background:#f8f9fa;color:#5f6368;font-size:9px;text-transform:uppercase}th:nth-last-child(-n+2),td:nth-last-child(-n+2){text-align:right}.bottom{display:flex;gap:14px;padding:20px;background:#f8f9fa}.payments{flex:1}.payment{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8eaed}.totals{width:250px;padding:14px;border:1px solid #bfdbfe;border-radius:12px;background:white}.total{display:flex;justify-content:space-between;padding:8px 0}.grand{font-size:15px;border-top:2px solid #1a73e8}.balance{margin-top:6px;padding:11px;color:#92400e;background:#fffbeb;border-radius:8px}.foot{padding:16px 20px;color:#5f6368;text-align:center}
  </style></head><body><main class="doc"><div class="accent"></div><header class="head"><div class="brand"><h1>${escapeHtml(seller)}</h1><p>Wholesale merchant and B2B supplier</p></div><div class="title"><span class="pill">${escapeHtml(invoice.payment_status || invoice.status || "unpaid")}</span><h2>${escapeHtml(invoice.invoice_no || `Invoice #${invoice.id}`)}</h2><b>${escapeHtml(money(total))}</b></div></header>
  <section class="parties"><div class="party"><small>Seller</small><h3>${escapeHtml(seller)}</h3><div class="meta">${escapeHtml(merchant.name)}<br>${escapeHtml([merchant.address, merchant.location].filter(Boolean).join(", "))}<br>${escapeHtml(merchant.phone)} · ${escapeHtml(merchant.email)}<br>GSTIN: ${escapeHtml(merchant.tax_number)}</div></div><div class="party"><small>Bill to</small><h3>${escapeHtml(buyer)}</h3><div class="meta">${escapeHtml(retailer.name)}<br>${escapeHtml([retailer.address, retailer.location].filter(Boolean).join(", "))}<br>${escapeHtml(retailer.phone)} · ${escapeHtml(retailer.email)}<br>GSTIN: ${escapeHtml(retailer.tax_number)}</div></div><div class="party"><small>Invoice details</small><div class="meta"><b>Order</b> ${escapeHtml(invoice.order_no || invoice.order_id)}<br><b>Issued</b> ${escapeHtml(date(invoice.created_at))}<br><b>Due</b> ${escapeHtml(date(invoice.payment_due_date || invoice.due_date))}<br><b>Terms</b> ${escapeHtml(title(invoice.payment_type || invoice.payment_terms))}</div></div></section>
  <section class="section"><h3>Invoice items</h3><table><thead><tr><th>#</th><th>Product</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No invoice items.</td></tr>'}</tbody></table></section>
  <section class="bottom"><div class="payments"><h3>Payment history</h3>${paymentRows || '<p class="muted">No payments recorded.</p>'}</div><div class="totals"><div class="total"><span>Subtotal</span><b>${escapeHtml(money(subtotal))}</b></div><div class="total"><span>GST</span><b>${escapeHtml(money(tax))}</b></div><div class="total grand"><span>Total</span><b>${escapeHtml(money(total))}</b></div><div class="total"><span>Paid</span><b>${escapeHtml(money(paid))}</b></div><div class="total balance"><span>Balance due</span><b>${escapeHtml(money(balance))}</b></div></div></section><footer class="foot">Thank you for your business · Generated by Tofado Wholesaler</footer></main></body></html>`;
}

let activeExport = null;

export async function exportInvoicePdf(payload, mode = "share", templateId = "modern", color) {
  if (activeExport) return activeExport;
  activeExport = (async () => {
    const { uri } = await Print.printToFileAsync({ html: buildTemplatedInvoiceHtml(payload, templateId, color), base64: false });

    if (mode === "download") {
      await Print.printAsync({ uri });
      return uri;
    }

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Sharing is not available on this device.");
    }

    try {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Share invoice PDF",
      });
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();
      if (message.includes("cancel") || message.includes("reject")) return uri;
      throw new Error("The invoice could not be shared. Please try again after reopening the app.");
    }
    return uri;
  })();

  try {
    return await activeExport;
  } finally {
    activeExport = null;
  }
}
