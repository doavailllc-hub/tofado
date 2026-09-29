import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../../services/api";
import { shadow } from "../../theme/colors";
import { useAuth } from "../../context/AuthContext";

const CATEGORY_ICONS = ["🛒", "🥤", "💊", "🍽️", "🏨", "🏗️", "🏭", "💻", "📦", "🧴"];

function actionFor(vendor) {
  const status = String(vendor.connection_status || "").toLowerCase();
  if (status === "active") return { label:"Connected", icon:"checkmark-circle", disabled:true };
  if (status === "pending") return { label:"Pending", icon:"time", disabled:true };
  if (status === "blocked") return { label:"Unavailable", icon:"close-circle", disabled:true };
  return { label:status === "rejected" ? "Request again" : "Connect", icon:"paper-plane-outline", disabled:false };
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `₹${amount.toLocaleString("en-IN", { maximumFractionDigits:2 })}` : "Price on request";
}

export default function FindWholesalersScreen({ navigation, route }) {
  const { user } = useAuth();
  const scrollRef = useRef(null);
  const isMarketplace = ["RetailerMarketplace", "MarketplaceHome", "PublicMarketplace"].includes(route?.name);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [vendors, setVendors] = useState([]);
  const [home, setHome] = useState({ categories:[], popular_products:[], stats:{} });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [vendorTab, setVendorTab] = useState("all");
  const [monthStats, setMonthStats] = useState({ total:0, orders:0, suppliers:0 });

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      const retailerQuery = [query.trim(), category].filter(Boolean).join(" ");
      const [vendorResponse, connectionResponse, homeResponse, ordersResponse] = await Promise.all([
        api.get("/public/marketplace/wholesalers", { params:{ q:query.trim(), category, limit:48 } }),
        user ? api.get("/retailer/wholesalers/search", { params:{ q:retailerQuery } }) : Promise.resolve({ data:null }),
        api.get("/public/marketplace/home"),
        user ? api.get("/retailer/orders") : Promise.resolve({ data:[] }),
      ]);
      const payload = vendorResponse.data;
      const publicVendors = Array.isArray(payload) ? payload : Array.isArray(payload?.wholesalers) ? payload.wholesalers : [];
      const connectionPayload = connectionResponse.data;
      const connections = Array.isArray(connectionPayload) ? connectionPayload : Array.isArray(connectionPayload?.wholesalers) ? connectionPayload.wholesalers : [];
      const connectionById = new Map(connections.map((item) => [String(item.id), item]));
      setVendors(publicVendors.map((vendor) => ({ ...vendor, ...(connectionById.get(String(vendor.id)) || {}) })));
      setHome(homeResponse.data || { categories:[], popular_products:[], stats:{} });
      const orderPayload = ordersResponse.data;
      const orders = Array.isArray(orderPayload) ? orderPayload : Array.isArray(orderPayload?.orders) ? orderPayload.orders : [];
      const now = new Date();
      const monthly = orders.filter((order) => { const date = new Date(order.created_at); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(); });
      setMonthStats({ total:monthly.reduce((sum, order) => sum + Number(order.total_amount || 0), 0), orders:monthly.length, suppliers:new Set(monthly.map((order) => order.wholesaler_name).filter(Boolean)).size });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "The marketplace is temporarily unavailable.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [category, query, user]);

  useEffect(() => { const timer = setTimeout(() => load(), 300); return () => clearTimeout(timer); }, [load]);

  const sendRequest = async (vendor) => {
    if (!user) { navigation.navigate("Login"); return; }
    try {
      setSendingId(vendor.id); setError(""); setNotice("");
      const { data } = await api.post(`/retailer/wholesalers/${vendor.id}/request`, {});
      setVendors((current) => current.map((item) => item.id === vendor.id ? { ...item, connection_status:"pending", connection_id:data?.connection_id || item.connection_id } : item));
      setNotice(data?.message || "Connection request sent.");
    } catch (requestError) { setError(requestError?.response?.data?.message || "Unable to send connection request."); }
    finally { setSendingId(null); }
  };

  const openStore = (vendor) => {
    if (!vendor.catalog_slug) return;
    navigation.navigate("Storefront", { slug:vendor.catalog_slug, vendor });
  };

  const categories = useMemo(() => (Array.isArray(home.categories) ? home.categories : []).slice(0, 12), [home.categories]);
  const products = useMemo(() => (Array.isArray(home.popular_products) ? home.popular_products : []).slice(0, 10), [home.popular_products]);
  const displayedVendors = useMemo(() => {
    if (vendorTab !== "top") return vendors;
    const connectionById = new Map(vendors.map((item) => [String(item.id), item]));
    const trending = Array.isArray(home.trending_wholesalers) ? home.trending_wholesalers : [];
    return trending.map((vendor) => ({ ...vendor, ...(connectionById.get(String(vendor.id)) || {}) }));
  }, [home.trending_wholesalers, vendorTab, vendors]);
  const trendingSuppliers = useMemo(() => (Array.isArray(home.trending_wholesalers) ? home.trending_wholesalers : []).slice(0, 8), [home.trending_wholesalers]);
  const valueProducts = useMemo(() => products.filter((item) => item.price_mode !== "quote" && Number(item.price) > 0).sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 8), [products]);
  const valueSuppliers = useMemo(() => { const seen = new Set(); return valueProducts.filter((item) => { const key = String(item.wholesaler_id); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 6); }, [valueProducts]);

  return <SafeAreaView style={styles.safe} edges={["top"]}><ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#2874F0" />} contentContainerStyle={[styles.page, !user && styles.guestPage]}>
    <View style={styles.appBar}>{!isMarketplace ? <><Pressable onPress={() => navigation.goBack()} style={styles.iconButton}><Ionicons name="arrow-back" size={21} color="#172337" /></Pressable><View style={styles.brandCopy}><Text style={styles.brand}>Tofado</Text><Text style={styles.brandSub}>WHOLESALE MARKETPLACE</Text></View></> : <View style={styles.headerLogoBlock}><Image source={require("../../../assets/tofado-logo.png")} resizeMode="contain" style={styles.headerLogo} /><Text style={styles.logoCaption}>WHOLESALE MARKETPLACE</Text></View>}<Pressable onPress={!user ? () => navigation.navigate("Login") : () => navigation.getParent()?.navigate("RetailerMore", { screen:"Profile" })} style={styles.accountButton}><Ionicons name={user ? "person-circle-outline" : "log-in-outline"} size={19} color="#2874F0" /><Text style={styles.accountText}>{user ? "Account" : "Login"}</Text></Pressable></View>
    <View style={styles.search}><Ionicons name="search-outline" size={20} color="#6B7280" /><TextInput value={query} onChangeText={(value) => { setQuery(value); setVendorTab("all"); }} placeholder="Search products, brands or wholesalers" placeholderTextColor="#8B9098" style={styles.searchInput} returnKeyType="search" />{!!query && <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color="#8B9098" /></Pressable>}</View>

    {!query && !category ? <View style={styles.hero}><View style={styles.heroCopy}><Text style={styles.heroEyebrow}>TOFADO FOR RETAILERS</Text><Text style={styles.heroTitle}>Restock your shop at wholesale prices</Text><Text style={styles.heroText}>Discover verified suppliers and order everything your business needs.</Text><Pressable onPress={() => setCategory(categories[0]?.name || "")} style={styles.heroButton}><Text style={styles.heroButtonText}>Shop wholesale</Text><Ionicons name="arrow-forward" size={16} color="#2874F0" /></Pressable></View><View style={styles.heroVisual}><Ionicons name="cart" size={47} color="#FFFFFF" /><View style={styles.heroBadge}><Text style={styles.heroBadgeText}>{home.stats?.products || "1000+"}</Text><Text style={styles.heroBadgeLabel}>products</Text></View></View></View> : null}

    {user && !query && !category ? <View style={styles.monthCard}><View style={styles.monthHead}><View><Text style={styles.monthEyebrow}>THIS MONTH</Text><Text style={styles.monthTitle}>Your purchase activity</Text></View><View style={styles.monthIcon}><Ionicons name="analytics-outline" size={21} color="#2874F0" /></View></View><View style={styles.monthStats}><View style={styles.monthStat}><Text style={styles.monthValue}>{money(monthStats.total)}</Text><Text style={styles.monthLabel}>Total purchases</Text></View><View style={styles.monthDivider} /><View style={styles.monthStat}><Text style={styles.monthValue}>{monthStats.orders}</Text><Text style={styles.monthLabel}>Orders</Text></View><View style={styles.monthDivider} /><View style={styles.monthStat}><Text style={styles.monthValue}>{monthStats.suppliers}</Text><Text style={styles.monthLabel}>Suppliers</Text></View></View></View> : null}

    {!!categories.length && <View style={styles.section}><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Shop by category</Text>{category ? <Pressable onPress={() => setCategory("")}><Text style={styles.clearText}>Clear</Text></Pressable> : null}</View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>{categories.map((item, index) => { const name = item.name || item.category_name || String(item); const active = category === name; return <Pressable key={name} onPress={() => { setCategory(active ? "" : name); setVendorTab("all"); }} style={styles.categoryItem}><View style={[styles.categoryIcon, active && styles.categoryIconActive]}><Text style={styles.categoryEmoji}>{CATEGORY_ICONS[index % CATEGORY_ICONS.length]}</Text></View><Text numberOfLines={2} style={[styles.categoryName, active && styles.categoryNameActive]}>{name}</Text></Pressable>; })}</ScrollView></View>}

    {!query && !category && !!products.length ? <View style={styles.section}><View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Popular wholesale products</Text><Text style={styles.sectionSub}>Trending across the Tofado marketplace</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>{products.map((product) => <View key={product.id} style={styles.productCard}><View style={styles.productImage}>{product.image_url ? <Image source={{ uri:product.image_url }} style={styles.productPhoto} /> : <Ionicons name="cube-outline" size={34} color="#2874F0" />}</View><Text numberOfLines={1} style={styles.productName}>{product.name}</Text><Text numberOfLines={1} style={styles.productSeller}>{product.business_name || "Verified wholesaler"}</Text><Text style={styles.productPrice}>{product.price_mode === "quote" ? "Price on request" : money(product.price)}</Text><Text style={styles.productUnit}>{product.unit ? `per ${product.unit}` : "Wholesale price"}</Text></View>)}</ScrollView></View> : null}

    <View style={styles.section}><View style={styles.vendorTabs}><Pressable onPress={() => setVendorTab("all")} style={[styles.vendorTab, vendorTab === "all" && styles.vendorTabActive]}><Ionicons name="storefront-outline" size={16} color={vendorTab === "all" ? "#FFFFFF" : "#2874F0"} /><Text style={[styles.vendorTabText, vendorTab === "all" && styles.vendorTabTextActive]}>All wholesalers</Text></Pressable><Pressable onPress={() => { setQuery(""); setCategory(""); setVendorTab("top"); }} style={[styles.vendorTab, vendorTab === "top" && styles.vendorTabActive]}><Ionicons name="trending-up" size={16} color={vendorTab === "top" ? "#FFFFFF" : "#2874F0"} /><Text style={[styles.vendorTabText, vendorTab === "top" && styles.vendorTabTextActive]}>Top selling</Text></Pressable></View><View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>{vendorTab === "top" ? "Top selling wholesalers" : category || (query ? "Search results" : "All wholesalers")}</Text><Text style={styles.sectionSub}>{displayedVendors.length} verified supplier{displayedVendors.length === 1 ? "" : "s"}</Text></View><View style={styles.verified}><Ionicons name="shield-checkmark" size={14} color="#16883F" /><Text style={styles.verifiedText}>Verified</Text></View></View>
      {!!error && <Pressable onPress={() => load()} style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#C5221F" /><Text style={styles.errorText}>{error} Tap to retry.</Text></Pressable>}
      {!!notice && <View style={styles.notice}><Ionicons name="checkmark-circle" size={18} color="#16883F" /><Text style={styles.noticeText}>{notice}</Text></View>}
      {loading ? <View style={styles.loading}><ActivityIndicator color="#2874F0" /><Text style={styles.loadingText}>Loading marketplace…</Text></View> : displayedVendors.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vendorGrid}>{displayedVendors.map((vendor) => { const action = user ? actionFor(vendor) : { label:"Login to connect", icon:"log-in-outline", disabled:false }; const sending = sendingId === vendor.id; return <Pressable key={vendor.id} onPress={() => openStore(vendor)} style={styles.vendorCard}><View style={styles.vendorBody}><View style={styles.vendorTop}><View style={styles.vendorLogo}>{vendor.logo_url ? <Image source={{ uri:vendor.logo_url }} style={styles.vendorLogoImage} /> : <Text style={styles.vendorInitial}>{String(vendor.business_name || "T")[0]}</Text>}</View><View style={styles.vendorVerified}><Ionicons name="checkmark-circle" size={13} color="#16883F" /><Text style={styles.vendorVerifiedText}>Verified</Text></View></View><Text numberOfLines={1} style={styles.vendorName}>{vendor.business_name || "Wholesale business"}</Text><Text numberOfLines={1} style={styles.vendorCategory}>{vendor.business_category || vendor.shop_type || "Wholesale supplier"}</Text><View style={styles.location}><Ionicons name="location-outline" size={14} color="#6B7280" /><Text numberOfLines={1} style={styles.locationText}>{vendor.location || "India"}</Text></View><View style={styles.storeLink}><Text style={styles.storeLinkText}>View storefront</Text><Ionicons name="chevron-forward" size={14} color="#2874F0" /></View><Pressable disabled={action.disabled || sending} onPress={() => sendRequest(vendor)} style={[styles.connect, action.disabled && styles.connectDisabled]}>{sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name={action.icon} size={15} color={action.disabled ? "#5F6368" : "#FFFFFF"} /><Text style={[styles.connectText, action.disabled && styles.connectTextDisabled]}>{action.label}</Text></>}</Pressable></View></Pressable>; })}</ScrollView> : <View style={styles.empty}><Ionicons name="search-outline" size={34} color="#2874F0" /><Text style={styles.emptyTitle}>No matching wholesalers</Text><Text style={styles.emptyText}>Try another product, category, business, or location.</Text><Pressable onPress={() => { setQuery(""); setCategory(""); setVendorTab("all"); }} style={styles.emptyButton}><Text style={styles.emptyButtonText}>View all wholesalers</Text></Pressable></View>}
    </View>

    {!query && !category && !!trendingSuppliers.length ? <View style={styles.section}><View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Trending suppliers</Text><Text style={styles.sectionSub}>Wholesalers retailers are ordering from now</Text></View><Ionicons name="trending-up" size={21} color="#16883F" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.miniSupplierRow}>{trendingSuppliers.map((supplier, index) => <Pressable key={supplier.id} onPress={() => openStore(supplier)} style={styles.miniSupplier}><View style={styles.rankBadge}><Text style={styles.rankText}>#{index + 1}</Text></View><View style={styles.miniLogo}>{supplier.logo_url ? <Image source={{ uri:supplier.logo_url }} style={styles.vendorLogoImage} /> : <Text style={styles.miniInitial}>{String(supplier.business_name || "T")[0]}</Text>}</View><Text numberOfLines={1} style={styles.miniName}>{supplier.business_name}</Text><Text numberOfLines={1} style={styles.miniLocation}>{supplier.location || "India"}</Text></Pressable>)}</ScrollView></View> : null}

    {!query && !category && !!valueProducts.length ? <View style={styles.section}><View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Best value products</Text><Text style={styles.sectionSub}>Low-price wholesale products worth checking</Text></View><Ionicons name="pricetag-outline" size={21} color="#E56B00" /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productRow}>{valueProducts.map((product) => <Pressable key={product.id} onPress={() => openStore({ catalog_slug:product.catalog_slug, id:product.wholesaler_id, business_name:product.business_name, logo_url:product.wholesaler_logo_url, location:product.location })} style={styles.productCard}><View style={styles.valueBadge}><Text style={styles.valueBadgeText}>VALUE</Text></View><View style={styles.productImage}>{product.image_url ? <Image source={{ uri:product.image_url }} style={styles.productPhoto} /> : <Ionicons name="cube-outline" size={34} color="#2874F0" />}</View><Text numberOfLines={1} style={styles.productName}>{product.name}</Text><Text numberOfLines={1} style={styles.productSeller}>{product.business_name}</Text><Text style={styles.productPrice}>{money(product.price)}</Text><Text style={styles.productUnit}>{product.unit ? `per ${product.unit}` : "Wholesale price"}</Text></Pressable>)}</ScrollView></View> : null}

    {!query && !category && !!valueSuppliers.length ? <View style={styles.section}><View style={styles.sectionHead}><View><Text style={styles.sectionTitle}>Best value suppliers</Text><Text style={styles.sectionSub}>Suppliers offering some of the lowest listed prices</Text></View><Ionicons name="wallet-outline" size={21} color="#2874F0" /></View><View style={styles.valueSupplierList}>{valueSuppliers.map((supplier) => <Pressable key={supplier.wholesaler_id} onPress={() => openStore({ catalog_slug:supplier.catalog_slug, id:supplier.wholesaler_id, business_name:supplier.business_name, logo_url:supplier.wholesaler_logo_url, location:supplier.location })} style={styles.valueSupplier}><View style={styles.miniLogo}>{supplier.wholesaler_logo_url ? <Image source={{ uri:supplier.wholesaler_logo_url }} style={styles.vendorLogoImage} /> : <Text style={styles.miniInitial}>{String(supplier.business_name || "T")[0]}</Text>}</View><View style={styles.valueSupplierCopy}><Text numberOfLines={1} style={styles.valueSupplierName}>{supplier.business_name}</Text><Text style={styles.valueSupplierFrom}>Products from {money(supplier.price)}</Text></View><Ionicons name="chevron-forward" size={18} color="#8B9098" /></Pressable>)}</View></View> : null}
  </ScrollView>{!user ? <View style={styles.guestNav}><Pressable onPress={() => { setQuery(""); setCategory(""); setVendorTab("all"); scrollRef.current?.scrollTo({ y:0, animated:true }); }} style={styles.guestNavItem}><Ionicons name="home" size={21} color="#2874F0" /><Text style={styles.guestNavTextActive}>Home</Text></Pressable><Pressable onPress={() => { setCategory(categories[0]?.name || ""); setVendorTab("all"); scrollRef.current?.scrollTo({ y:250, animated:true }); }} style={styles.guestNavItem}><Ionicons name="grid-outline" size={21} color="#6B7280" /><Text style={styles.guestNavText}>Categories</Text></Pressable><Pressable onPress={() => navigation.navigate("Login")} style={styles.guestNavItem}><Ionicons name="bag-handle-outline" size={21} color="#6B7280" /><Text style={styles.guestNavText}>Orders</Text></Pressable><Pressable onPress={() => navigation.navigate("Login")} style={styles.guestNavItem}><Ionicons name="person-outline" size={21} color="#6B7280" /><Text style={styles.guestNavText}>Account</Text></Pressable></View> : null}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F3F5F9"},page:{paddingBottom:34},appBar:{minHeight:62,flexDirection:"row",alignItems:"center",paddingHorizontal:16,backgroundColor:"#FFFFFF",borderBottomWidth:1,borderBottomColor:"#E5E7EB"},headerLogo:{width:104,height:38},iconButton:{width:38,height:38,alignItems:"center",justifyContent:"center"},brandCopy:{flex:1,marginLeft:8},brand:{color:"#172337",fontSize:20,fontWeight:"900",letterSpacing:-.6},brandSub:{marginTop:1,color:"#2874F0",fontSize:7,fontWeight:"800",letterSpacing:.7},accountButton:{minHeight:38,flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:10,borderWidth:1,borderColor:"#D7E3FA",borderRadius:9,backgroundColor:"#F8FBFF"},accountText:{color:"#2874F0",fontSize:10,fontWeight:"800"},search:{height:52,margin:12,marginBottom:0,flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:14,borderWidth:1,borderColor:"#D5DBE5",borderRadius:10,backgroundColor:"#FFFFFF",...shadow,shadowOpacity:.06},searchInput:{flex:1,height:50,color:"#172337",fontSize:13},hero:{minHeight:206,margin:12,overflow:"hidden",flexDirection:"row",borderRadius:16,backgroundColor:"#2874F0"},heroCopy:{flex:1,padding:21,paddingRight:5},heroEyebrow:{color:"#CFE0FF",fontSize:8,fontWeight:"900",letterSpacing:1},heroTitle:{marginTop:8,color:"#FFFFFF",fontSize:23,lineHeight:28,fontWeight:"900",letterSpacing:-.6},heroText:{marginTop:8,color:"#E8F0FE",fontSize:10,lineHeight:15},heroButton:{alignSelf:"flex-start",minHeight:36,marginTop:15,flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:12,borderRadius:7,backgroundColor:"#FFFFFF"},heroButtonText:{color:"#2874F0",fontSize:9,fontWeight:"900"},heroVisual:{width:115,alignItems:"center",justifyContent:"center",backgroundColor:"#1B5DC8"},heroBadge:{marginTop:15,alignItems:"center",paddingVertical:8,paddingHorizontal:12,borderRadius:10,backgroundColor:"rgba(255,255,255,.15)"},heroBadgeText:{color:"#FFFFFF",fontSize:14,fontWeight:"900"},heroBadgeLabel:{color:"#DCE8FF",fontSize:7},section:{marginTop:10,paddingVertical:17,backgroundColor:"#FFFFFF",borderTopWidth:1,borderBottomWidth:1,borderColor:"#E5E7EB"},sectionHead:{minHeight:35,marginBottom:13,paddingHorizontal:16,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},sectionTitle:{color:"#172337",fontSize:17,fontWeight:"900",letterSpacing:-.3},sectionSub:{marginTop:3,color:"#6B7280",fontSize:9},clearText:{color:"#2874F0",fontSize:10,fontWeight:"800"},categoryRow:{paddingHorizontal:12,gap:12},categoryItem:{width:108,alignItems:"center"},categoryIcon:{width:52,height:52,alignItems:"center",justifyContent:"center",borderRadius:26,backgroundColor:"#F2F6FF"},categoryIconActive:{borderWidth:2,borderColor:"#2874F0",backgroundColor:"#EAF2FF"},categoryEmoji:{fontSize:25},categoryName:{marginTop:8,color:"#2F343A",fontSize:10,lineHeight:13,fontWeight:"600",textAlign:"center"},categoryNameActive:{color:"#2874F0",fontWeight:"800"},productRow:{paddingHorizontal:12,gap:10},productCard:{width:145,padding:10,borderWidth:1,borderColor:"#E5E7EB",borderRadius:12,backgroundColor:"#FFFFFF"},productImage:{height:112,alignItems:"center",justifyContent:"center",overflow:"hidden",borderRadius:9,backgroundColor:"#F5F7FA"},productPhoto:{width:"100%",height:"100%",resizeMode:"contain"},productName:{marginTop:10,color:"#172337",fontSize:11,fontWeight:"800"},productSeller:{marginTop:3,color:"#6B7280",fontSize:8},productPrice:{marginTop:8,color:"#172337",fontSize:13,fontWeight:"900"},productUnit:{marginTop:2,color:"#16883F",fontSize:8,fontWeight:"700"},verified:{flexDirection:"row",alignItems:"center",gap:4,paddingVertical:5,paddingHorizontal:8,borderRadius:12,backgroundColor:"#E9F7EE"},verifiedText:{color:"#16883F",fontSize:8,fontWeight:"800"},error:{marginHorizontal:16,marginBottom:12,flexDirection:"row",alignItems:"center",gap:7,padding:11,borderRadius:9,backgroundColor:"#FEF1F0"},errorText:{flex:1,color:"#C5221F",fontSize:9},notice:{marginHorizontal:16,marginBottom:12,flexDirection:"row",alignItems:"center",gap:7,padding:11,borderRadius:9,backgroundColor:"#E9F7EE"},noticeText:{flex:1,color:"#16883F",fontSize:9},loading:{minHeight:250,alignItems:"center",justifyContent:"center"},loadingText:{marginTop:8,color:"#6B7280",fontSize:10},vendorGrid:{paddingHorizontal:12,gap:12},vendorCard:{overflow:"hidden",borderWidth:1,borderColor:"#E1E5EB",borderRadius:14,backgroundColor:"#FFFFFF",...shadow,shadowOpacity:.06},vendorCover:{height:76,alignItems:"center",justifyContent:"center",backgroundColor:"#EAF2FF"},vendorVerified:{position:"absolute",top:9,left:9,flexDirection:"row",alignItems:"center",gap:3,paddingVertical:4,paddingHorizontal:7,borderRadius:10,backgroundColor:"#FFFFFF"},vendorVerifiedText:{color:"#16883F",fontSize:7,fontWeight:"800"},vendorBody:{padding:13},vendorTop:{flexDirection:"row",alignItems:"center",gap:10},vendorLogo:{width:45,height:45,alignItems:"center",justifyContent:"center",overflow:"hidden",borderWidth:1,borderColor:"#E1E5EB",borderRadius:11,backgroundColor:"#FFFFFF"},vendorLogoImage:{width:"100%",height:"100%",resizeMode:"contain"},vendorInitial:{color:"#2874F0",fontSize:19,fontWeight:"900"},vendorCopy:{flex:1,minWidth:0},vendorName:{color:"#172337",fontSize:13,fontWeight:"900"},vendorCategory:{marginTop:3,color:"#6B7280",fontSize:9},location:{marginTop:11,flexDirection:"row",alignItems:"center",gap:5},locationText:{flex:1,color:"#6B7280",fontSize:9},productCount:{marginTop:7,color:"#16883F",fontSize:9,fontWeight:"700"},connect:{minHeight:40,marginTop:12,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,borderRadius:8,backgroundColor:"#2874F0"},connectDisabled:{borderWidth:1,borderColor:"#D5DBE5",backgroundColor:"#F3F5F9"},connectText:{color:"#FFFFFF",fontSize:10,fontWeight:"900"},connectTextDisabled:{color:"#5F6368"},empty:{minHeight:270,alignItems:"center",justifyContent:"center",padding:25},emptyTitle:{marginTop:11,color:"#172337",fontSize:15,fontWeight:"900"},emptyText:{marginTop:5,color:"#6B7280",fontSize:10,textAlign:"center"},emptyButton:{marginTop:15,paddingVertical:10,paddingHorizontal:14,borderRadius:8,backgroundColor:"#2874F0"},emptyButtonText:{color:"#FFFFFF",fontSize:9,fontWeight:"900"},
  vendorGrid:{paddingHorizontal:12,gap:10},
  vendorCard:{width:188,overflow:"hidden",borderWidth:1,borderColor:"#E1E5EB",borderRadius:12,backgroundColor:"#FFFFFF",...shadow,shadowOpacity:.05},
  vendorBody:{padding:12},
  vendorTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},
  vendorLogo:{width:42,height:42,alignItems:"center",justifyContent:"center",overflow:"hidden",borderWidth:1,borderColor:"#E1E5EB",borderRadius:10,backgroundColor:"#F7F9FC"},
  vendorVerified:{position:"relative",top:0,left:0,flexDirection:"row",alignItems:"center",gap:3,paddingVertical:4,paddingHorizontal:6,borderRadius:10,backgroundColor:"#E9F7EE"},
  vendorName:{marginTop:10,color:"#172337",fontSize:12,fontWeight:"900"},
  vendorCategory:{marginTop:3,color:"#6B7280",fontSize:8},
  location:{marginTop:9,flexDirection:"row",alignItems:"center",gap:4},
  productCount:{marginTop:6,color:"#16883F",fontSize:8,fontWeight:"700"},
  storeLink:{marginTop:9,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  storeLinkText:{color:"#2874F0",fontSize:9,fontWeight:"800"},
  connect:{minHeight:36,marginTop:9,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:5,borderRadius:7,backgroundColor:"#2874F0"},
  vendorTabs:{marginHorizontal:12,marginBottom:15,padding:4,flexDirection:"row",gap:5,borderRadius:11,backgroundColor:"#EAF2FF"},
  vendorTab:{flex:1,minHeight:40,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:6,borderRadius:8},
  vendorTabActive:{backgroundColor:"#2874F0"},
  vendorTabText:{color:"#2874F0",fontSize:10,fontWeight:"800"},
  vendorTabTextActive:{color:"#FFFFFF"},
  guestPage:{paddingBottom:94},
  guestNav:{height:72,flexDirection:"row",alignItems:"center",justifyContent:"space-around",borderTopWidth:1,borderTopColor:"#E1E5EB",backgroundColor:"#FFFFFF",...shadow,shadowOpacity:.08},
  guestNavItem:{flex:1,height:"100%",alignItems:"center",justifyContent:"center",gap:4},
  guestNavText:{color:"#6B7280",fontSize:8,fontWeight:"700"},
  guestNavTextActive:{color:"#2874F0",fontSize:8,fontWeight:"900"},
  headerLogoBlock:{flex:1,alignItems:"flex-start",justifyContent:"center"},
  logoCaption:{marginTop:-4,marginLeft:7,color:"#2874F0",fontSize:7,fontWeight:"900",letterSpacing:.8},
  monthCard:{marginHorizontal:12,marginBottom:2,padding:16,borderWidth:1,borderColor:"#D7E3FA",borderRadius:14,backgroundColor:"#FFFFFF",...shadow,shadowOpacity:.06},
  monthHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},
  monthEyebrow:{color:"#2874F0",fontSize:8,fontWeight:"900",letterSpacing:.8},
  monthTitle:{marginTop:4,color:"#172337",fontSize:15,fontWeight:"900"},
  monthIcon:{width:40,height:40,alignItems:"center",justifyContent:"center",borderRadius:12,backgroundColor:"#EAF2FF"},
  monthStats:{marginTop:15,flexDirection:"row",alignItems:"stretch"},
  monthStat:{flex:1},
  monthValue:{color:"#172337",fontSize:14,fontWeight:"900",textAlign:"center"},
  monthLabel:{marginTop:4,color:"#6B7280",fontSize:7,textAlign:"center"},
  monthDivider:{width:1,backgroundColor:"#E5E7EB"},
  miniSupplierRow:{paddingHorizontal:12,gap:9},
  miniSupplier:{width:126,alignItems:"center",padding:11,borderWidth:1,borderColor:"#E1E5EB",borderRadius:12,backgroundColor:"#FFFFFF"},
  rankBadge:{position:"absolute",top:7,left:7,zIndex:1,paddingVertical:3,paddingHorizontal:5,borderRadius:7,backgroundColor:"#E9F7EE"},
  rankText:{color:"#16883F",fontSize:7,fontWeight:"900"},
  miniLogo:{width:48,height:48,alignItems:"center",justifyContent:"center",overflow:"hidden",borderWidth:1,borderColor:"#E1E5EB",borderRadius:13,backgroundColor:"#F7F9FC"},
  miniInitial:{color:"#2874F0",fontSize:19,fontWeight:"900"},
  miniName:{width:"100%",marginTop:8,color:"#172337",fontSize:9,fontWeight:"900",textAlign:"center"},
  miniLocation:{width:"100%",marginTop:3,color:"#6B7280",fontSize:7,textAlign:"center"},
  valueBadge:{position:"absolute",top:6,left:6,zIndex:1,paddingVertical:3,paddingHorizontal:5,borderRadius:5,backgroundColor:"#FFF1E5"},
  valueBadgeText:{color:"#C45100",fontSize:6,fontWeight:"900"},
  valueSupplierList:{paddingHorizontal:12,gap:8},
  valueSupplier:{minHeight:64,flexDirection:"row",alignItems:"center",gap:10,padding:10,borderWidth:1,borderColor:"#E1E5EB",borderRadius:11,backgroundColor:"#FFFFFF"},
  valueSupplierCopy:{flex:1,minWidth:0},
  valueSupplierName:{color:"#172337",fontSize:11,fontWeight:"900"},
  valueSupplierFrom:{marginTop:4,color:"#16883F",fontSize:8,fontWeight:"700"},
});
