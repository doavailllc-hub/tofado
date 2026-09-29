import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { colors, shadow } from "../../theme/colors";
import { friendlyError } from "../../utils/errors";
import { date, money } from "../../utils/format";
import StatusBadge from "../../components/StatusBadge";

const FILTERS = ["all", "pending", "confirmed", "packed", "dispatched", "delivered"];

export default function OrdersListScreen({ role, navigation }) {
  const retailer = role === "retailer";
  const [rows, setRows] = useState([]), [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true); setError("");
      const { data } = await api.get(`/${role}/orders`);
      setRows(Array.isArray(data) ? data : data?.orders || []);
    } catch (e) { setError(friendlyError(e, "Unable to load orders.")); }
    finally { setLoading(false); setRefreshing(false); }
  }, [role]);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => rows.reduce((all, row) => {
    const key = String(row.status || "pending").toLowerCase();
    all[key] = (all[key] || 0) + 1; return all;
  }, {}), [rows]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const status = String(row.status || "pending").toLowerCase();
      const text = [row.order_no, row.retailer_name, row.wholesaler_name, row.id].filter(Boolean).join(" ").toLowerCase();
      return (filter === "all" || status === filter) && (!term || text.includes(term));
    });
  }, [rows, query, filter]);

  const header = <View>
    <View style={styles.header}>
      <View><Text style={styles.eyebrow}>{retailer ? "PURCHASING" : "ORDER DESK"}</Text><Text style={styles.title}>{retailer ? "My orders" : "Retailer orders"}</Text><Text style={styles.subtitle}>{rows.length} order{rows.length === 1 ? "" : "s"} in your workspace</Text></View>
      <Pressable onPress={() => retailer ? navigation.navigate("CreateOrder") : load(true)} style={({ pressed }) => [retailer ? styles.add : styles.refresh, pressed && styles.pressed]}><Ionicons name={retailer ? "add" : "refresh-outline"} size={retailer ? 25 : 21} color={retailer ? colors.white : colors.ink} /></Pressable>
    </View>
    <View style={styles.search}><Ionicons name="search-outline" size={19} color={colors.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search orders or partners" placeholderTextColor={colors.muted} style={styles.searchInput} />{!!query && <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable>}</View>
    <FlatList horizontal data={FILTERS} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} renderItem={({ item }) => {
      const active = item === filter, count = item === "all" ? rows.length : counts[item] || 0;
      return <Pressable onPress={() => setFilter(item)} style={[styles.filter, active && styles.filterActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text><View style={[styles.count, active && styles.countActive]}><Text style={[styles.countText, active && styles.filterTextActive]}>{count}</Text></View></Pressable>;
    }} />
    {!!error && <View style={styles.error}><Ionicons name="cloud-offline-outline" size={18} color={colors.red} /><Text style={styles.errorText}>{error}</Text></View>}
    <View style={styles.results}><Text style={styles.resultsTitle}>{filter === "all" ? "All orders" : `${filter} orders`}</Text><Text style={styles.resultsCount}>{visible.length} results</Text></View>
  </View>;

  return <SafeAreaView style={styles.safe} edges={["top"]}>{loading ? <View style={styles.loading}><ActivityIndicator color="#1A73E8" /><Text style={styles.loadingText}>Loading orders…</Text></View> :
    <FlatList data={visible} keyExtractor={(item, index) => String(item.id || index)} ListHeaderComponent={header} ItemSeparatorComponent={() => <View style={styles.gap} />} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
      renderItem={({ item }) => <Pressable onPress={() => navigation.navigate(retailer ? "RetailerOrderDetails" : "WholesalerOrderDetails", { id: item.id })} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <View style={styles.cardTop}><View style={styles.orderIcon}><Ionicons name="bag-handle-outline" size={20} color={colors.primaryDark} /></View><View style={styles.orderCopy}><Text numberOfLines={1} style={styles.orderNo}>{item.order_no || `Order #${item.id}`}</Text><Text numberOfLines={1} style={styles.partner}>{(retailer ? item.wholesaler_name : item.retailer_name) || "Business partner"}</Text></View><StatusBadge status={item.status} /></View>
        <View style={styles.divider} /><View style={styles.cardBottom}><View style={styles.meta}><Ionicons name="calendar-clear-outline" size={14} color={colors.muted} /><Text style={styles.metaText}>{retailer ? "Created" : "Required"} {date(retailer ? item.created_at : item.required_date || item.created_at)}</Text></View><View style={styles.amountRow}><Text style={styles.amount}>{money(item.total_amount)}</Text><Ionicons name="chevron-forward" size={16} color={colors.muted} /></View></View>
      </Pressable>}
      ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="bag-handle-outline" size={27} color={colors.primary} /></View><Text style={styles.emptyTitle}>{query || filter !== "all" ? "No matching orders" : "No orders yet"}</Text><Text style={styles.emptyCopy}>{query || filter !== "all" ? "Try another search or status filter." : retailer ? "Create your first purchase order to get started." : "New retailer orders will appear here."}</Text>{retailer && !query && filter === "all" ? <Pressable onPress={() => navigation.navigate("CreateOrder")} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Create order</Text></Pressable> : null}</View>} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFFFFF"},page:{paddingHorizontal:16,paddingTop:10,paddingBottom:34},header:{minHeight:82,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},eyebrow:{color:"#1A73E8",fontSize:10,fontWeight:"700",letterSpacing:.8},title:{marginTop:4,color:"#1F1F1F",fontSize:26,fontWeight:"700",letterSpacing:-.5},subtitle:{marginTop:4,color:"#5F6368",fontSize:12},
  add:{width:48,height:48,alignItems:"center",justifyContent:"center",borderRadius:24,backgroundColor:"#1A73E8",...shadow,shadowColor:"#1A73E8",shadowOpacity:.2},refresh:{width:44,height:44,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#DADCE0",borderRadius:22,backgroundColor:"#FFFFFF"},pressed:{opacity:.7},
  search:{minHeight:52,marginTop:12,flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:15,borderWidth:1,borderColor:"#DADCE0",borderRadius:14,backgroundColor:"#FFFFFF"},searchInput:{flex:1,height:50,paddingVertical:0,color:"#1F1F1F",fontSize:14},filters:{gap:8,paddingTop:14,paddingBottom:4},
  filter:{minHeight:36,flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:12,borderWidth:1,borderColor:"#DADCE0",borderRadius:18,backgroundColor:"#FFFFFF"},filterActive:{borderColor:"#1A73E8",backgroundColor:"#1A73E8"},filterText:{color:"#5F6368",fontSize:11,fontWeight:"600",textTransform:"capitalize"},filterTextActive:{color:"#FFFFFF"},count:{minWidth:19,height:19,alignItems:"center",justifyContent:"center",paddingHorizontal:4,borderRadius:10,backgroundColor:"#F1F3F4"},countActive:{backgroundColor:"rgba(255,255,255,.24)"},countText:{color:"#5F6368",fontSize:8,fontWeight:"700"},
  error:{marginTop:14,flexDirection:"row",alignItems:"center",gap:8,padding:13,borderRadius:12,backgroundColor:"#FEF7F6",borderWidth:1,borderColor:"#FCE8E6"},errorText:{flex:1,color:"#C5221F",fontSize:12},results:{marginTop:22,marginBottom:9,flexDirection:"row",justifyContent:"space-between",paddingHorizontal:4},resultsTitle:{color:"#1F1F1F",fontSize:15,fontWeight:"700",textTransform:"capitalize"},resultsCount:{color:"#5F6368",fontSize:11},
  card:{paddingHorizontal:16,paddingVertical:14,borderWidth:1,borderColor:"#E8EAED",borderRadius:16,backgroundColor:"#FFFFFF"},cardPressed:{backgroundColor:"#F8F9FA"},cardTop:{flexDirection:"row",alignItems:"center",gap:12},orderIcon:{width:40,height:40,alignItems:"center",justifyContent:"center",borderRadius:20,backgroundColor:"#F1F3F4"},orderCopy:{flex:1,minWidth:0},orderNo:{color:"#1F1F1F",fontSize:14,fontWeight:"600"},partner:{marginTop:3,color:"#5F6368",fontSize:12},divider:{height:StyleSheet.hairlineWidth,marginVertical:12,backgroundColor:"#F1F3F4"},cardBottom:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},meta:{flex:1,flexDirection:"row",alignItems:"center",gap:6},metaText:{color:"#5F6368",fontSize:11},amountRow:{flexDirection:"row",alignItems:"center",gap:6},amount:{color:"#1F1F1F",fontSize:13,fontWeight:"700"},gap:{height:10},
  loading:{flex:1,alignItems:"center",justifyContent:"center",gap:10},loadingText:{color:"#5F6368",fontSize:12},empty:{alignItems:"center",paddingVertical:50,paddingHorizontal:28},emptyIcon:{width:58,height:58,alignItems:"center",justifyContent:"center",borderRadius:29,backgroundColor:"#E8F0FE"},emptyTitle:{marginTop:14,color:"#1F1F1F",fontSize:16,fontWeight:"700"},emptyCopy:{maxWidth:260,marginTop:6,color:"#5F6368",fontSize:12,lineHeight:17,textAlign:"center"},emptyButton:{minHeight:42,marginTop:18,justifyContent:"center",paddingHorizontal:18,borderRadius:21,backgroundColor:"#1A73E8"},emptyButtonText:{color:"#FFFFFF",fontSize:12,fontWeight:"700"}
});
