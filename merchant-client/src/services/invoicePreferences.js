export const INVOICE_TEMPLATES = [
  { id: "modern", name: "Modern Blue", description: "Friendly and polished", accent: "#1a73e8", preview: "#e8f0fe" },
  { id: "executive", name: "Executive Gold", description: "Premium and formal", accent: "#c6922e", preview: "#152238" },
  { id: "clean", name: "Clean Emerald", description: "Minimal and crisp", accent: "#0f8b6d", preview: "#e7f6f1" },
];

export const INVOICE_COLORS = [
  { id: "blue", name: "Blue", value: "#1a73e8" },
  { id: "emerald", name: "Emerald", value: "#0f8b6d" },
  { id: "gold", name: "Gold", value: "#c6922e" },
  { id: "purple", name: "Purple", value: "#7c3aed" },
  { id: "red", name: "Red", value: "#dc2626" },
  { id: "charcoal", name: "Charcoal", value: "#334155" },
];

export const normalizeInvoiceColor = (value) =>
  /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : "#1a73e8";

export const normalizeInvoiceTemplate = (value) =>
  INVOICE_TEMPLATES.some((template) => template.id === value) ? value : "modern";

const preferenceKey = (userId) => `tofado_invoice_template:${userId || "guest"}`;
const colorPreferenceKey = (userId) => `tofado_invoice_color:${userId || "guest"}`;

export function getInvoiceTemplate(userId) {
  try {
    return normalizeInvoiceTemplate(window.localStorage.getItem(preferenceKey(userId)));
  } catch {
    return "modern";
  }
}

export function getInvoiceColor(userId) {
  try {
    return normalizeInvoiceColor(window.localStorage.getItem(colorPreferenceKey(userId)));
  } catch {
    return "#1a73e8";
  }
}

export function saveInvoiceColor(userId, color) {
  const normalized = normalizeInvoiceColor(color);
  try { window.localStorage.setItem(colorPreferenceKey(userId), normalized); } catch { /* session-only */ }
  return normalized;
}

export function saveInvoiceTemplate(userId, templateId) {
  const normalized = normalizeInvoiceTemplate(templateId);
  try {
    window.localStorage.setItem(preferenceKey(userId), normalized);
  } catch {
    // The selected template still applies for this session when storage is unavailable.
  }
  return normalized;
}
