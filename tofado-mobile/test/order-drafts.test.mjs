import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const values = new Map();
globalThis.__orderDraftStorage = {
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => values.set(key, value),
  removeItem: async (key) => values.delete(key),
};

let source = await readFile(new URL("../src/services/orderDrafts.js", import.meta.url), "utf8");
source = source.replace('import AsyncStorage from "@react-native-async-storage/async-storage";', "const AsyncStorage = globalThis.__orderDraftStorage;");
const drafts = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("order drafts are scoped, sanitized and restored", async () => {
  values.clear();
  const now = 1_800_000_000_000;
  await drafts.saveOrderDraft(7, {
    wholesalerId: "12",
    address: "  Main branch  ",
    requiredDate: "2027-01-20",
    notes: " leave at receiving ",
    step: 99,
    items: [{ product_name: "  Rice  ", quantity: "5", unit: "bag", notes: "dry" }],
  }, now);
  const restored = await drafts.loadOrderDraft(7, now + 1000);
  assert.equal(restored.wholesalerId, 12);
  assert.equal(restored.address, "Main branch");
  assert.equal(restored.items[0].product_name, "Rice");
  assert.equal(restored.step, 3);
  assert.equal(await drafts.loadOrderDraft(8, now + 1000), null);
});

test("expired, future and corrupt drafts are removed", async () => {
  values.clear();
  const now = 1_800_000_000_000;
  values.set("tofado_retailer_order_draft_v1:1", JSON.stringify({ version: 1, savedAt: now - 31 * 86400000, items: [{ product_name: "Tea" }] }));
  assert.equal(await drafts.loadOrderDraft(1, now), null);
  values.set("tofado_retailer_order_draft_v1:2", JSON.stringify({ version: 1, savedAt: now + 120000, items: [{ product_name: "Tea" }] }));
  assert.equal(await drafts.loadOrderDraft(2, now), null);
  values.set("tofado_retailer_order_draft_v1:3", "not-json");
  assert.equal(await drafts.loadOrderDraft(3, now), null);
  assert.equal(values.size, 0);
});

test("empty drafts are not persisted and explicit clear removes saved work", async () => {
  values.clear();
  assert.equal(await drafts.saveOrderDraft(4, { items: [{ product_name: "", quantity: "1", unit: "piece" }] }), false);
  assert.equal(values.size, 0);
  await drafts.saveOrderDraft(4, { items: [{ product_name: "Flour", quantity: "2", unit: "box" }] });
  assert.equal(values.size, 1);
  await drafts.clearOrderDraft(4);
  assert.equal(values.size, 0);
});
