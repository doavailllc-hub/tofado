import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";
import { colors } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";
import StatusBadge from "../../components/StatusBadge";
import { money, title } from "../../utils/format";

const statuses = ["pending", "confirmed", "packed", "dispatched", "delivered", "cancelled"];

export default function WholesalerOrderDetailsScreen({ route, navigation }) {
  const { id } = route.params;
  const [order, setOrder] = useState(null); const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const { data } = await api.get("/wholesaler/orders");
      const rows = Array.isArray(data) ? data : data?.orders || [];
      setOrder(rows.find((x) => Number(x.id) === Number(id)) || null);
    } catch (e) { setError(e?.response?.data?.message || "Unable to load order."); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const update = async (status) => {
    try {
      setSaving(true); setError("");
      await api.patch(`/wholesaler/orders/${id}/status`, { status });
      setOrder((current) => current ? { ...current, status } : current);
    } catch (e) { setError(e?.response?.data?.message || "Unable to update order."); }
    finally { setSaving(false); }
  };

  if (!order) return <SafeAreaView style={styles.safe}><View style={styles.loading}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}</View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <MobileHeader eyebrow="Retailer order" title={order.order_no || `Order #${id}`} subtitle={order.retailer_name || "Retailer"} onBack={() => navigation.goBack()} />
        <View style={styles.hero}><View><Text style={styles.kicker}>ORDER VALUE</Text><Text style={styles.value}>{money(order.total_amount)}</Text></View><StatusBadge status={order.status} /></View>
        <Text style={styles.section}>Update fulfilment</Text>
        <View style={styles.statuses}>
          {statuses.map((status) => <Pressable key={status} disabled={saving} onPress={() => update(status)} style={[styles.status, order.status === status && styles.statusActive]}><Text style={[styles.statusText, order.status === status && styles.statusTextActive]}>{title(status)}</Text></Pressable>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { padding: 20, paddingBottom: 34 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  error: { color: colors.red, fontSize: 10, textAlign: "center" },
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, backgroundColor: colors.primarySoft },
  kicker: { color: colors.body, fontSize: 8, fontWeight: "900" },
  value: { marginTop: 5, color: colors.ink, fontSize: 20, fontWeight: "900" },
  section: { marginTop: 22, marginBottom: 10, color: colors.ink, fontSize: 15, fontWeight: "900" },
  statuses: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  status: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  statusActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  statusText: { color: colors.body, fontSize: 9, fontWeight: "800" },
  statusTextActive: { color: colors.primary },
});
