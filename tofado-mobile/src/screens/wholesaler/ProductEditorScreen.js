import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import api from "../../services/api";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";

const CATEGORIES = ["Rice & Grains", "Flour & Baking", "Cooking Oil", "Pulses & Legumes", "Spices & Seasoning", "Beverages", "Dairy Products", "Frozen Foods", "Canned Foods", "Snacks & Confectionery", "Fresh Produce", "Meat & Poultry", "Cleaning & Household", "Personal Care", "Other"];
const UNITS = ["piece", "pack", "box", "carton", "case", "bag", "bottle", "can", "jar", "tray", "bundle", "kg", "gram", "litre"];
const EMPTY = { name:"", sku:"", brand:"", category_name:"", description:"", image_url:"", image_key:"", unit:"piece", pack_size:"", minimum_order:"1", price_mode:"fixed", price:"", stock_quantity:"", is_active:true };
const STEPS = [
  { title:"Product photo", caption:"Add a clear photo for your catalog" },
  { title:"Product details", caption:"Name, category and description" },
  { title:"Pricing & stock", caption:"Price, quantity and visibility" },
];

function Field({ label, multiline, ...props }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#5F6368" style={[styles.input, multiline && styles.textarea]} /></View>; }
function Section({ icon, title, caption, children }) { return <View style={styles.card}><View style={styles.sectionHeader}><View style={styles.sectionIcon}><Ionicons name={icon} size={18} color="#1A73E8" /></View><View><Text style={styles.section}>{title}</Text><Text style={styles.sectionCaption}>{caption}</Text></View></View>{children}</View>; }

export default function ProductEditorScreen({ navigation, route }) {
  const id = route.params?.id;
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const update = (key, value) => { setError(""); setForm((current) => ({ ...current, [key]: value })); };

  useEffect(() => {
    if (!id) return;
    api.get(`/wholesaler/catalog/products/${id}`).then(({ data }) => setForm({ ...EMPTY, ...data, minimum_order: String(data.minimum_order || 1), price: data.price == null ? "" : String(data.price), stock_quantity: data.stock_quantity == null ? "" : String(data.stock_quantity), is_active: Boolean(data.is_active) })).catch((requestError) => setError(requestError.response?.data?.message || "Unable to load product.")).finally(() => setLoading(false));
  }, [id]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError("Allow photo access to select a product image."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes:["images"], allowsEditing:true, aspect:[4,3], quality:.82 });
    if (result.canceled) return;
    try {
      setUploading(true); setError("");
      const asset = result.assets[0], body = new FormData();
      body.append("image", { uri:asset.uri, name:asset.fileName || `product-${Date.now()}.jpg`, type:asset.mimeType || "image/jpeg" });
      const { data } = await api.post("/wholesaler/catalog/product-image", body, { headers:{ "Content-Type":"multipart/form-data" } });
      setForm((current) => ({ ...current, image_url:data.image_url || data.url || "", image_key:data.image_key || data.key || "" }));
    } catch (requestError) { setError(requestError.response?.data?.message || "Unable to upload product image."); }
    finally { setUploading(false); }
  };

  const save = async () => {
    if (!form.name.trim()) { setError("Product name is required."); return; }
    if (!form.category_name) { setError("Select a product category."); return; }
    if (form.price_mode === "fixed" && (form.price === "" || Number(form.price) < 0)) { setError("Enter a valid product price."); return; }
    const payload = { ...form, name:form.name.trim(), sku:form.sku.trim() || null, brand:form.brand.trim() || null, description:form.description.trim() || null, pack_size:form.pack_size.trim() || null, minimum_order:Number(form.minimum_order || 1), price:form.price_mode === "quote" ? null : Number(form.price || 0), stock_quantity:form.stock_quantity === "" ? null : Number(form.stock_quantity), is_active:Boolean(form.is_active) };
    try { setSaving(true); setError(""); id ? await api.put(`/wholesaler/catalog/products/${id}`, payload) : await api.post("/wholesaler/catalog/products", payload); navigation.goBack(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Unable to save product."); }
    finally { setSaving(false); }
  };

  const continueToNextStep = () => {
    if (step === 1 && !form.name.trim()) { setError("Product name is required."); return; }
    if (step === 1 && !form.category_name) { setError("Select a product category."); return; }
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  if (loading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color="#1A73E8" /></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe} edges={["top"]}><KeyboardAwareScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable accessibilityLabel={step ? "Previous step" : "Go back"} onPress={() => step ? setStep((current) => current - 1) : navigation.goBack()} style={styles.back}><Ionicons name="arrow-back" size={20} color="#1F1F1F" /></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>{id ? "EDIT PRODUCT" : "NEW PRODUCT"} · STEP {step + 1} OF {STEPS.length}</Text><Text style={styles.title}>{STEPS[step].title}</Text><Text style={styles.subtitle}>{STEPS[step].caption}</Text></View></View>
    <View style={styles.progressTrack}><View style={[styles.progress, { width:`${((step + 1) / STEPS.length) * 100}%` }]} /></View>
    {!!error && <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#C5221F" /><Text style={styles.errorText}>{error}</Text></View>}
    {step === 0 ? <Section icon="image-outline" title="Product photo" caption="A photo is recommended but optional"><Pressable onPress={pickImage} style={styles.imageBox}>{form.image_url ? <Image source={{ uri:form.image_url }} style={styles.image} /> : <View style={styles.imageEmpty}><View style={styles.imageIcon}><Ionicons name="image-outline" size={27} color="#1A73E8" /></View><Text style={styles.imageText}>Add product photo</Text><Text style={styles.imageHint}>Tap to upload an image</Text></View>}<View style={styles.imageAction}>{uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="camera" size={17} color="#FFFFFF" />}</View></Pressable></Section> : null}
    {step === 1 ? <Section icon="cube-outline" title="Product details" caption="Name, category and description"><Field label="Product name *" value={form.name} onChangeText={(value) => update("name", value)} placeholder="e.g. Premium Basmati Rice" /><View style={styles.two}><Field label="SKU" value={form.sku} onChangeText={(value) => update("sku", value)} placeholder="SKU-001" /><Field label="Brand" value={form.brand} onChangeText={(value) => update("brand", value)} placeholder="Brand" /></View><Text style={styles.label}>Category *</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{CATEGORIES.map((item) => <Pressable key={item} onPress={() => update("category_name", item)} style={[styles.chip, form.category_name === item && styles.chipActive]}><Text style={[styles.chipText, form.category_name === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView><Field label="Description" value={form.description} onChangeText={(value) => update("description", value)} multiline placeholder="Quality, origin, packing and product details" /></Section> : null}
    {step === 2 ? <Section icon="cash-outline" title="Pricing & stock" caption="Price, quantity and storefront visibility"><View style={styles.modeRow}>{["fixed", "quote"].map((item) => <Pressable key={item} onPress={() => update("price_mode", item)} style={[styles.mode, form.price_mode === item && styles.modeActive]}><Text style={[styles.modeText, form.price_mode === item && styles.modeTextActive]}>{item === "fixed" ? "Fixed price" : "Price on request"}</Text></Pressable>)}</View>{form.price_mode === "fixed" && <Field label="Price (INR) *" value={form.price} onChangeText={(value) => update("price", value)} keyboardType="decimal-pad" placeholder="0.00" />}<Text style={styles.label}>Selling unit</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{UNITS.map((item) => <Pressable key={item} onPress={() => update("unit", item)} style={[styles.chip, form.unit === item && styles.chipActive]}><Text style={[styles.chipText, form.unit === item && styles.chipTextActive]}>{item}</Text></Pressable>)}</ScrollView><View style={styles.two}><Field label="Pack size" value={form.pack_size} onChangeText={(value) => update("pack_size", value)} placeholder="e.g. 12 x 1kg" /><Field label="Minimum order" value={form.minimum_order} onChangeText={(value) => update("minimum_order", value)} keyboardType="number-pad" placeholder="1" /></View><Field label="Stock quantity" value={form.stock_quantity} onChangeText={(value) => update("stock_quantity", value)} keyboardType="number-pad" placeholder="Leave blank if unlimited" /><View style={styles.publish}><View style={styles.publishIcon}><Ionicons name="storefront-outline" size={18} color="#1A73E8" /></View><View style={styles.publishCopy}><Text style={styles.publishTitle}>Publish product</Text><Text style={styles.publishSub}>Show in your public catalog</Text></View><Switch value={form.is_active} onValueChange={(value) => update("is_active", value)} trackColor={{ false:"#DADCE0", true:"#AECBFA" }} thumbColor={form.is_active ? "#1A73E8" : "#FFFFFF"} /></View></Section> : null}
    <View style={styles.navigation}>{step > 0 ? <Pressable disabled={saving || uploading} onPress={() => { setError(""); setStep((current) => current - 1); }} style={styles.previous}><Ionicons name="arrow-back" size={18} color="#1F1F1F" /><Text style={styles.previousText}>Back</Text></Pressable> : <View />}{step < STEPS.length - 1 ? <Pressable disabled={uploading} onPress={continueToNextStep} style={[styles.save, uploading && styles.disabled]}><Text style={styles.saveText}>Continue</Text><Ionicons name="arrow-forward" size={19} color="#FFFFFF" /></Pressable> : <Pressable disabled={saving || uploading} onPress={save} style={[styles.save, (saving || uploading) && styles.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark" size={20} color="#FFFFFF" /><Text style={styles.saveText}>{id ? "Update product" : "Create product"}</Text></>}</Pressable>}</View>
  </KeyboardAwareScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FFFFFF"},page:{flexGrow:1,padding:16,paddingBottom:35},loading:{flex:1,alignItems:"center",justifyContent:"center"},header:{minHeight:76,flexDirection:"row",alignItems:"center",gap:12},back:{width:42,height:42,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#DADCE0",borderRadius:21,backgroundColor:"#FFFFFF"},headerCopy:{flex:1},eyebrow:{color:"#1A73E8",fontSize:10,fontWeight:"700",letterSpacing:.8},title:{marginTop:3,color:"#1F1F1F",fontSize:24,fontWeight:"700",letterSpacing:-.4},subtitle:{marginTop:3,color:"#5F6368",fontSize:12},progressTrack:{height:5,marginTop:12,overflow:"hidden",borderRadius:3,backgroundColor:"#E8EAED"},progress:{height:"100%",borderRadius:3,backgroundColor:"#1A73E8"},imageBox:{height:250,overflow:"hidden",borderWidth:1,borderColor:"#E8EAED",borderRadius:20,backgroundColor:"#F8F9FA"},image:{width:"100%",height:"100%"},imageEmpty:{flex:1,alignItems:"center",justifyContent:"center",gap:6},imageIcon:{width:54,height:54,alignItems:"center",justifyContent:"center",borderRadius:27,backgroundColor:"#E8F0FE"},imageText:{marginTop:4,color:"#1F1F1F",fontSize:14,fontWeight:"600"},imageHint:{color:"#5F6368",fontSize:12},imageAction:{position:"absolute",right:13,bottom:13,width:42,height:42,alignItems:"center",justifyContent:"center",borderRadius:21,backgroundColor:"#1A73E8"},error:{marginTop:12,flexDirection:"row",alignItems:"center",gap:8,padding:13,borderWidth:1,borderColor:"#FCE8E6",borderRadius:12,backgroundColor:"#FEF7F6"},errorText:{flex:1,color:"#C5221F",fontSize:12},card:{marginTop:16,padding:16,borderWidth:1,borderColor:"#E8EAED",borderRadius:16,backgroundColor:"#FFFFFF"},sectionHeader:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:17},sectionIcon:{width:36,height:36,alignItems:"center",justifyContent:"center",borderRadius:18,backgroundColor:"#E8F0FE"},section:{color:"#1F1F1F",fontSize:15,fontWeight:"700"},sectionCaption:{marginTop:2,color:"#5F6368",fontSize:11},field:{flex:1,marginBottom:14},label:{marginBottom:7,color:"#3C4043",fontSize:11,fontWeight:"600"},input:{height:50,paddingHorizontal:13,borderWidth:1,borderColor:"#DADCE0",borderRadius:12,color:"#1F1F1F",fontSize:13,backgroundColor:"#FFFFFF"},textarea:{height:92,paddingTop:12,textAlignVertical:"top"},two:{flexDirection:"row",gap:10},chips:{gap:8,paddingBottom:14},chip:{paddingVertical:9,paddingHorizontal:12,borderWidth:1,borderColor:"#DADCE0",borderRadius:18,backgroundColor:"#FFFFFF"},chipActive:{borderColor:"#1A73E8",backgroundColor:"#E8F0FE"},chipText:{color:"#5F6368",fontSize:11,fontWeight:"600"},chipTextActive:{color:"#1A73E8"},modeRow:{flexDirection:"row",gap:8,marginBottom:15},mode:{flex:1,minHeight:44,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#DADCE0",borderRadius:12},modeActive:{borderColor:"#1A73E8",backgroundColor:"#E8F0FE"},modeText:{color:"#5F6368",fontSize:11,fontWeight:"600"},modeTextActive:{color:"#1A73E8"},publish:{minHeight:62,flexDirection:"row",alignItems:"center",gap:10,paddingTop:6,borderTopWidth:1,borderTopColor:"#F1F3F4"},publishIcon:{width:38,height:38,alignItems:"center",justifyContent:"center",borderRadius:19,backgroundColor:"#F1F3F4"},publishCopy:{flex:1},publishTitle:{color:"#1F1F1F",fontSize:13,fontWeight:"600"},publishSub:{marginTop:3,color:"#5F6368",fontSize:11},navigation:{marginTop:"auto",paddingTop:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},previous:{minHeight:54,paddingHorizontal:20,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,borderWidth:1,borderColor:"#DADCE0",borderRadius:27,backgroundColor:"#FFFFFF"},previousText:{color:"#1F1F1F",fontSize:13,fontWeight:"700"},save:{minHeight:54,minWidth:155,paddingHorizontal:22,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,borderRadius:27,backgroundColor:"#1A73E8"},saveText:{color:"#FFFFFF",fontSize:14,fontWeight:"700"},disabled:{opacity:.55}
});
