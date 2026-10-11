import assert from "node:assert/strict";
import test from "node:test";

import {
  INVOICE_TEMPLATES,
  normalizeInvoiceColor,
  normalizeInvoiceTemplate,
} from "../src/services/invoicePreferences.js";

test("web offers the same three invoice templates as mobile", () => {
  assert.deepEqual(
    INVOICE_TEMPLATES.map(({ id, name }) => ({ id, name })),
    [
      { id: "modern", name: "Modern Blue" },
      { id: "executive", name: "Executive Gold" },
      { id: "clean", name: "Clean Emerald" },
    ]
  );
});

test("invoice colors accept safe hex values only", () => {
  assert.equal(normalizeInvoiceColor("#7C3AED"), "#7c3aed");
  assert.equal(normalizeInvoiceColor("red"), "#1a73e8");
});

test("unknown invoice templates safely fall back to modern", () => {
  assert.equal(normalizeInvoiceTemplate("executive"), "executive");
  assert.equal(normalizeInvoiceTemplate("unknown"), "modern");
  assert.equal(normalizeInvoiceTemplate(null), "modern");
});
