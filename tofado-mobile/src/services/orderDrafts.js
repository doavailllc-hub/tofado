import AsyncStorage from "@react-native-async-storage/async-storage";

const VERSION = 1;
const KEY_PREFIX = "tofado_retailer_order_draft_v1";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 50;

const trim = (value, max) => String(value ?? "").trim().slice(0, max);
const draftKey = (userId) => `${KEY_PREFIX}:${String(userId)}`;

export function sanitizeOrderDraft(value, now = Date.now()) {
  const source = value && typeof value === "object" ? value : {};
  const items = Array.isArray(source.items) ? source.items : [];
  return {
    version: VERSION,
    savedAt: Number.isFinite(Number(source.savedAt)) ? Number(source.savedAt) : now,
    wholesalerId: Number.isSafeInteger(Number(source.wholesalerId)) && Number(source.wholesalerId) > 0
      ? Number(source.wholesalerId)
      : null,
    address: trim(source.address, 1000),
    requiredDate: /^\d{4}-\d{2}-\d{2}$/.test(String(source.requiredDate || "")) ? String(source.requiredDate) : "",
    notes: trim(source.notes, 2000),
    step: Math.max(0, Math.min(3, Number.isInteger(Number(source.step)) ? Number(source.step) : 0)),
    items: items.slice(0, MAX_ITEMS).map((item, index) => ({
      key: trim(item?.key, 100) || `restored-${now}-${index}`,
      product_name: trim(item?.product_name, 200),
      quantity: trim(item?.quantity, 20) || "1",
      unit: trim(item?.unit, 40) || "piece",
      notes: trim(item?.notes, 500),
    })),
  };
}

export function hasOrderDraftContent(draft) {
  return Boolean(
    draft?.address || draft?.requiredDate || draft?.notes ||
    draft?.items?.some((item) => item.product_name || item.notes || item.quantity !== "1" || item.unit !== "piece")
  );
}

export async function loadOrderDraft(userId, now = Date.now()) {
  if (userId == null) return null;
  const key = draftKey(userId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION || !Number.isFinite(parsed?.savedAt) || now - parsed.savedAt > MAX_AGE_MS || parsed.savedAt > now + 60_000) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    const draft = sanitizeOrderDraft(parsed, now);
    if (!hasOrderDraftContent(draft)) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function saveOrderDraft(userId, value, now = Date.now()) {
  if (userId == null) return false;
  const key = draftKey(userId);
  const draft = sanitizeOrderDraft({ ...value, savedAt: now }, now);
  if (!hasOrderDraftContent(draft)) {
    await AsyncStorage.removeItem(key);
    return false;
  }
  await AsyncStorage.setItem(key, JSON.stringify(draft));
  return true;
}

export async function clearOrderDraft(userId) {
  if (userId == null) return;
  await AsyncStorage.removeItem(draftKey(userId));
}
