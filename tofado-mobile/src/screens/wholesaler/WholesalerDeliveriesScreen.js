import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";
import { colors, radius, shadow, spacing } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";
import EmptyState from "../../components/EmptyState";
import StatusBadge from "../../components/StatusBadge";
import { date } from "../../utils/format";

const stages = ["packed", "dispatched", "delivered"];
const filters = ["all", ...stages];
const stageCopy = {
  packed: { action: "Mark as packed", icon: "cube-outline" },
  dispatched: { action: "Dispatch delivery", icon: "navigate-outline" },
  delivered: { action: "Confirm delivery", icon: "checkmark-circle-outline" },
};

const normaliseStatus = (status) => String(status || "pending").toLowerCase();
function nextStage(status) {
  const currentIndex = stages.indexOf(normaliseStatus(status));
  return currentIndex === -1 ? "packed" : stages[currentIndex + 1] || null;
}

function DeliveryProgress({ status }) {
  const current = normaliseStatus(status);
  const activeIndex = stages.indexOf(current);
  return (
    <View style={styles.progress} accessibilityLabel={`Delivery progress: ${current}`}>
      {stages.map((stage, index) => {
        const complete = activeIndex >= index;
        return <View key={stage} style={styles.progressItem}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressDot, complete && styles.progressDotActive]}>
              {complete && <Ionicons name="checkmark" size={12} color={colors.white} />}
            </View>
            {index < stages.length - 1 && <View style={[styles.progressLine, activeIndex > index && styles.progressLineActive]} />}
          </View>
          <Text style={[styles.progressLabel, complete && styles.progressLabelActive]}>{stage}</Text>
        </View>;
      })}
    </View>
  );
}

function DeliveryCard({ row, working, onUpdate }) {
  const status = normaliseStatus(row.status);
  const next = nextStage(status);
  const recipient = row.business_name || row.retailer_name || "Retailer";
  const reference = row.order_no ? `Order ${row.order_no}` : `Created ${date(row.created_at)}`;
  const details = [row.driver_name, row.vehicle_number].filter(Boolean).join(" · ");
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.deliveryIcon}><Ionicons name={status === "delivered" ? "checkmark" : "car-outline"} size={20} color={colors.primary} /></View>
        <View style={styles.cardTitleWrap}>
          <Text numberOfLines={1} style={styles.cardTitle}>{row.delivery_no || `Delivery #${row.id}`}</Text>
          <Text numberOfLines={1} style={styles.recipient}>{recipient}</Text>
        </View>
        <StatusBadge status={status} />
      </View>
      <View style={styles.referenceRow}>
        <Ionicons name="receipt-outline" size={15} color={colors.muted} />
        <Text numberOfLines={1} style={styles.reference}>{reference}</Text>
        {!!row.created_at && row.order_no && <Text style={styles.created}>{date(row.created_at)}</Text>}
      </View>
      {!!details && <View style={styles.referenceRow}>
        <Ionicons name="person-outline" size={15} color={colors.muted} />
        <Text numberOfLines={1} style={styles.reference}>{details}</Text>
      </View>}
      <DeliveryProgress status={status} />
      {next ? <Pressable accessibilityRole="button" accessibilityLabel={stageCopy[next].action} disabled={working} onPress={() => onUpdate(row, next)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed, working && styles.disabled]}>
        {working ? <ActivityIndicator size="small" color={colors.white} /> : <Ionicons name={stageCopy[next].icon} size={18} color={colors.white} />}
        <Text style={styles.primaryActionText}>{working ? "Updating…" : stageCopy[next].action}</Text>
        {!working && <Ionicons name="arrow-forward" size={17} color={colors.white} />}
      </Pressable> : <View style={styles.completeMessage}>
        <Ionicons name="checkmark-circle" size={19} color={colors.green} />
        <Text style={styles.completeText}>Delivery completed</Text>
      </View>}
    </View>
  );
}

