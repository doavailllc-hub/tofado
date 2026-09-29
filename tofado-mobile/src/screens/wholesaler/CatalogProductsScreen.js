import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Linking, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";

import api from "../../services/api";
import { friendlyError } from "../../utils/errors";
import { money } from "../../utils/format";

export default function CatalogProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [processing, setProcessing] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const load = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError("");
      const [productResponse, catalogResponse] = await Promise.all([api.get("/wholesaler/catalog/products"), api.get("/wholesaler/catalog")]);
      setProducts(Array.isArray(productResponse.data) ? productResponse.data : productResponse.data?.products || []);
      setCatalog(catalogResponse.data || null);
    } catch (requestError) {
      setError(friendlyError(requestError, "Unable to load product catalog."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const publicUrl = catalog?.slug ? `https://merchant.tofado.com/catalog/${catalog.slug}` : "";
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => !term || [product.name, product.brand, product.sku, product.category_name].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [products, query]);
  const published = products.filter((product) => product.is_active).length;

  const share = async () => {
    if (!publicUrl) return;
    try {
      await Share.share({ title: catalog?.catalog_title || catalog?.business_name || "Product catalog", message: `Browse our wholesale product catalog and place your order:\n${publicUrl}`, url: publicUrl });
    } catch {
      setError("Unable to share the catalog.");
    }
  };
  const whatsapp = () => {
    if (!publicUrl) return;
    const text = encodeURIComponent(`${catalog?.catalog_title || catalog?.business_name || "Wholesale Product Catalog"}\nBrowse products and place your order here:\n${publicUrl}`);
    Linking.openURL(`https://wa.me/?text=${text}`);
  };
  const updateCover = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return setError("Photo access is required to update the cover image.");
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 7], quality: 0.85 });
      if (result.canceled || !result.assets?.[0]) return;
      setUploadingCover(true); setError("");
      const asset = result.assets[0];
      const form = new FormData();
      form.append("image", { uri: asset.uri, name: asset.fileName || `store-cover-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg" });
      const { data } = await api.post("/wholesaler/catalog/cover-image", form, { headers: { "Content-Type": "multipart/form-data" } });
      setCatalog((current) => ({ ...current, cover_image_url: data?.cover_image_url || asset.uri }));
    } catch (requestError) { setError(friendlyError(requestError, "Unable to update storefront cover.")); }
    finally { setUploadingCover(false); }
  };
  const toggle = async (product) => {
    try {
      setProcessing(product.id);
      const { data } = await api.patch(`/wholesaler/catalog/products/${product.id}/status`, { is_active: !product.is_active });
      setProducts((rows) => rows.map((item) => item.id === product.id ? { ...item, ...data } : item));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update product.");
    } finally {
      setProcessing(null);
    }
  };
  const remove = (product) => Alert.alert("Delete product", `Delete “${product.name}” from your catalog?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => {
    try { setProcessing(product.id); await api.delete(`/wholesaler/catalog/products/${product.id}`); setProducts((rows) => rows.filter((item) => item.id !== product.id)); }
    catch (requestError) { setError(requestError.response?.data?.message || "Unable to delete product."); }
    finally { setProcessing(null); }
  }}]);

  const header = <View>
    <View style={styles.header}><View><Text style={styles.eyebrow}>MERCHANT PRODUCTS</Text><Text style={styles.title}>Product catalog</Text><Text style={styles.subtitle}>Manage your mobile storefront</Text></View><Pressable accessibilityLabel="Add product" onPress={() => navigation.navigate("ProductEditor")} style={styles.add}><Ionicons name="add" size={25} color="#FFFFFF" /></Pressable></View>
    {!!error && <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#C5221F" /><Text style={styles.errorText}>{error}</Text></View>}
    <View style={styles.profileCard}>
      <View style={styles.coverWrap}>
        {catalog?.cover_image_url ? <Image source={{ uri: catalog.cover_image_url }} style={styles.cover} /> : <View style={styles.coverEmpty}><Ionicons name="images-outline" size={34} color="#1A73E8" /><Text style={styles.coverEmptyText}>Add a storefront cover</Text></View>}
        <Pressable disabled={uploadingCover} onPress={updateCover} style={styles.coverEdit}>{uploadingCover ? <ActivityIndicator size="small" color="#1F1F1F" /> : <Ionicons name="camera" size={16} color="#1F1F1F" />}<Text style={styles.coverEditText}>{catalog?.cover_image_url ? "Edit cover" : "Add cover"}</Text></Pressable>
      </View>
      <View style={styles.identity}>
        <View style={styles.logoWrap}>{catalog?.logo_url ? <Image source={{ uri: catalog.logo_url }} style={styles.logo} /> : <Text style={styles.logoLetter}>{String(catalog?.business_name || "T").charAt(0).toUpperCase()}</Text>}<View style={styles.verifiedMini}><Ionicons name="checkmark" size={13} color="#FFFFFF" /></View></View>
        <View style={styles.identityCopy}><View style={styles.nameRow}><Text numberOfLines={2} style={styles.businessName}>{catalog?.business_name || "Wholesale Store"}</Text><Ionicons name="checkmark-circle" size={20} color="#1A73E8" /></View><Text numberOfLines={2} style={styles.catalogTitle}>{catalog?.catalog_title || catalog?.title || "Product Catalog"}</Text><View style={styles.locationRow}><Ionicons name="location-outline" size={14} color="#5F6368" /><Text style={styles.location}>{catalog?.location || "Saudi Arabia"}</Text><Text style={styles.dotText}>·</Text><View style={styles.liveDot} /><Text style={styles.publicText}>Public store</Text></View></View>
      </View>
      {!!catalog?.catalog_description && <Text numberOfLines={3} style={styles.bio}>{catalog.catalog_description}</Text>}
      <View style={styles.profileStats}><Stat value={products.length} label="Products" /><Stat value={published} label="Published" /><Stat value={products.length - published} label="Hidden" /></View>
      <View style={styles.profileActions}><Pressable disabled={!publicUrl} onPress={() => Linking.openURL(publicUrl)} style={styles.primaryProfileAction}><Ionicons name="eye-outline" size={17} color="#FFFFFF" /><Text style={styles.primaryProfileText}>View storefront</Text></Pressable><Pressable disabled={!publicUrl} onPress={share} style={styles.roundAction}><Ionicons name="share-social-outline" size={19} color="#1A73E8" /></Pressable><Pressable disabled={!publicUrl} onPress={whatsapp} style={styles.roundAction}><Ionicons name="logo-whatsapp" size={19} color="#16A34A" /></Pressable></View>
      <View style={styles.profileTabs}><View style={styles.profileTabActive}><Text style={styles.profileTabActiveText}>Products</Text></View><View style={styles.profileTab}><Text style={styles.profileTabText}>About</Text></View><View style={styles.profileTab}><Text style={styles.profileTabText}>Store info</Text></View></View>
    </View>
    <View style={styles.search}><Ionicons name="search-outline" size={19} color="#5F6368" /><TextInput value={query} onChangeText={setQuery} placeholder="Search products, brands or SKU" placeholderTextColor="#5F6368" style={styles.searchInput} />{!!query && <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color="#5F6368" /></Pressable>}</View>
    <View style={styles.productsHead}><Text style={styles.productsTitle}>Your products</Text><Text style={styles.productsCount}>{visible.length} shown</Text></View>
  </View>;

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color="#1A73E8" /><Text style={styles.loadingText}>Loading catalog…</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={["top"]}><FlatList data={visible} numColumns={2} columnWrapperStyle={styles.columns} keyExtractor={(item, index) => String(item.id || index)} ListHeaderComponent={header} contentContainerStyle={styles.page} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#1A73E8" />} renderItem={({ item }) => <Product product={item} navigation={navigation} processing={processing} toggle={toggle} remove={remove} />} ListEmptyComponent={<Empty query={query} navigation={navigation} />} /></SafeAreaView>;
}

