import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";
import { colors, radius, shadow, spacing } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { date, money } from "../../utils/format";

const filters = ["all", "pending", "partial", "paid", "overdue"];
const statusOf = (row) => {
  const status = String(row.calculated_payment_status || row.payment_status || row.status || "pending").toLowerCase();
  if (status === "unpaid") return "pending";
  if (status === "partially_paid") return "partial";
  return status;
};

export default function InvoicesListScreen({ role, navigation }) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); const [filter, setFilter] = useState("all"); const [error, setError] = useState("");
  const load = useCallback(async (refresh = false) => {
    try { refresh ? setRefreshing(true) : setLoading(true); setError(""); const { data } = await api.get(`/${role}/invoices`); setRows(Array.isArray(data) ? data : data?.invoices || data?.rows || []); }
    catch (e) { setError(e?.response?.data?.message || "Unable to load invoices."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [role]);
  useEffect(() => { load(); }, [load]);
  const counts = useMemo(() => rows.reduce((acc, row) => { const key = statusOf(row); acc[key] = (acc[key] || 0) + 1; return acc; }, {}), [rows]);
  const visible = useMemo(() => filter === "all" ? rows : rows.filter((row) => statusOf(row) === filter), [filter, rows]);
  const total = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const outstanding = rows.reduce((sum, row) => sum + Number(row.outstanding_amount ?? Math.max(Number(row.total_amount || 0) - Number(row.paid_amount || 0), 0)), 0);
  const detailRoute = role === "retailer" ? "RetailerInvoiceDetails" : "WholesalerInvoiceDetails";
  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
    <MobileHeader eyebrow="Finance" title="Invoices" subtitle={role === "retailer" ? "Review balances, documents, and payment activity." : "Manage issued invoices and retailer balances."} onBack={role === "wholesaler" ? () => navigation.goBack() : undefined} />
    {!!error && <View style={styles.alert}><Ionicons name="alert-circle-outline" size={18} color={colors.red} /><Text style={styles.alertText}>{error}</Text><Pressable onPress={() => load()}><Text style={styles.retry}>Retry</Text></Pressable></View>}
    {!loading && rows.length > 0 && <View style={styles.hero}><View><Text style={styles.heroLabel}>Outstanding balance</Text><Text style={styles.heroAmount}>{money(outstanding)}</Text><Text style={styles.heroCaption}>{rows.length} invoices · {money(total)} issued</Text></View><View style={styles.heroIcon}><Ionicons name="receipt" size={25} color={colors.primary} /></View></View>}
    {!loading && rows.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((item) => { const selected = item === filter; return <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, selected && styles.filterActive]}><Text style={[styles.filterText, selected && styles.filterTextActive]}>{item}</Text><Text style={[styles.count, selected && styles.countActive]}>{item === "all" ? rows.length : counts[item] || 0}</Text></Pressable>; })}</ScrollView>}
    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading invoices…</Text></View> : visible.length ? <View style={styles.list}>{visible.map((row) => {
      const paid = Number(row.paid_amount || 0); const balance = Number(row.outstanding_amount ?? Math.max(Number(row.total_amount || 0) - paid, 0));
      return <Pressable key={row.id} onPress={() => navigation.navigate(detailRoute, { id: row.id })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View style={styles.cardTop}><View style={styles.icon}><Ionicons name="document-text-outline" size={20} color={colors.primary} /></View><View style={styles.cardCopy}><Text style={styles.invoiceNo}>{row.invoice_no || `Invoice #${row.id}`}</Text><Text numberOfLines={1} style={styles.party}>{role === "retailer" ? row.wholesaler_name || "Wholesaler" : row.retailer_name || row.business_name || "Retailer"}</Text></View><StatusBadge status={statusOf(row)} /></View>
        <View style={styles.amountRow}><View><Text style={styles.amountLabel}>Invoice total</Text><Text style={styles.amount}>{money(row.total_amount)}</Text></View><View style={styles.balanceBox}><Text style={styles.balanceLabel}>Balance due</Text><Text style={styles.balance}>{money(balance)}</Text></View></View>
        <View style={styles.cardFooter}><Text style={styles.meta}>{row.order_no || "Order"} · Due {date(row.payment_due_date || row.due_date)}</Text><View style={styles.view}><Text style={styles.viewText}>View invoice</Text><Ionicons name="arrow-forward" size={15} color={colors.primary} /></View></View>
      </Pressable>;
    })}</View> : rows.length ? <EmptyState icon="filter-outline" title="No matching invoices" copy="Try a different payment status." /> : <EmptyState icon="receipt-outline" title="No invoices yet" copy="Invoices will appear here when orders are billed." />}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.soft},page:{padding:spacing.xl,paddingBottom:40},alert:{marginBottom:spacing.lg,padding:spacing.md,flexDirection:"row",alignItems:"center",gap:spacing.sm,borderRadius:radius.md,backgroundColor:colors.redSoft},alertText:{flex:1,color:colors.red,fontSize:11},retry:{color:colors.red,fontSize:11,fontWeight:"700"},
  hero:{marginBottom:spacing.lg,padding:spacing.xl,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,backgroundColor:colors.white,...shadow},heroLabel:{color:colors.body,fontSize:11,fontWeight:"600"},heroAmount:{marginTop:4,color:colors.ink,fontSize:24,fontWeight:"700"},heroCaption:{marginTop:4,color:colors.muted,fontSize:9},heroIcon:{width:52,height:52,alignItems:"center",justifyContent:"center",borderRadius:26,backgroundColor:colors.primarySoft},
  filters:{paddingBottom:spacing.lg,gap:spacing.sm},filter:{minHeight:38,paddingHorizontal:spacing.md,flexDirection:"row",alignItems:"center",gap:7,borderWidth:1,borderColor:colors.borderStrong,borderRadius:radius.pill,backgroundColor:colors.white},filterActive:{borderColor:colors.primary,backgroundColor:colors.primarySoft},filterText:{color:colors.body,fontSize:11,fontWeight:"600",textTransform:"capitalize"},filterTextActive:{color:colors.primaryDark},count:{color:colors.muted,fontSize:9,fontWeight:"700"},countActive:{color:colors.primary},
  loading:{minHeight:300,alignItems:"center",justifyContent:"center",gap:spacing.md},loadingText:{color:colors.body,fontSize:12},list:{gap:spacing.md},card:{padding:spacing.lg,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,backgroundColor:colors.white,...shadow},pressed:{opacity:.75},cardTop:{flexDirection:"row",alignItems:"center",gap:spacing.md},icon:{width:44,height:44,alignItems:"center",justifyContent:"center",borderRadius:14,backgroundColor:colors.primarySoft},cardCopy:{flex:1,minWidth:0},invoiceNo:{color:colors.ink,fontSize:14,fontWeight:"700"},party:{marginTop:3,color:colors.body,fontSize:10},amountRow:{marginTop:spacing.lg,padding:spacing.md,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderRadius:radius.md,backgroundColor:colors.soft},amountLabel:{color:colors.muted,fontSize:9},amount:{marginTop:4,color:colors.ink,fontSize:16,fontWeight:"700"},balanceBox:{alignItems:"flex-end"},balanceLabel:{color:colors.muted,fontSize:9},balance:{marginTop:4,color:colors.orange,fontSize:13,fontWeight:"700"},cardFooter:{marginTop:spacing.md,flexDirection:"row",alignItems:"center",gap:spacing.sm},meta:{flex:1,color:colors.muted,fontSize:9},view:{flexDirection:"row",alignItems:"center",gap:4},viewText:{color:colors.primary,fontSize:10,fontWeight:"700"},
});
