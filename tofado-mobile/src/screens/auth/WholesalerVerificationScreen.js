import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { colors, shadow } from "../../theme/colors";
import { friendlyError } from "../../utils/errors";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";

const steps = [
  { title: "Who should we contact?", copy: "Use the legal representative or authorized contact.", fields: [["name", "Full name", "person-outline"]] },
  { title: "Tell us about the business", copy: "Enter the company or shop name customers recognize.", fields: [["business_name", "Company / shop name", "business-outline"], ["business_category", "Business category", "grid-outline"], ["shop_type", "Company / shop type", "storefront-outline"]] },
  { title: "How can we reach you?", copy: "We may use this number during verification.", fields: [["phone", "Phone number", "call-outline"]] },
  { title: "Where is the business?", copy: "Provide the registered operating address.", fields: [["location", "City", "location-outline"], ["address", "Full business address", "map-outline"]] },
  { title: "Registration details", copy: "Enter the numbers exactly as they appear on official documents.", fields: [["tax_number", "GSTIN", "receipt-outline"], ["license_number", "Company registration number", "document-text-outline"]] },
  { title: "Add your company logo", copy: "A clear square logo helps retailers identify your business.", fields: [] },
  { title: "Review and apply", copy: "Confirm the information below before sending it for verification.", fields: [] },
];

const COMPANY_TYPES = [
  "Wholesaler",
  "Distributor",
  "Importer",
  "Manufacturer",
  "Exporter",
  "Stockist",
  "Trading company",
  "Cooperative / producer group",
  "Other",
];