function Stat({ value, label }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Product({ product, navigation, processing, toggle, remove }) {
  return <View style={styles.product}><Pressable onPress={() => navigation.navigate("ProductEditor", { id: product.id })} style={styles.productImage}>{product.image_url ? <Image source={{ uri: product.image_url }} style={styles.image} /> : <Ionicons name="image-outline" size={31} color="#1A73E8" />}<View style={[styles.visibility, product.is_active ? styles.published : styles.hidden]}><Text style={[styles.visibilityText, product.is_active && styles.publishedText]}>{product.is_active ? "Published" : "Hidden"}</Text></View></Pressable><View style={styles.productBody}><Text style={styles.category}>{product.category_name || "Other"}</Text><Text numberOfLines={2} style={styles.name}>{product.name || `Product #${product.id}`}</Text><Text numberOfLines={1} style={styles.brand}>{[product.brand, product.pack_size].filter(Boolean).join(" · ") || product.sku || "Wholesale product"}</Text><Text style={styles.price}>{product.price_mode === "quote" ? "Price on request" : money(product.price)}</Text><Text style={styles.unit}>{product.price_mode === "quote" ? "Contact for pricing" : `per ${product.unit || "piece"}`}</Text><View style={styles.actions}><Action icon="pencil-outline" onPress={() => navigation.navigate("ProductEditor", { id: product.id })} /><Action icon={product.is_active ? "eye-off-outline" : "eye-outline"} loading={processing === product.id} onPress={() => toggle(product)} /><Action icon="trash-outline" red onPress={() => remove(product)} /></View></View></View>;
}
function Action({ icon, loading, onPress, red }) { return <Pressable onPress={onPress} style={styles.action}>{loading ? <ActivityIndicator size="small" color="#1A73E8" /> : <Ionicons name={icon} size={16} color={red ? "#C5221F" : "#1A73E8"} />}</Pressable>; }
function Empty({ query, navigation }) { return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="cube-outline" size={28} color="#1A73E8" /></View><Text style={styles.emptyTitle}>{query ? "No matching products" : "Your catalog is empty"}</Text><Text style={styles.emptyText}>{query ? "Try a different search." : "Add your first wholesale product with a photo, price and stock."}</Text>{!query && <Pressable onPress={() => navigation.navigate("ProductEditor")} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Add first product</Text></Pressable>}</View>; }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F8F9FA"},page:{padding:16,paddingBottom:35},loading:{flex:1,alignItems:"center",justifyContent:"center",gap:10},loadingText:{color:"#5F6368",fontSize:12},header:{minHeight:82,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},eyebrow:{color:"#1A73E8",fontSize:10,fontWeight:"700",letterSpacing:.8},title:{marginTop:4,color:"#1F1F1F",fontSize:26,fontWeight:"700",letterSpacing:-.5},subtitle:{marginTop:4,color:"#5F6368",fontSize:12},add:{width:48,height:48,alignItems:"center",justifyContent:"center",borderRadius:24,backgroundColor:"#1A73E8"},error:{marginVertical:10,flexDirection:"row",alignItems:"center",gap:8,padding:13,borderRadius:12,borderWidth:1,borderColor:"#FCE8E6",backgroundColor:"#FEF7F6"},errorText:{flex:1,color:"#C5221F",fontSize:12},
  profileCard:{marginTop:12,overflow:"hidden",borderWidth:1,borderColor:"#E8EAED",borderRadius:22,backgroundColor:"#FFFFFF",shadowColor:"#202124",shadowOpacity:.08,shadowRadius:16,shadowOffset:{width:0,height:4},elevation:2},coverWrap:{height:174,backgroundColor:"#E8F0FE"},cover:{width:"100%",height:"100%",resizeMode:"cover"},coverEmpty:{flex:1,alignItems:"center",justifyContent:"center",gap:7,backgroundColor:"#E8F0FE"},coverEmptyText:{color:"#1967D2",fontSize:11,fontWeight:"600"},coverEdit:{position:"absolute",right:12,bottom:12,minHeight:36,paddingHorizontal:12,flexDirection:"row",alignItems:"center",gap:6,borderRadius:18,backgroundColor:"rgba(255,255,255,.94)"},coverEditText:{color:"#1F1F1F",fontSize:10,fontWeight:"700"},identity:{paddingHorizontal:16,paddingBottom:8,flexDirection:"row",alignItems:"flex-end",gap:12},logoWrap:{width:88,height:88,marginTop:-38,alignItems:"center",justifyContent:"center",borderWidth:4,borderColor:"#FFFFFF",borderRadius:44,backgroundColor:"#E8F0FE",shadowColor:"#202124",shadowOpacity:.12,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:3},logo:{width:"100%",height:"100%",borderRadius:40,resizeMode:"cover"},logoLetter:{color:"#1967D2",fontSize:34,fontWeight:"700"},verifiedMini:{position:"absolute",right:-1,bottom:4,width:24,height:24,alignItems:"center",justifyContent:"center",borderWidth:3,borderColor:"#FFFFFF",borderRadius:12,backgroundColor:"#1A73E8"},identityCopy:{flex:1,paddingTop:10,paddingBottom:4},nameRow:{flexDirection:"row",alignItems:"center",gap:5},businessName:{flexShrink:1,color:"#1F1F1F",fontSize:20,lineHeight:24,fontWeight:"800",letterSpacing:-.4},catalogTitle:{marginTop:3,color:"#5F6368",fontSize:10,lineHeight:14},locationRow:{marginTop:6,flexDirection:"row",alignItems:"center",gap:3},location:{maxWidth:100,color:"#5F6368",fontSize:9},dotText:{color:"#9AA0A6",fontSize:10},liveDot:{width:6,height:6,borderRadius:3,backgroundColor:"#16A34A"},publicText:{color:"#137333",fontSize:9,fontWeight:"600"},bio:{paddingHorizontal:16,paddingVertical:8,color:"#444746",fontSize:11,lineHeight:16},profileStats:{marginHorizontal:16,marginTop:8,flexDirection:"row",overflow:"hidden",borderTopWidth:1,borderBottomWidth:1,borderColor:"#E8EAED"},stat:{flex:1,alignItems:"center",paddingVertical:12,borderRightWidth:1,borderRightColor:"#E8EAED"},statValue:{color:"#1F1F1F",fontSize:17,fontWeight:"700"},statLabel:{marginTop:2,color:"#5F6368",fontSize:9},profileActions:{padding:14,flexDirection:"row",gap:8},primaryProfileAction:{flex:1,minHeight:43,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderRadius:22,backgroundColor:"#1A73E8"},primaryProfileText:{color:"#FFFFFF",fontSize:11,fontWeight:"700"},roundAction:{width:44,height:44,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#DADCE0",borderRadius:22,backgroundColor:"#FFFFFF"},profileTabs:{height:48,paddingHorizontal:10,flexDirection:"row",alignItems:"stretch",borderTopWidth:1,borderTopColor:"#E8EAED"},profileTabActive:{flex:1,alignItems:"center",justifyContent:"center",borderBottomWidth:3,borderBottomColor:"#1A73E8"},profileTab:{flex:1,alignItems:"center",justifyContent:"center"},profileTabActiveText:{color:"#1A73E8",fontSize:11,fontWeight:"700"},profileTabText:{color:"#5F6368",fontSize:11,fontWeight:"600"},
  search:{height:52,marginTop:18,flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:14,borderWidth:1,borderColor:"#DADCE0",borderRadius:26,backgroundColor:"#FFFFFF"},searchInput:{flex:1,height:50,paddingVertical:0,color:"#1F1F1F",fontSize:14},productsHead:{marginTop:22,marginBottom:10,flexDirection:"row",justifyContent:"space-between",paddingHorizontal:4},productsTitle:{color:"#1F1F1F",fontSize:15,fontWeight:"700"},productsCount:{color:"#5F6368",fontSize:11},columns:{gap:10,marginBottom:10},product:{flex:1,overflow:"hidden",borderWidth:1,borderColor:"#E8EAED",borderRadius:16,backgroundColor:"#FFFFFF"},productImage:{height:125,alignItems:"center",justifyContent:"center",backgroundColor:"#F1F3F4"},image:{width:"100%",height:"100%"},visibility:{position:"absolute",left:8,top:8,paddingVertical:5,paddingHorizontal:8,borderRadius:10,backgroundColor:"#F1F3F4"},published:{backgroundColor:"#E6F4EA"},hidden:{backgroundColor:"#F1F3F4"},visibilityText:{color:"#5F6368",fontSize:8,fontWeight:"700"},publishedText:{color:"#137333"},productBody:{padding:12},category:{color:"#1A73E8",fontSize:8,fontWeight:"700",textTransform:"uppercase"},name:{minHeight:34,marginTop:5,color:"#1F1F1F",fontSize:12,lineHeight:16,fontWeight:"600"},brand:{marginTop:3,color:"#5F6368",fontSize:10},price:{marginTop:10,color:"#1F1F1F",fontSize:13,fontWeight:"700"},unit:{marginTop:2,color:"#5F6368",fontSize:9},actions:{marginTop:11,flexDirection:"row",gap:6},action:{flex:1,height:34,alignItems:"center",justifyContent:"center",borderRadius:17,backgroundColor:"#F1F3F4"},empty:{alignItems:"center",paddingVertical:50,paddingHorizontal:30},emptyIcon:{width:58,height:58,alignItems:"center",justifyContent:"center",borderRadius:29,backgroundColor:"#E8F0FE"},emptyTitle:{marginTop:13,color:"#1F1F1F",fontSize:16,fontWeight:"700"},emptyText:{marginTop:6,color:"#5F6368",fontSize:12,lineHeight:17,textAlign:"center"},emptyButton:{marginTop:18,paddingVertical:12,paddingHorizontal:18,borderRadius:22,backgroundColor:"#1A73E8"},emptyButtonText:{color:"#FFFFFF",fontSize:12,fontWeight:"700"}
});
