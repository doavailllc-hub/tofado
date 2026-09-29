import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { shadow } from "../../theme/colors";

function money(product) {
  if (product.price_mode === "quote") return "Price on request";
  const value = Number(product.price);
  return Number.isFinite(value) ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits:2 })}` : "Contact supplier";
}

export default function RetailerStorefrontScreen({ navigation, route }) {
  const { user } = useAuth();
  const slug = route.params?.slug;
  const initialVendor = route.params?.vendor || {};
  const [catalog, setCatalog] = useState(null);
  const [products, setProducts] = useState([]);
  const [connection, setConnection] = useState(initialVendor.connection_status || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      const { data } = await api.get(`/public/catalog/${encodeURIComponent(slug)}`);
      setCatalog(data?.catalog || null);
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load this storefront.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const connect = async () => {
    if (!user) { navigation.navigate("Login"); return; }
    if (connection === "active") {
      navigation.getParent()?.navigate("RetailerOrders", { screen:"CreateOrder", params:{ wholesalerId:catalog?.wholesaler_id, wholesalerName:catalog?.business_name } });
      return;
    }
    if (connection === "pending") return;
    try {
      setSending(true); setError("");
      await api.post(`/retailer/wholesalers/${catalog?.wholesaler_id}/request`, {});
      setConnection("pending");
    } catch (requestError) { setError(requestError?.response?.data?.message || "Unable to send connection request."); }
    finally { setSending(false); }
  };

  const categories = useMemo(() => [...new Set(products.map((item) => item.category_name).filter(Boolean))], [products]);
  const actionLabel = !user ? "Login to connect" : connection === "active" ? "Create purchase order" : connection === "pending" ? "Request pending" : "Send connection request";
  const actionIcon = !user ? "log-in-outline" : connection === "active" ? "bag-add-outline" : connection === "pending" ? "time-outline" : "person-add-outline";

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color="#2874F0" /><Text style={styles.loadingText}>Opening storefront…</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#2874F0" />} contentContainerStyle={styles.page}>
    <View style={styles.topBar}><Pressable onPress={() => navigation.goBack()} style={styles.circle}><Ionicons name="arrow-back" size={21} color="#172337" /></Pressable><Text style={styles.topTitle}>Storefront</Text><Pressable style={styles.circle}><Ionicons name="share-social-outline" size={20} color="#2874F0" /></Pressable></View>
    {!!error && <Pressable onPress={() => load()} style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#C5221F" /><Text style={styles.errorText}>{error}</Text></Pressable>}
    {catalog ? <>
      <View style={styles.cover}>{catalog.cover_image_url ? <Image source={{ uri:catalog.cover_image_url }} style={styles.coverImage} /> : <View style={styles.coverFallback}><Ionicons name="storefront" size={52} color="#A8C7FA" /></View>}<View style={styles.coverShade} /></View>
      <View style={styles.profileCard}><View style={styles.logo}>{catalog.logo_url ? <Image source={{ uri:catalog.logo_url }} style={styles.logoImage} /> : <Text style={styles.logoLetter}>{String(catalog.business_name || "T")[0]}</Text>}</View><View style={styles.profileCopy}><View style={styles.nameRow}><Text style={styles.name}>{catalog.business_name}</Text><Ionicons name="checkmark-circle" size={18} color="#16883F" /></View><Text style={styles.catalogTitle}>{catalog.catalog_title}</Text></View><View style={styles.profileMeta}><View style={styles.metaItem}><Ionicons name="location-outline" size={16} color="#6B7280" /><Text numberOfLines={1} style={styles.metaText}>{catalog.location || "India"}</Text></View><View style={styles.metaItem}><Ionicons name="cube-outline" size={16} color="#6B7280" /><Text style={styles.metaText}>{products.length} products</Text></View></View>{catalog.catalog_description ? <Text style={styles.description}>{catalog.catalog_description}</Text> : null}<Pressable disabled={sending || connection === "pending"} onPress={connect} style={[styles.action, connection === "pending" && styles.actionDisabled]}>{sending ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name={actionIcon} size={18} color={connection === "pending" ? "#6B7280" : "#FFFFFF"} /><Text style={[styles.actionText, connection === "pending" && styles.actionTextDisabled]}>{actionLabel}</Text></>}</Pressable></View>
      {!!categories.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{categories.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}</ScrollView>}
      <View style={styles.productsHead}><View><Text style={styles.productsTitle}>Products</Text><Text style={styles.productsSub}>Browse this wholesaler’s catalog</Text></View><Text style={styles.count}>{products.length} items</Text></View>
      {products.length ? <View style={styles.grid}>{products.map((product) => <View key={product.id} style={styles.product}><View style={styles.productImage}>{product.image_url ? <Image source={{ uri:product.image_url }} style={styles.photo} /> : <Ionicons name="cube-outline" size={32} color="#2874F0" />}</View><Text numberOfLines={1} style={styles.productCategory}>{product.category_name || "Wholesale"}</Text><Text numberOfLines={2} style={styles.productName}>{product.name}</Text><Text numberOfLines={1} style={styles.productBrand}>{[product.brand, product.pack_size].filter(Boolean).join(" · ")}</Text><Text style={styles.price}>{money(product)}</Text><Text style={styles.unit}>{product.price_mode === "quote" ? "Contact for price" : `per ${product.unit || "piece"}`}</Text></View>)}</View> : <View style={styles.empty}><Ionicons name="cube-outline" size={32} color="#2874F0" /><Text style={styles.emptyTitle}>No products published</Text></View>}
    </> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F3F5F9"},page:{paddingBottom:35},center:{flex:1,alignItems:"center",justifyContent:"center"},loadingText:{marginTop:9,color:"#6B7280",fontSize:10},topBar:{height:58,paddingHorizontal:13,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#FFFFFF"},circle:{width:39,height:39,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#E1E5EB",borderRadius:20,backgroundColor:"#FFFFFF"},topTitle:{color:"#172337",fontSize:16,fontWeight:"900"},error:{margin:12,flexDirection:"row",alignItems:"center",gap:8,padding:12,borderRadius:10,backgroundColor:"#FEF1F0"},errorText:{flex:1,color:"#C5221F",fontSize:10},cover:{height:170,backgroundColor:"#DDEBFF"},coverImage:{width:"100%",height:"100%",resizeMode:"cover"},coverFallback:{flex:1,alignItems:"center",justifyContent:"center"},coverShade:{position:"absolute",top:0,right:0,bottom:0,left:0,backgroundColor:"rgba(10,35,70,.12)"},profileCard:{marginHorizontal:12,marginTop:-35,padding:15,paddingTop:48,borderWidth:1,borderColor:"#E1E5EB",borderRadius:15,backgroundColor:"#FFFFFF",...shadow,shadowOpacity:.09},logo:{position:"absolute",top:-34,left:15,width:70,height:70,alignItems:"center",justifyContent:"center",overflow:"hidden",borderWidth:4,borderColor:"#FFFFFF",borderRadius:18,backgroundColor:"#EAF2FF"},logoImage:{width:"100%",height:"100%",resizeMode:"contain"},logoLetter:{color:"#2874F0",fontSize:28,fontWeight:"900"},profileCopy:{minWidth:0},nameRow:{flexDirection:"row",alignItems:"center",gap:5},name:{flexShrink:1,color:"#172337",fontSize:20,fontWeight:"900",letterSpacing:-.4},catalogTitle:{marginTop:4,color:"#6B7280",fontSize:10},profileMeta:{marginTop:13,flexDirection:"row",gap:15},metaItem:{flex:1,flexDirection:"row",alignItems:"center",gap:5},metaText:{flex:1,color:"#4B5563",fontSize:9},description:{marginTop:12,color:"#4B5563",fontSize:10,lineHeight:16},action:{minHeight:46,marginTop:15,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderRadius:9,backgroundColor:"#2874F0"},actionDisabled:{borderWidth:1,borderColor:"#D5DBE5",backgroundColor:"#F3F5F9"},actionText:{color:"#FFFFFF",fontSize:11,fontWeight:"900"},actionTextDisabled:{color:"#6B7280"},chips:{paddingHorizontal:12,paddingVertical:13,gap:7},chip:{paddingVertical:7,paddingHorizontal:10,borderRadius:14,backgroundColor:"#EAF2FF"},chipText:{color:"#2874F0",fontSize:8,fontWeight:"800"},productsHead:{marginTop:3,padding:15,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#FFFFFF"},productsTitle:{color:"#172337",fontSize:18,fontWeight:"900"},productsSub:{marginTop:3,color:"#6B7280",fontSize:9},count:{color:"#2874F0",fontSize:9,fontWeight:"800"},grid:{padding:10,flexDirection:"row",flexWrap:"wrap",gap:10},product:{width:"48.5%",padding:10,borderWidth:1,borderColor:"#E1E5EB",borderRadius:12,backgroundColor:"#FFFFFF"},productImage:{height:128,alignItems:"center",justifyContent:"center",overflow:"hidden",borderRadius:9,backgroundColor:"#F5F7FA"},photo:{width:"100%",height:"100%",resizeMode:"contain"},productCategory:{marginTop:9,color:"#2874F0",fontSize:7,fontWeight:"800",textTransform:"uppercase"},productName:{minHeight:31,marginTop:4,color:"#172337",fontSize:11,lineHeight:15,fontWeight:"800"},productBrand:{marginTop:3,color:"#6B7280",fontSize:8},price:{marginTop:8,color:"#172337",fontSize:13,fontWeight:"900"},unit:{marginTop:2,color:"#16883F",fontSize:8},empty:{minHeight:230,alignItems:"center",justifyContent:"center"},emptyTitle:{marginTop:10,color:"#172337",fontSize:13,fontWeight:"800"},
});