export default function WholesalerVerificationScreen() {
  const { user, refreshUser, logout } = useAuth();
  const pending = user?.verification_status === "pending";
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: user?.name || "", business_name: user?.business_name || "", phone: user?.phone || "",
    location: user?.location || "", address: user?.address || "", tax_number: user?.tax_number || "",
    license_number: user?.license_number || "", business_category: user?.business_category || "", shop_type: user?.shop_type || "",
  });
  const [logoUrl, setLogoUrl] = useState(user?.logo_url || "");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [companyTypeOpen, setCompanyTypeOpen] = useState(false);
  const current = steps[step];
  const reviewRows = useMemo(() => Object.entries({
    "Contact person": form.name, "Company / shop": form.business_name, "Phone": form.phone,
    "Business type": [form.business_category, form.shop_type].filter(Boolean).join(" · "),
    "Address": [form.address, form.location].filter(Boolean).join(", "), "GSTIN": form.tax_number,
    "Registration": form.license_number,
  }), [form]);

  if (pending) return <PendingVerification user={user} logout={logout} refreshUser={refreshUser} />;

  const next = () => {
    if (current.fields.some(([key]) => !String(form[key] || "").trim())) {
      setError("Complete this step before continuing."); return;
    }
    if (step === 5 && !logoUrl) { setError("Upload your company logo to continue."); return; }
    setError(""); setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const uploadLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError("Photo access is required to select a company logo."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled || !result.assets?.length) return;
    try {
      setWorking(true); setError("");
      const asset = result.assets[0]; const data = new FormData();
      data.append("logo", { uri: asset.uri, name: asset.fileName || `logo-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg" });
      const response = await api.post("/profile/logo", data, { headers: { "Content-Type": "multipart/form-data" } });
      setLogoUrl(response.data?.logo_url || asset.uri);
    } catch (requestError) { setError(friendlyError(requestError, "Unable to upload the company logo.")); }
    finally { setWorking(false); }
  };

  const submit = async () => {
    try { setWorking(true); setError(""); await api.post("/wholesaler/verification", form); await refreshUser(); }
    catch (requestError) { setError(friendlyError(requestError, "Unable to submit the verification application.")); }
    finally { setWorking(false); }
  };

  return <SafeAreaView style={styles.safe}><KeyboardAwareScrollView contentContainerStyle={styles.page}>
    <View style={styles.brand}><View><Text style={styles.brandName}>Tofado</Text><Text style={styles.brandCaption}>Business verification</Text></View><Pressable onPress={logout} hitSlop={10}><Text style={styles.exit}>Sign out</Text></Pressable></View>
    <View style={styles.progressTrack}><View style={[styles.progress, { width: `${((step + 1) / steps.length) * 100}%` }]} /></View>
    <Text style={styles.stepLabel}>STEP {step + 1} OF {steps.length}</Text><Text style={styles.title}>{current.title}</Text><Text style={styles.copy}>{current.copy}</Text>
    {user?.verification_status === "rejected" && step === 0 ? <View style={styles.rejected}><Ionicons name="information-circle" size={18} color={colors.red} /><Text style={styles.rejectedText}>Your previous application needs changes. Review the information and apply again.</Text></View> : null}
    {error ? <View style={styles.alert}><Text style={styles.alertText}>{error}</Text></View> : null}
    <View style={styles.card}>
      {current.fields.map(([key, label, icon]) => <View key={key} style={styles.field}><Text style={styles.label}>{label}</Text>{key === "shop_type" ? <Pressable accessibilityRole="button" accessibilityLabel="Select company type" onPress={() => setCompanyTypeOpen(true)} style={styles.inputShell}><Ionicons name={icon} size={19} color={colors.muted} /><Text style={[styles.selectorText, !form.shop_type && styles.selectorPlaceholder]}>{form.shop_type || "Select company type"}</Text><Ionicons name="chevron-down" size={19} color={colors.muted} /></Pressable> : <View style={styles.inputShell}><Ionicons name={icon} size={19} color={colors.muted} /><TextInput value={form[key]} onChangeText={(value) => setForm((state) => ({ ...state, [key]: value }))} placeholder={label} placeholderTextColor={colors.muted} keyboardType={key === "phone" ? "phone-pad" : "default"} multiline={key === "address"} style={[styles.input, key === "address" && styles.multiline]} /></View>}</View>)}
      {step === 5 ? <View style={styles.logoArea}>{logoUrl ? <Image source={{ uri: logoUrl }} style={styles.logo} /> : <View style={styles.logoEmpty}><Ionicons name="image-outline" size={34} color={colors.primary} /></View>}<Pressable disabled={working} onPress={uploadLogo} style={styles.upload}><Ionicons name="cloud-upload-outline" size={18} color={colors.primaryDark} /><Text style={styles.uploadText}>{working ? "Uploading…" : logoUrl ? "Change logo" : "Choose logo"}</Text></Pressable><Text style={styles.hint}>JPG, PNG or WEBP · maximum 5 MB</Text></View> : null}
      {step === 6 ? <View>{logoUrl ? <Image source={{ uri: logoUrl }} style={styles.reviewLogo} /> : null}{reviewRows.map(([label, value]) => <View key={label} style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value}</Text></View>)}<View style={styles.consent}><Ionicons name="shield-checkmark" size={20} color={colors.primary} /><Text style={styles.consentText}>By applying, you confirm these business details are accurate and may be reviewed by Tofado.</Text></View></View> : null}
    </View>
    <View style={styles.actions}>{step > 0 ? <Pressable disabled={working} onPress={() => { setError(""); setStep((value) => value - 1); }} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.backText}>Back</Text></Pressable> : <View />}
      <Pressable disabled={working} onPress={step === steps.length - 1 ? submit : next} style={styles.next}>{working ? <ActivityIndicator size="small" color={colors.white} /> : <><Text style={styles.nextText}>{step === steps.length - 1 ? "Apply for verification" : "Continue"}</Text><Ionicons name="arrow-forward" size={18} color={colors.white} /></>}</Pressable></View>
  </KeyboardAwareScrollView><Modal visible={companyTypeOpen} transparent animationType="slide" onRequestClose={() => setCompanyTypeOpen(false)}><Pressable style={styles.modalOverlay} onPress={() => setCompanyTypeOpen(false)}><Pressable style={styles.modalSheet} onPress={() => {}}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Select company type</Text><Text style={styles.modalCopy}>Choose the option that best describes your business.</Text></View><Pressable onPress={() => setCompanyTypeOpen(false)} hitSlop={10}><Ionicons name="close" size={23} color={colors.ink} /></Pressable></View>{COMPANY_TYPES.map((type) => { const selected = form.shop_type === type; return <Pressable key={type} onPress={() => { setForm((state) => ({ ...state, shop_type: type })); setError(""); setCompanyTypeOpen(false); }} style={[styles.typeOption, selected && styles.typeOptionSelected]}><Text style={[styles.typeOptionText, selected && styles.typeOptionTextSelected]}>{type}</Text>{selected ? <Ionicons name="checkmark-circle" size={21} color={colors.primary} /> : null}</Pressable>; })}</Pressable></Pressable></Modal></SafeAreaView>;
}

function PendingVerification({ user, logout, refreshUser }) { const [checking,setChecking]=useState(false); const check=async()=>{try{setChecking(true);await refreshUser();}finally{setChecking(false);}}; return <SafeAreaView style={styles.safe}><View style={styles.pendingPage}><View style={styles.pendingIcon}><Ionicons name="time-outline" size={42} color={colors.primary} /></View><Text style={styles.stepLabel}>APPLICATION RECEIVED</Text><Text style={styles.pendingTitle}>We’re reviewing your business</Text><Text style={styles.copy}>We’ll verify {user.business_name || "your company"} and activate the wholesaler workspace after approval.</Text><View style={styles.pendingCard}><View style={styles.pendingRow}><Ionicons name="checkmark-circle" size={20} color="#16A34A" /><Text style={styles.pendingText}>Application submitted</Text></View><View style={styles.pendingRow}><Ionicons name="search-outline" size={20} color={colors.primary} /><Text style={styles.pendingText}>Business review in progress</Text></View><View style={styles.pendingRow}><Ionicons name="notifications-outline" size={20} color={colors.muted} /><Text style={styles.pendingText}>Approval notification</Text></View></View><Pressable disabled={checking} onPress={check} style={styles.next}>{checking?<ActivityIndicator size="small" color={colors.white}/>:<><Text style={styles.nextText}>Check approval status</Text><Ionicons name="refresh-outline" size={18} color={colors.white}/></>}</Pressable><Pressable onPress={logout} style={styles.pendingButton}><Text style={styles.backText}>Sign out</Text></Pressable></View></SafeAreaView>; }

const styles = StyleSheet.create({safe:{flex:1,backgroundColor:"#FAF8FF"},page:{width:"100%",maxWidth:560,alignSelf:"center",padding:22,paddingBottom:40},brand:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},brandName:{color:colors.primaryDark,fontSize:22,fontWeight:"900"},brandCaption:{marginTop:1,color:colors.muted,fontSize:9},exit:{color:colors.primaryDark,fontSize:10,fontWeight:"800"},progressTrack:{height:5,marginTop:26,overflow:"hidden",borderRadius:3,backgroundColor:"#E5DDF2"},progress:{height:"100%",borderRadius:3,backgroundColor:colors.primary},stepLabel:{marginTop:25,color:colors.primaryDark,fontSize:9,fontWeight:"900",letterSpacing:1.2},title:{marginTop:8,color:colors.ink,fontSize:29,lineHeight:35,fontWeight:"900",letterSpacing:-.7},copy:{marginTop:8,color:colors.body,fontSize:12,lineHeight:19},rejected:{marginTop:15,flexDirection:"row",gap:8,padding:11,borderRadius:12,backgroundColor:colors.redSoft},rejectedText:{flex:1,color:colors.red,fontSize:10,lineHeight:15},alert:{marginTop:14,padding:11,borderRadius:11,backgroundColor:colors.redSoft},alertText:{color:colors.red,fontSize:10},card:{marginTop:22,padding:18,borderWidth:1,borderColor:colors.border,borderRadius:23,backgroundColor:colors.white,...shadow},field:{marginBottom:15},label:{marginBottom:7,color:colors.ink,fontSize:11,fontWeight:"800"},inputShell:{minHeight:53,flexDirection:"row",alignItems:"center",gap:9,paddingHorizontal:13,borderWidth:1,borderColor:colors.borderStrong,borderRadius:14,backgroundColor:"#FCFBFE"},input:{flex:1,height:51,color:colors.ink,fontSize:14},selectorText:{flex:1,color:colors.ink,fontSize:14},selectorPlaceholder:{color:colors.muted},multiline:{minHeight:76,paddingVertical:12,textAlignVertical:"top"},logoArea:{alignItems:"center",paddingVertical:10},logoEmpty:{width:112,height:112,alignItems:"center",justifyContent:"center",borderRadius:32,backgroundColor:colors.primarySoft},logo:{width:112,height:112,borderRadius:32,resizeMode:"contain"},upload:{minHeight:45,marginTop:18,paddingHorizontal:20,flexDirection:"row",alignItems:"center",gap:7,borderWidth:1,borderColor:"#D9CCF2",borderRadius:14,backgroundColor:colors.primarySoft},uploadText:{color:colors.primaryDark,fontSize:11,fontWeight:"900"},hint:{marginTop:9,color:colors.muted,fontSize:9},reviewLogo:{width:72,height:72,alignSelf:"center",marginBottom:15,borderRadius:20,resizeMode:"contain"},reviewRow:{paddingVertical:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},reviewLabel:{color:colors.muted,fontSize:9,fontWeight:"700"},reviewValue:{marginTop:4,color:colors.ink,fontSize:12,fontWeight:"700"},consent:{marginTop:16,flexDirection:"row",alignItems:"flex-start",gap:8,padding:12,borderRadius:12,backgroundColor:colors.primarySoft},consentText:{flex:1,color:colors.body,fontSize:9,lineHeight:15},actions:{marginTop:20,flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},back:{minHeight:50,paddingHorizontal:17,flexDirection:"row",alignItems:"center",gap:7,borderWidth:1,borderColor:colors.border,borderRadius:15,backgroundColor:colors.white},backText:{color:colors.ink,fontSize:11,fontWeight:"800"},next:{minHeight:52,minWidth:150,paddingHorizontal:20,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,borderRadius:15,backgroundColor:colors.primary},nextText:{color:colors.white,fontSize:11,fontWeight:"900"},modalOverlay:{flex:1,justifyContent:"flex-end",backgroundColor:"rgba(25, 16, 38, 0.42)"},modalSheet:{maxHeight:"86%",paddingHorizontal:22,paddingTop:22,paddingBottom:30,borderTopLeftRadius:28,borderTopRightRadius:28,backgroundColor:colors.white},modalHeader:{marginBottom:13,flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:16},modalTitle:{color:colors.ink,fontSize:20,fontWeight:"900"},modalCopy:{marginTop:4,color:colors.body,fontSize:11},typeOption:{minHeight:49,paddingHorizontal:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},typeOptionSelected:{borderRadius:12,borderBottomWidth:0,backgroundColor:colors.primarySoft},typeOptionText:{color:colors.ink,fontSize:13,fontWeight:"700"},typeOptionTextSelected:{color:colors.primaryDark,fontWeight:"900"},pendingPage:{flex:1,width:"100%",maxWidth:520,alignSelf:"center",alignItems:"center",justifyContent:"center",padding:28},pendingIcon:{width:96,height:96,alignItems:"center",justifyContent:"center",borderRadius:32,backgroundColor:colors.primarySoft},pendingTitle:{marginTop:9,color:colors.ink,fontSize:27,lineHeight:34,fontWeight:"900",textAlign:"center"},pendingCard:{width:"100%",marginTop:28,padding:18,borderWidth:1,borderColor:colors.border,borderRadius:22,backgroundColor:colors.white,...shadow},pendingRow:{minHeight:48,flexDirection:"row",alignItems:"center",gap:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},pendingText:{color:colors.ink,fontSize:11,fontWeight:"700"},pendingButton:{minHeight:48,marginTop:20,paddingHorizontal:28,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.border,borderRadius:14,backgroundColor:colors.white}});
