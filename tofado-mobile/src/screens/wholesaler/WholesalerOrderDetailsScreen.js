import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { colors } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";
import StatusBadge from "../../components/StatusBadge";
import { money, title } from "../../utils/format";

const statuses = ["pending", "confirmed", "packed", "dispatched", "delivered", "cancelled"];

export default function WholesalerOrderDetailsScreen({ route, navigation }) {
  const { id, sourceType = "purchase_order" } = route.params;
  const catalogOrder = sourceType === "catalog_order";
  const [order, setOrder] = useState(null); const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]), [quotes, setQuotes] = useState({});
  const [savingItem, setSavingItem] = useState(null), [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      setError("");
      if (catalogOrder) {
        const { data } = await api.get(`/wholesaler/catalog/orders/${id}`);
        setOrder(data || null); setItems(Array.isArray(data?.items) ? data.items : []);
        setQuotes(Object.fromEntries((data?.items || []).map((item) => [item.id, Number(item.price || 0) > 0 ? String(item.price) : ""])));
      } else {
        const { data } = await api.get(`/wholesaler/orders/${id}`);
        setOrder(data?.order || data || null); setItems(Array.isArray(data?.items) ? data.items : []);
      }
    } catch (e) { setError(e?.response?.data?.message || "Unable to load order."); }
    finally { setRefreshing(false); }
  }, [catalogOrder, id]);

  useEffect(() => { load(); }, [load]);

  const update = async (status) => {
    try {
      setSaving(true); setError("");
      await api.patch(catalogOrder ? `/wholesaler/catalog/orders/${id}/status` : `/wholesaler/orders/${id}/status`, { status });
      await load();
    } catch (e) { setError(e?.response?.data?.message || "Unable to update order."); }
    finally { setSaving(false); }
  };

  const missingQuotes = useMemo(() => items.filter((item) => item.price_mode === "quote" && Number(item.price || 0) <= 0), [items]);
  const saveQuote = async (item) => { const unitPrice = Number(quotes[item.id]); if (!Number.isFinite(unitPrice) || unitPrice <= 0) { setError("Enter a quoted unit price greater than zero."); return; } try { setSavingItem(item.id); setError(""); await api.patch(`/wholesaler/orders/${id}/items/${item.id}/price`, { unit_price:unitPrice }); await load(); } catch (e) { setError(e?.response?.data?.message || "Unable to save the quoted price."); } finally { setSavingItem(null); } };
  const confirmCatalogOrder = async () => { if (missingQuotes.length) { setError("Set a price for every price-on-request product before confirming."); return; } try { setSaving(true); setError(""); await api.post(`/wholesaler/orders/${id}/confirm`, { payment_type:"due" }); await load(); } catch (e) { setError(e?.response?.data?.message || "Unable to confirm the order."); } finally { setSaving(false); } };

  if (!order) return <SafeAreaView style={styles.safe}><View style={styles.loading}>{error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color={colors.primary} />}</View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />} contentContainerStyle={styles.page}>
        <MobileHeader eyebrow={catalogOrder ? "Catalog order" : "Retailer order"} title={order.order_no || `Order #${id}`} subtitle={order.business_name || order.customer_name || order.retailer_name || "Retailer"} onBack={() => navigation.goBack()} />
        {!!error && <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color={colors.red} /><Text style={styles.errorText}>{error}</Text></View>}
        <View style={styles.hero}><View><Text style={styles.kicker}>ORDER VALUE</Text><Text style={styles.value}>{money(order.total_amount)}</Text></View><StatusBadge status={order.status} /></View>
        {!!items.length && <><Text style={styles.section}>Products</Text><View style={styles.card}>{items.map((item, index) => { const needsQuote = item.price_mode === "quote"; return <View key={item.id} style={[styles.item, index === items.length - 1 && styles.last]}><View style={styles.itemTop}><View style={styles.itemCopy}><Text style={styles.itemName}>{item.product_name}</Text><Text style={styles.itemMeta}>{item.quantity} {item.unit || "piece"} · {needsQuote ? "Price requested" : money(item.price)}</Text></View><Text style={styles.lineTotal}>{Number(item.price || 0) > 0 ? money(item.line_total) : "Pending"}</Text></View>{catalogOrder && needsQuote && order.status === "pending" && <View style={styles.quoteRow}><TextInput value={quotes[item.id] ?? ""} onChangeText={(value) => setQuotes((current) => ({ ...current, [item.id]:value }))} keyboardType="decimal-pad" placeholder="Unit price" placeholderTextColor={colors.muted} style={styles.quoteInput} /><Pressable disabled={savingItem === item.id} onPress={() => saveQuote(item)} style={styles.quoteButton}>{savingItem === item.id ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.quoteButtonText}>Save price</Text>}</Pressable></View>}</View>; })}</View></>}
        {catalogOrder && order.status === "pending" && <Pressable disabled={saving || missingQuotes.length > 0} onPress={confirmCatalogOrder} style={[styles.confirm, (saving || missingQuotes.length > 0) && styles.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmText}>{missingQuotes.length ? `${missingQuotes.length} price${missingQuotes.length === 1 ? "" : "s"} required` : "Confirm and create invoice"}</Text>}</Pressable>}
        <Text style={styles.section}>Update fulfilment</Text>
        <View style={styles.statuses}>
          {statuses.map((status) => <Pressable key={status} disabled={saving || (catalogOrder && status === "confirmed")} onPress={() => update(status)} style={[styles.status, order.status === status && styles.statusActive]}><Text style={[styles.statusText, order.status === status && styles.statusTextActive]}>{title(status)}</Text></Pressable>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { padding: 20, paddingBottom: 34 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  error:{marginBottom:12,flexDirection:"row",gap:8,padding:12,borderRadius:12,backgroundColor:colors.redSoft}, errorText:{flex:1,color:colors.red,fontSize:10},
  hero: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, backgroundColor: colors.primarySoft },
  kicker: { color: colors.body, fontSize: 8, fontWeight: "900" },
  value: { marginTop: 5, color: colors.ink, fontSize: 20, fontWeight: "900" },
  card:{overflow:"hidden",borderWidth:1,borderColor:colors.border,borderRadius:16},item:{padding:14,borderBottomWidth:1,borderBottomColor:colors.border},last:{borderBottomWidth:0},itemTop:{flexDirection:"row",alignItems:"center",gap:10},itemCopy:{flex:1},itemName:{color:colors.ink,fontSize:13,fontWeight:"800"},itemMeta:{marginTop:4,color:colors.body,fontSize:10},lineTotal:{color:colors.ink,fontSize:12,fontWeight:"800"},quoteRow:{marginTop:12,flexDirection:"row",gap:8},quoteInput:{flex:1,minHeight:43,paddingHorizontal:12,borderWidth:1,borderColor:colors.border,borderRadius:11,color:colors.ink},quoteButton:{minWidth:100,alignItems:"center",justifyContent:"center",borderRadius:11,backgroundColor:colors.primary},quoteButtonText:{color:colors.white,fontSize:10,fontWeight:"900"},confirm:{minHeight:49,marginTop:16,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:colors.primary},confirmText:{color:colors.white,fontSize:11,fontWeight:"900"},disabled:{opacity:.45},
  section: { marginTop: 22, marginBottom: 10, color: colors.ink, fontSize: 15, fontWeight: "900" },
  statuses: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  status: { minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  statusActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  statusText: { color: colors.body, fontSize: 9, fontWeight: "800" },
  statusTextActive: { color: colors.primary },
});