export default function WholesalerDeliveriesScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      const { data } = await api.get("/wholesaler/deliveries");
      setRows(Array.isArray(data) ? data : data?.deliveries || []);
    } catch (e) { setError(e?.response?.data?.message || "Unable to load deliveries."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => rows.reduce((result, row) => {
    const status = normaliseStatus(row.status);
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {}), [rows]);
  const visibleRows = useMemo(() => filter === "all" ? rows : rows.filter((row) => normaliseStatus(row.status) === filter), [filter, rows]);
  const activeCount = rows.filter((row) => normaliseStatus(row.status) !== "delivered").length;

  const update = async (row, status) => {
    try {
      setWorkingId(row.id); setError("");
      await api.patch(`/wholesaler/deliveries/${row.id}`, { status });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, status } : item));
    } catch (e) { setError(e?.response?.data?.message || "Unable to update delivery. Please try again."); }
    finally { setWorkingId(null); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}>
        <MobileHeader eyebrow="Fulfilment" title="Deliveries" subtitle="Track every order from packing to handoff." onBack={() => navigation.goBack()} />
        {!!error && <View style={styles.error}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.red} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable hitSlop={8} onPress={() => load()}><Text style={styles.retry}>Retry</Text></Pressable>
        </View>}
        {!loading && rows.length > 0 && <View style={styles.summaryCard}>
          <View><Text style={styles.summaryLabel}>Active deliveries</Text><Text style={styles.summaryValue}>{activeCount}</Text><Text style={styles.summaryCaption}>{counts.delivered || 0} completed</Text></View>
          <View style={styles.summaryIcon}><Ionicons name="navigate" size={26} color={colors.primary} /></View>
        </View>}
        {!loading && rows.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((item) => {
            const selected = filter === item;
            const count = item === "all" ? rows.length : counts[item] || 0;
            return <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setFilter(item)} style={[styles.filter, selected && styles.filterActive]}>
              <Text style={[styles.filterText, selected && styles.filterTextActive]}>{item}</Text>
              <View style={[styles.filterCount, selected && styles.filterCountActive]}><Text style={[styles.filterCountText, selected && styles.filterCountTextActive]}>{count}</Text></View>
            </Pressable>;
          })}
        </ScrollView>}
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading deliveries…</Text></View>
          : visibleRows.length ? <View style={styles.list}>{visibleRows.map((row) => <DeliveryCard key={row.id} row={row} working={workingId === row.id} onUpdate={update} />)}</View>
          : rows.length ? <EmptyState icon="filter-outline" title="No matching deliveries" copy="Try another delivery status." />
          : <EmptyState icon="car-outline" title="No deliveries yet" copy="New delivery records will appear here when orders are ready." />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.soft }, page: { padding: spacing.xl, paddingBottom: 40 },
  loading: { minHeight: 300, alignItems: "center", justifyContent: "center", gap: spacing.md }, loadingText: { color: colors.body, fontSize: 12 },
  error: { marginBottom: spacing.lg, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.redSoft }, errorText: { flex: 1, color: colors.red, fontSize: 11, lineHeight: 16 }, retry: { color: colors.red, fontSize: 11, fontWeight: "700" },
  summaryCard: { marginBottom: spacing.lg, padding: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white, ...shadow }, summaryLabel: { color: colors.body, fontSize: 12, fontWeight: "600" }, summaryValue: { marginTop: 2, color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: "700" }, summaryCaption: { marginTop: 1, color: colors.muted, fontSize: 11 }, summaryIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 27, backgroundColor: colors.primarySoft },
  filters: { paddingBottom: spacing.lg, gap: spacing.sm }, filter: { minHeight: 38, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, backgroundColor: colors.white }, filterActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, filterText: { color: colors.body, fontSize: 11, fontWeight: "600", textTransform: "capitalize" }, filterTextActive: { color: colors.primaryDark }, filterCount: { minWidth: 20, height: 20, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.soft }, filterCountActive: { backgroundColor: colors.white }, filterCountText: { color: colors.muted, fontSize: 9, fontWeight: "700" }, filterCountTextActive: { color: colors.primary },
  list: { gap: spacing.md }, card: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white, ...shadow }, cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md }, deliveryIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.primarySoft }, cardTitleWrap: { flex: 1, minWidth: 0 }, cardTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" }, recipient: { marginTop: 3, color: colors.body, fontSize: 11 }, referenceRow: { marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }, reference: { flex: 1, color: colors.body, fontSize: 10 }, created: { color: colors.muted, fontSize: 9 },
  progress: { marginTop: spacing.xl, marginBottom: spacing.lg, flexDirection: "row" }, progressItem: { flex: 1 }, progressTrack: { height: 20, flexDirection: "row", alignItems: "center" }, progressDot: { width: 20, height: 20, zIndex: 1, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.borderStrong, borderRadius: 10, backgroundColor: colors.white }, progressDotActive: { borderColor: colors.primary, backgroundColor: colors.primary }, progressLine: { position: "absolute", left: 20, right: 0, height: 2, backgroundColor: colors.borderStrong }, progressLineActive: { backgroundColor: colors.primary }, progressLabel: { marginTop: 5, color: colors.muted, fontSize: 9, fontWeight: "600", textTransform: "capitalize" }, progressLabelActive: { color: colors.primaryDark },
  primaryAction: { minHeight: 46, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primary }, primaryActionText: { flex: 1, color: colors.white, fontSize: 12, fontWeight: "700", textAlign: "center" }, pressed: { opacity: 0.82 }, disabled: { opacity: 0.7 }, completeMessage: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.greenSoft }, completeText: { color: colors.green, fontSize: 12, fontWeight: "700" },
});
