import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { colors, shadow } from "../../theme/colors";
import { friendlyError } from "../../utils/errors";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";

const fields = [
  ["business_name", "Business name", "storefront-outline"],
  ["name", "Contact person", "person-outline"],
  ["phone", "Phone number", "call-outline"],
  ["location", "City or location", "location-outline"],
  ["business_category", "Business category", "grid-outline"],
  ["shop_type", "Shop type", "business-outline"],
];

export default function CompleteBusinessProfileScreen() {
  const { user, refreshUser, logout } = useAuth();
  const [form, setForm] = useState({
    business_name: user?.business_name || "",
    name: user?.name || "",
    phone: user?.phone || "",
    location: user?.location || "",
    business_category: user?.business_category || "",
    shop_type: user?.shop_type || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (fields.some(([key]) => !String(form[key] || "").trim())) {
      setError("Complete every business field to continue.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await api.put("/profile", {
        ...form,
        address: "",
        tax_number: "",
        description: "",
        website: "",
      });
      await refreshUser();
    } catch (requestError) {
      setError(friendlyError(requestError, "Unable to save your business profile."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScrollView contentContainerStyle={styles.page}>
        <View style={styles.icon}><Ionicons name="sparkles-outline" size={26} color={colors.primary} /></View>
        <Text style={styles.eyebrow}>ONE LAST STEP</Text>
        <Text style={styles.title}>Set up your business</Text>
        <Text style={styles.copy}>These details help partners recognize and trust your account.</Text>
        {error ? <View style={styles.alert}><Text style={styles.alertText}>{error}</Text></View> : null}
        <View style={styles.card}>
          {fields.map(([key, label, icon]) => <View key={key} style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputShell}><Ionicons name={icon} size={18} color={colors.muted} /><TextInput value={form[key]} onChangeText={(value) => setForm((current) => ({ ...current, [key]: value }))} placeholder={label} placeholderTextColor={colors.muted} style={styles.input} /></View>
          </View>)}
          <Pressable disabled={saving} onPress={save} style={styles.button}><Text style={styles.buttonText}>{saving ? "Saving…" : "Continue to Tofado"}</Text><Ionicons name="arrow-forward" size={18} color={colors.white} /></Pressable>
        </View>
        <Pressable onPress={logout} style={styles.signOut}><Text style={styles.signOutText}>Use another account</Text></Pressable>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAF8FF" },
  page: { width: "100%", maxWidth: 520, alignSelf: "center", padding: 22, paddingBottom: 36 },
  icon: { width: 52, height: 52, marginTop: 8, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: colors.primarySoft },
  eyebrow: { marginTop: 20, color: colors.primaryDark, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { marginTop: 7, color: colors.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.7 },
  copy: { marginTop: 7, color: colors.body, fontSize: 12, lineHeight: 18 },
  alert: { marginTop: 15, padding: 11, borderRadius: 11, backgroundColor: colors.redSoft },
  alertText: { color: colors.red, fontSize: 10 },
  card: { marginTop: 20, padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 22, backgroundColor: colors.white, ...shadow },
  field: { marginBottom: 13 },
  label: { marginBottom: 6, color: colors.ink, fontSize: 10, fontWeight: "800" },
  inputShell: { minHeight: 49, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 13 },
  input: { flex: 1, height: 48, color: colors.ink, fontSize: 13 },
  button: { minHeight: 53, marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 15, backgroundColor: colors.primary },
  buttonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  signOut: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 12 },
  signOutText: { color: colors.primaryDark, fontSize: 11, fontWeight: "800" },
});
