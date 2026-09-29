import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { colors } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";
import StatusBadge from "../../components/StatusBadge";
import { date, money, title } from "../../utils/format";

export default function RetailerOrderDetailsScreen({ route, navigation }) {
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      const { data } = await api.get(`/retailer/orders/${id}`);
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.message || "Unable to load order.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={colors.primary} /></View></SafeAreaView>;

  const order = data?.order || {};
  const items = data?.items || [];
  const invoice = data?.invoice;
  const delivery = data?.delivery;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
        <MobileHeader eyebrow="Purchase order" title={order.order_no || `Order #${id}`} subtitle={order.wholesaler_name || "Wholesaler"} onBack={() => navigation.goBack()} />
        {!!error && <View style={styles.error}><Ionicons name="cloud-offline-outline" size={18} color="#C5221F" /><Text style={styles.errorText}>{error}</Text></View>}
        <View style={styles.hero}>
          <View style={styles.heroCopy}><Text style={styles.kicker}>ORDER TOTAL</Text><Text style={styles.total}>{money(order.total_amount)}</Text><Text style={styles.heroCaption}>Purchase order summary</Text></View>
          <StatusBadge status={order.status} />
        </View>

        <View style={styles.sectionHeader}><Text style={styles.section}>Order information</Text><Text style={styles.sectionCaption}>Dates and delivery details</Text></View>
        <View style={styles.card}>
          <Row icon="calendar-outline" label="Created" value={date(order.created_at)} />
          <Row icon="calendar-clear-outline" label="Required date" value={date(order.required_date)} />
          <Row icon="location-outline" label="Delivery address" value={order.delivery_address} />
          <Row icon="document-text-outline" label="Notes" value={order.notes || "—"} last />
        </View>

        <View style={styles.sectionHeader}><Text style={styles.section}>Products</Text><Text style={styles.sectionCaption}>{items.length} item{items.length === 1 ? "" : "s"}</Text></View>
        <View style={styles.card}>
          {items.length ? items.map((item, index) => (
            <View style={[styles.item, index === items.length - 1 && styles.itemLast]} key={item.id || index}>
              <View style={styles.itemIcon}><Ionicons name="cube-outline" size={18} color="#5F6368" /></View>
              <View style={styles.itemCopy}><Text style={styles.itemName}>{item.product_name}</Text><Text style={styles.itemMeta}>{item.quantity} {item.unit || ""}</Text></View>
              <Text style={styles.itemPrice}>{item.unit_price == null ? "Awaiting price" : money(item.line_total)}</Text>
            </View>
          )) : <View style={styles.emptyItems}><Text style={styles.emptyItemsText}>No products have been added.</Text></View>}
        </View>

        <View style={styles.sectionHeader}><Text style={styles.section}>Invoice & delivery</Text><Text style={styles.sectionCaption}>Payment and fulfilment</Text></View>
        <View style={styles.card}>
          <Row icon="receipt-outline" label="Invoice" value={invoice ? `${invoice.invoice_no || `#${invoice.id}`} · ${title(invoice.payment_status || invoice.status)}` : "Not issued"} />
          <Row icon="car-outline" label="Delivery" value={delivery ? `${title(delivery.status)} · ${delivery.delivery_no || `#${delivery.id}`}` : "Not created"} last={!delivery?.driver_name && !delivery?.vehicle_number} />
          {!!delivery?.driver_name && <Row icon="person-outline" label="Driver" value={delivery.driver_name} last={!delivery?.vehicle_number} />}
          {!!delivery?.vehicle_number && <Row icon="car-sport-outline" label="Vehicle" value={delivery.vehicle_number} last />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, last }) {
  return <View style={[styles.row, last && styles.rowLast]}><View style={styles.rowIcon}><Ionicons name={icon} size={18} color="#5F6368" /></View><View style={styles.rowCopy}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value || "—"}</Text></View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { paddingHorizontal: 16, paddingBottom: 34 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: "#FCE8E6", backgroundColor: "#FEF7F6" },
  errorText: { flex: 1, color: "#C5221F", fontSize: 12 },
  hero: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: "#E8EAED", backgroundColor: "#F8F9FA" },
  heroCopy: { flex: 1, minWidth: 0 },
  kicker: { color: "#5F6368", fontSize: 10, fontWeight: "600", letterSpacing: .6 },
  total: { marginTop: 5, color: "#1F1F1F", fontSize: 24, fontWeight: "700", letterSpacing: -.5 },
  heroCaption: { marginTop: 4, color: "#5F6368", fontSize: 12 },
  sectionHeader: { marginTop: 24, marginBottom: 9, paddingHorizontal: 4 },
  section: { color: "#1F1F1F", fontSize: 15, fontWeight: "700" },
  sectionCaption: { marginTop: 2, color: "#5F6368", fontSize: 12 },
  card: { overflow: "hidden", borderWidth: 1, borderColor: "#E8EAED", borderRadius: 16, backgroundColor: "#FFFFFF" },
  row: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 13, borderBottomWidth: 1, borderBottomColor: "#F1F3F4" },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "#F1F3F4" },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: "#5F6368", fontSize: 11, fontWeight: "500" },
  rowValue: { marginTop: 2, color: "#1F1F1F", fontSize: 14, fontWeight: "600" },
  item: { minHeight: 72, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#F1F3F4" },
  itemLast: { borderBottomWidth: 0 },
  itemIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#F1F3F4" },
  itemCopy: { flex: 1, minWidth: 0 },
  itemName: { color: "#1F1F1F", fontSize: 14, fontWeight: "600" },
  itemMeta: { marginTop: 3, color: "#5F6368", fontSize: 12 },
  itemPrice: { color: "#1F1F1F", fontSize: 13, fontWeight: "700" },
  emptyItems: { alignItems: "center", paddingVertical: 26, paddingHorizontal: 20 },
  emptyItemsText: { color: "#5F6368", fontSize: 12 },
});
