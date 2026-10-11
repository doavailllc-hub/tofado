const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizeGstin(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

export function isValidGstin(value) {
  const gstin = normalizeGstin(value);
  return !gstin || GSTIN_PATTERN.test(gstin);
}

export function normalizeIndianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidIndianPhone(value) {
  return /^[6-9][0-9]{9}$/.test(normalizeIndianPhone(value));
}

export function isValidIndianPinCode(value) {
  return /^[1-9][0-9]{5}$/.test(String(value || "").trim());
}
