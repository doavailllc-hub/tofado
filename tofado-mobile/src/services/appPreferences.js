import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "tofado_onboarding_complete_v1";
const INVOICE_TEMPLATE_KEY = "tofado_invoice_template_v1";
const INVOICE_COLOR_KEY = "tofado_invoice_color_v1";
const INVOICE_TEMPLATES = new Set(["modern", "executive", "clean"]);

export async function hasCompletedOnboarding() {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" &&
      window.localStorage.getItem(ONBOARDING_KEY) === "true";
  }
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
}

export async function completeOnboarding() {
  if (Platform.OS === "web") {
    window.localStorage.setItem(ONBOARDING_KEY, "true");
    return;
  }
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}

const invoiceTemplateKey = (userId) => `${INVOICE_TEMPLATE_KEY}:${String(userId ?? "guest")}`;

export async function getInvoiceTemplate(userId) {
  const key = invoiceTemplateKey(userId);
  const value = Platform.OS === "web"
    ? (typeof window !== "undefined" ? window.localStorage.getItem(key) : null)
    : await AsyncStorage.getItem(key);
  return INVOICE_TEMPLATES.has(value) ? value : "modern";
}

export async function setInvoiceTemplate(userId, templateId) {
  const value = INVOICE_TEMPLATES.has(templateId) ? templateId : "modern";
  const key = invoiceTemplateKey(userId);
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    return value;
  }
  await AsyncStorage.setItem(key, value);
  return value;
}

const normalizeInvoiceColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toUpperCase() : "#1A73E8";
const invoiceColorKey = (userId) => `${INVOICE_COLOR_KEY}:${String(userId ?? "guest")}`;

export async function getInvoiceColor(userId) {
  const key = invoiceColorKey(userId);
  const value = Platform.OS === "web"
    ? (typeof window !== "undefined" ? window.localStorage.getItem(key) : null)
    : await AsyncStorage.getItem(key);
  return normalizeInvoiceColor(value);
}

export async function setInvoiceColor(userId, color) {
  const value = normalizeInvoiceColor(color);
  const key = invoiceColorKey(userId);
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
    return value;
  }
  await AsyncStorage.setItem(key, value);
  return value;
}
