import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import api from "../../services/api";
import { colors, shadow } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";
import { date, title } from "../../utils/format";

const STAGES = ["pending", "packed", "ready", "dispatched", "out_for_delivery", "delivered"];

function Progress({ status }) {
  const rank = Math.max(0, STAGES.indexOf(String(status || "pending").toLowerCase()));
  return <View style={styles.progressRow}>{STAGES.map((stage, index) => <View key={stage} style={styles.progressPart}><View style={[styles.progressDot, index <= rank && styles.progressDotDone]}>{index < rank ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}</View>{index < STAGES.length - 1 ? <View style={[styles.progressLine, index < rank && styles.progressLineDone]} /> : null}</View>)}</View>;
}

export default function RetailerDeliveriesScreen({ navigation }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true); setError("");
      const { data } = await api.get("/retailer/orders");
      const orders = (Array.isArray(data) ? data : data?.orders || []).slice(0, 40);
      const details = await Promise.all(orders.map((order) => api.get(`/retailer/orders/${order.id}`).then((response) => response.data).catch(() => null)));
      setRows(details.filter((item) => item?.delivery).map((item) => ({ ...item.delivery, order:item.order, items:item.items || [] })));
    } catch (requestError) { setError(requestError?.response?.data?.message || "Unable to load deliveries."); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => rows.filter((row) => filter === "all" || (filter === "completed" ? ["delivered", "cancelled"].includes(row.status) : !["delivered", "cancelled"].includes(row.status))), [filter, rows]);
  const activeCount = rows.filter((row) => !["delivered", "cancelled"].includes(row.status)).length;

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />} contentContainerStyle={styles.page}>
    <MobileHeader eyebrow="Order fulfilment" title="Deliveries" subtitle="Track shipments from preparation to your shop." onBack={() => navigation.goBack()} actionIcon="refresh-outline" onAction={() => load(true)} />
    <View style={styles.summary}><View style={styles.summaryIcon}><Ionicons name="truck-outline" size={24} color={colors.primary} /></View><View><Text style={styles.summaryValue}>{activeCount}</Text><Text style={styles.summaryLabel}>Active deliveries</Text></View><View style={styles.summaryRight}><Text style={styles.summaryValue}>{rows.length}</Text><Text style={styles.summaryLabel}>Total tracked</Text></View></View>
    <View style={styles.filters}>{[["active","Active"],["completed","Completed"],["all","All"]].map(([value,label]) => <Pressable key={value} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.filterActive]}><Text style={[styles.filterText, filter === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</View>
    {!!error && <Pressable onPress={() => load()} style={styles.error}><Text style={styles.errorText}>{error} Tap to retry.</Text></Pressable>}
    {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View> : visible.length ? <View style={styles.list}>{visible.map((delivery) => <Pressable key={delivery.id} onPress={() => navigation.navigate("RetailerOrderDetails", { id:delivery.order?.id || delivery.order_id })} style={styles.card}><View style={styles.cardHead}><View style={styles.deliveryIcon}><Ionicons name="cube-outline" size={20} color={colors.primary} /></View><View style={styles.cardCopy}><Text style={styles.deliveryNo}>{delivery.delivery_no || `Delivery #${delivery.id}`}</Text><Text style={styles.orderNo}>{delivery.order?.order_no || `Order #${delivery.order_id}`}</Text></View><View style={styles.status}><Text style={styles.statusText}>{title(delivery.status)}</Text></View></View><Progress status={delivery.status} /><View style={styles.info}><Info icon="storefront-outline" value={delivery.order?.wholesaler_name || "Wholesaler"} /><Info icon="location-outline" value={delivery.delivery_address || delivery.order?.delivery_address} /><Info icon="calendar-outline" value={date(delivery.required_date || delivery.order?.required_date)} /></View>{delivery.driver_name || delivery.vehicle_number ? <View style={styles.transport}><Ionicons name="car-sport-outline" size={17} color="#16883F" /><View style={styles.transportCopy}><Text style={styles.transportTitle}>{delivery.driver_name || "Driver assigned"}</Text><Text style={styles.transportText}>{[delivery.vehicle_number, delivery.driver_phone].filter(Boolean).join(" · ")}</Text></View></View> : null}<View style={styles.track}><Text style={styles.trackText}>Track delivery</Text><Ionicons name="chevron-forward" size={16} color={colors.primary} /></View></Pressable>)}</View> : <View style={styles.empty}><Ionicons name="truck-outline" size={34} color={colors.primary} /><Text style={styles.emptyTitle}>No {filter === "all" ? "" : filter} deliveries</Text><Text style={styles.emptyText}>Delivery tracking appears after a wholesaler prepares your confirmed order.</Text></View>}
  </ScrollView></SafeAreaView>;
}

function Info({ icon, value }) { return <View style={styles.infoRow}><Ionicons name={icon} size={14} color={colors.muted} /><Text numberOfLines={1} style={styles.infoText}>{value || "Not provided"}</Text></View>; }

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:"#F7F8FA"},page:{padding:16,paddingBottom:35},summary:{minHeight:82,flexDirection:"row",alignItems:"center",gap:12,padding:15,borderRadius:17,backgroundColor:"#FFFFFF",...shadow,shadowOpacity:.06},summaryIcon:{width:48,height:48,alignItems:"center",justifyContent:"center",borderRadius:15,backgroundColor:colors.primarySoft},summaryValue:{color:colors.ink,fontSize:19,fontWeight:"900"},summaryLabel:{marginTop:2,color:colors.body,fontSize:8},summaryRight:{marginLeft:"auto",alignItems:"flex-end"},filters:{marginTop:14,flexDirection:"row",gap:7,padding:4,borderRadius:12,backgroundColor:"#E8EAED"},filter:{flex:1,minHeight:38,alignItems:"center",justifyContent:"center",borderRadius:9},filterActive:{backgroundColor:colors.white},filterText:{color:colors.body,fontSize:9,fontWeight:"800"},filterTextActive:{color:colors.primary},error:{marginTop:12,padding:11,borderRadius:10,backgroundColor:colors.redSoft},errorText:{color:colors.red,fontSize:9},loading:{minHeight:300,alignItems:"center",justifyContent:"center"},list:{marginTop:14,gap:11},card:{padding:14,borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.white,...shadow,shadowOpacity:.05},cardHead:{flexDirection:"row",alignItems:"center",gap:10},deliveryIcon:{width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:13,backgroundColor:colors.primarySoft},cardCopy:{flex:1},deliveryNo:{color:colors.ink,fontSize:12,fontWeight:"900"},orderNo:{marginTop:3,color:colors.body,fontSize:8},status:{paddingVertical:5,paddingHorizontal:8,borderRadius:10,backgroundColor:"#EAF2FF"},statusText:{color:colors.primary,fontSize:7,fontWeight:"900"},progressRow:{height:22,marginTop:15,flexDirection:"row",alignItems:"center"},progressPart:{flex:1,flexDirection:"row",alignItems:"center"},progressDot:{width:15,height:15,alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:"#CCD3DC",borderRadius:8,backgroundColor:"#FFFFFF"},progressDotDone:{borderColor:colors.primary,backgroundColor:colors.primary},progressLine:{flex:1,height:2,backgroundColor:"#DDE2E8"},progressLineDone:{backgroundColor:colors.primary},info:{marginTop:10,gap:6},infoRow:{flexDirection:"row",alignItems:"center",gap:6},infoText:{flex:1,color:colors.body,fontSize:9},transport:{marginTop:11,flexDirection:"row",alignItems:"center",gap:8,padding:10,borderRadius:10,backgroundColor:"#E9F7EE"},transportCopy:{flex:1},transportTitle:{color:"#166534",fontSize:9,fontWeight:"900"},transportText:{marginTop:2,color:"#39804F",fontSize:8},track:{marginTop:12,paddingTop:11,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderTopWidth:1,borderTopColor:colors.border},trackText:{color:colors.primary,fontSize:9,fontWeight:"900"},empty:{minHeight:300,alignItems:"center",justifyContent:"center",padding:25},emptyTitle:{marginTop:11,color:colors.ink,fontSize:14,fontWeight:"900"},emptyText:{maxWidth:280,marginTop:6,color:colors.body,fontSize:9,lineHeight:15,textAlign:"center"}});
