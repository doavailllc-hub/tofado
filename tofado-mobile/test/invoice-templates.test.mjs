import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

let source = await readFile(new URL("../src/utils/invoiceTemplates.js", import.meta.url), "utf8");
source = source.replace(
  'import { money, date, title } from "./format";',
  'const money=(value)=>`INR ${Number(value||0).toFixed(2)}`; const date=(value)=>String(value||"—"); const title=(value)=>String(value||"—");'
);
const invoiceTemplates = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

const payload = {
  invoice: { id: 8, invoice_no: "INV-008", total_amount: 125, paid_amount: 25, status: "partial", created_at: "2026-10-08", due_date: "2026-10-30" },
  merchant: { business_name: "Seller & Sons", tax_number: "27AAPFU0939F1ZV" },
  retailer: { business_name: "Buyer <Store>" },
  items: [{ product_name: "Premium Rice", quantity: 5, unit: "bag", unit_price: 25, notes: "Keep <dry>" }],
  payments: [{ id: 1, method: "bank_transfer", amount: 25 }],
};

test("all invoice templates generate distinct printable HTML", () => {
  const html = Object.fromEntries(invoiceTemplates.INVOICE_TEMPLATES.map(({ id }) => [id, invoiceTemplates.buildInvoiceHtml(payload, id)]));
  assert.match(html.modern, /class="doc modern"/);
  assert.match(html.executive, /class="doc executive"/);
  assert.match(html.clean, /class="doc clean"/);
  assert.notEqual(html.modern, html.executive);
  assert.notEqual(html.executive, html.clean);
  for (const output of Object.values(html)) {
    assert.match(output, /INV-008/);
    assert.match(output, /Premium Rice/);
    assert.match(output, /Seller &amp; Sons/);
    assert.match(output, /Buyer &lt;Store&gt;/);
    assert.doesNotMatch(output, /Keep <dry>/);
  }
});

test("unknown invoice templates safely fall back to modern", () => {
  assert.equal(invoiceTemplates.normalizeInvoiceTemplate("unknown"), "modern");
  assert.match(invoiceTemplates.buildInvoiceHtml(payload, "unknown"), /class="doc modern"/);
});
