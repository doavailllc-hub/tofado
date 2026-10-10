import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";
import { colors } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { useAuth } from "../../context/AuthContext";
import { clearOrderDraft, loadOrderDraft, saveOrderDraft } from "../../services/orderDrafts";

const newItem = () => ({ key: `${Date.now()}-${Math.random()}`, product_name: "", quantity: "1", unit: "piece", notes: "" });
const STEPS = [
  { title:"Choose wholesaler", subtitle:"Select an accepted supplier for this order." },
  { title:"Add products", subtitle:"List the products and quantities you need." },
  { title:"Delivery details", subtitle:"Tell the wholesaler where and when to deliver." },
  { title:"Review order", subtitle:"Confirm everything before sending your purchase order." },
];

export default function CreateOrderScreen({ navigation, route }) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [wholesalerId, setWholesalerId] = useState(route.params?.wholesalerId || null);
  const [address, setAddress] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([newItem()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const latestDraft = useRef(null);
  const submitted = useRef(false);
  const skipInitialDraftWrite = useRef(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/retailer/wholesalers");
      const list = Array.isArray(data) ? data : data?.wholesalers || [];
      setVendors(list);
      setWholesalerId((current) => current || list[0]?.id || null);
    } catch (e) {
      setError(e?.response?.data?.message || "Unable to load connected wholesalers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const draft = await loadOrderDraft(user?.id);
        if (!active || !draft) return;
        setWholesalerId(route.params?.wholesalerId || draft.wholesalerId);
        setAddress(draft.address);
        setRequiredDate(draft.requiredDate);
        setNotes(draft.notes);
        setItems(draft.items.length ? draft.items : [newItem()]);
        setStep(draft.step);
        setDraftStatus("Draft restored from this device");
      } catch {
        if (active) setDraftStatus("Draft recovery is temporarily unavailable");
      } finally {
        if (active) setDraftReady(true);
      }
    })();
    return () => { active = false; };
  }, [route.params?.wholesalerId, user?.id]);

  useEffect(() => {
    if (route.params?.wholesalerId) {
      setWholesalerId(route.params.wholesalerId);
    }
  }, [route.params?.wholesalerId]);

  useEffect(() => {
    if (!draftReady || !user?.id) return;
    const draft = { wholesalerId, address, requiredDate, notes, items, step };
    latestDraft.current = draft;
    if (skipInitialDraftWrite.current) {
      skipInitialDraftWrite.current = false;
      return;
    }
    setDraftStatus("Saving draft…");
    const timer = setTimeout(async () => {
      try {
        const saved = await saveOrderDraft(user.id, draft);
        if (!submitted.current) setDraftStatus(saved ? "Draft saved on this device" : "");
      } catch {
        if (!submitted.current) setDraftStatus("Draft couldn't be saved");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [address, draftReady, items, notes, requiredDate, step, user?.id, wholesalerId]);

  useEffect(() => {
    const persist = () => {
      if (!submitted.current && latestDraft.current && user?.id) {
        saveOrderDraft(user.id, latestDraft.current).catch(() => {});
      }
    };
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") persist(); });
    return () => { subscription.remove(); persist(); };
  }, [user?.id]);

  const updateItem = (key, field, value) =>
    setItems((current) => current.map((x) => x.key === key ? { ...x, [field]: value } : x));

  const cleanItems = () => items.map((x) => ({
    product_name:x.product_name.trim(), quantity:Number(x.quantity), unit:x.unit.trim() || "piece", notes:x.notes.trim() || null,
  })).filter((x) => x.product_name && x.quantity > 0);

  const next = () => {
    if (step === 0 && !wholesalerId) { setError("Select a connected wholesaler to continue."); return; }
    if (step === 1 && !cleanItems().length) { setError("Add at least one product with a valid quantity."); return; }
    if (step === 2 && !address.trim()) { setError("Enter the delivery address to continue."); return; }
    setError(""); setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const submit = async () => {
    try {
      setSaving(true);
      setError("");
      const clean = cleanItems();

      if (!wholesalerId || !address.trim() || !clean.length) {
        setError("Wholesaler, delivery address, and at least one product are required.");
        return;
      }

      const { data } = await api.post("/retailer/orders", {
        wholesaler_id: wholesalerId,
        delivery_address: address.trim(),
        required_date: requiredDate.trim() || null,
        notes: notes.trim() || null,
        items: clean,
      });
      submitted.current = true;
      await clearOrderDraft(user?.id);
      navigation.replace("RetailerOrderDetails", { id: data.id });
    } catch (e) {
      setError(e?.response?.data?.message || "Unable to create order.");
    } finally {
      setSaving(false);
    }
  };

  const discardDraft = async () => {
    submitted.current = true;
    await clearOrderDraft(user?.id);
    latestDraft.current = null;
    setWholesalerId(route.params?.wholesalerId || vendors[0]?.id || null);
    setAddress(""); setRequiredDate(""); setNotes(""); setItems([newItem()]); setStep(0); setError(""); setDraftStatus("");
    submitted.current = false;
  };

  if (loading || !draftReady) return <SafeAreaView style={styles.safe}><View style={styles.loading}><ActivityIndicator color={colors.primary} /></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.page}>
        <MobileHeader eyebrow={`Purchase order · Step ${step + 1} of ${STEPS.length}`} title={STEPS[step].title} subtitle={STEPS[step].subtitle} onBack={() => step ? setStep((current) => current - 1) : navigation.goBack()} />
        <View style={styles.progressTrack}><View style={[styles.progress, { width:`${((step + 1) / STEPS.length) * 100}%` }]} /></View>
        {!!draftStatus && <View style={[styles.draftBanner, draftStatus.includes("couldn't") && styles.draftBannerError]}><View style={styles.draftCopy}><Ionicons name={draftStatus.includes("restored") ? "refresh-circle-outline" : "cloud-done-outline"} size={18} color={draftStatus.includes("couldn't") ? colors.red : colors.primary} /><Text style={[styles.draftText, draftStatus.includes("couldn't") && styles.draftTextError]}>{draftStatus}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Discard saved order draft" onPress={discardDraft}><Text style={styles.discardText}>Discard</Text></Pressable></View>}
        {!!error && <Text style={styles.error}>{error}</Text>}

        {step === 0 ? <><Text style={styles.label}>Wholesaler</Text>
        <View style={styles.vendorList}>
          {vendors.map((v) => (
            <Pressable key={v.id} onPress={() => setWholesalerId(v.id)} style={[styles.vendor, Number(wholesalerId) === Number(v.id) && styles.vendorSelected]}>
              <Ionicons name="business-outline" size={18} color={colors.primary} />
              <Text style={styles.vendorText}>{v.business_name}</Text>
              {Number(wholesalerId) === Number(v.id) && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
        {!vendors.length && (
          <Text style={styles.helpText}>
            Connect with a wholesaler from the Vendors tab before creating an order.
          </Text>
        )}</> : null}

        {step === 1 ? <><View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Products</Text>
          <Pressable style={styles.add} onPress={() => setItems((current) => [...current, newItem()])}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addText}>Add item</Text>
          </Pressable>
        </View>

        <View style={styles.items}>
          {items.map((item, index) => (
            <View style={styles.item} key={item.key}>
              <View style={styles.itemHead}>
                <Text style={styles.itemNo}>Item {index + 1}</Text>
                {items.length > 1 && <Pressable onPress={() => setItems((current) => current.filter((x) => x.key !== item.key))}><Ionicons name="trash-outline" size={17} color={colors.red} /></Pressable>}
              </View>
              <TextInput value={item.product_name} onChangeText={(v) => updateItem(item.key, "product_name", v)} placeholder="Product name" placeholderTextColor={colors.muted} style={styles.input} />
              <View style={styles.two}>
                <TextInput value={item.quantity} onChangeText={(v) => updateItem(item.key, "quantity", v)} keyboardType="decimal-pad" placeholder="Qty" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} />
                <TextInput value={item.unit} onChangeText={(v) => updateItem(item.key, "unit", v)} placeholder="Unit" placeholderTextColor={colors.muted} style={[styles.input, styles.half]} />
              </View>
              <TextInput value={item.notes} onChangeText={(v) => updateItem(item.key, "notes", v)} placeholder="Item notes" placeholderTextColor={colors.muted} style={styles.input} />
            </View>
          ))}
        </View></> : null}

        {step === 2 ? <View style={styles.deliveryCard}><Text style={styles.label}>Delivery address *</Text><TextInput value={address} onChangeText={(value) => { setAddress(value); setError(""); }} multiline placeholder="Shop name, street, area, city and postcode" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} /><Text style={styles.label}>Required date</Text><TextInput value={requiredDate} onChangeText={setRequiredDate} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={colors.muted} style={styles.input} /><Text style={styles.label}>Order notes</Text><TextInput value={notes} onChangeText={setNotes} multiline placeholder="Delivery instructions or other information" placeholderTextColor={colors.muted} style={[styles.input, styles.textarea]} /></View> : null}

        {step === 3 ? <View style={styles.reviewCard}><ReviewRow label="Wholesaler" value={vendors.find((vendor) => Number(vendor.id) === Number(wholesalerId))?.business_name || route.params?.wholesalerName || "Selected wholesaler"} /><ReviewRow label="Products" value={`${cleanItems().length} item${cleanItems().length === 1 ? "" : "s"}`} />{cleanItems().map((item, index) => <View key={`${item.product_name}-${index}`} style={styles.reviewItem}><View style={styles.reviewNumber}><Text style={styles.reviewNumberText}>{index + 1}</Text></View><View style={styles.reviewItemCopy}><Text style={styles.reviewItemName}>{item.product_name}</Text><Text style={styles.reviewItemMeta}>{item.quantity} {item.unit}{item.notes ? ` · ${item.notes}` : ""}</Text></View></View>)}<ReviewRow label="Delivery address" value={address} /><ReviewRow label="Required date" value={requiredDate || "Not specified"} />{notes ? <ReviewRow label="Order notes" value={notes} /> : null}<View style={styles.confirmation}><Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} /><Text style={styles.confirmationText}>The wholesaler will receive this purchase order and can confirm product availability.</Text></View></View> : null}

        <View style={styles.actions}>{step > 0 ? <Pressable disabled={saving} onPress={() => { setError(""); setStep((current) => current - 1); }} style={styles.previous}><Ionicons name="arrow-back" size={18} color={colors.ink} /><Text style={styles.previousText}>Back</Text></Pressable> : <View />}{step < STEPS.length - 1 ? <Pressable disabled={!vendors.length} onPress={next} style={[styles.submit, !vendors.length && styles.disabled]}><Text style={styles.submitText}>Continue</Text><Ionicons name="arrow-forward" size={18} color={colors.white} /></Pressable> : <Pressable disabled={saving || !vendors.length} style={[styles.submit, (saving || !vendors.length) && styles.disabled]} onPress={submit}>{saving ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="send-outline" size={18} color={colors.white} /><Text style={styles.submitText}>Send purchase order</Text></>}</Pressable>}</View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function ReviewRow({ label, value }) { return <View style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  progressTrack: { height: 5, marginTop: -7, marginBottom: 10, overflow: "hidden", borderRadius: 3, backgroundColor: colors.border },
  progress: { height: "100%", borderRadius: 3, backgroundColor: colors.primary },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { marginBottom: 12, padding: 11, borderRadius: 11, color: colors.red, backgroundColor: colors.redSoft, fontSize: 10 },
  draftBanner: { minHeight: 42, marginBottom: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 11, backgroundColor: colors.primarySoft },
  draftBannerError: { borderColor: "#FECACA", backgroundColor: colors.redSoft },
  draftCopy: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
  draftText: { flex: 1, color: colors.primaryDark, fontSize: 9, fontWeight: "800" },
  draftTextError: { color: colors.red },
  discardText: { color: colors.body, fontSize: 9, fontWeight: "900", textDecorationLine: "underline" },
  label: { marginTop: 15, marginBottom: 7, color: colors.ink, fontSize: 10, fontWeight: "800" },
  vendorList: { gap: 8 },
  vendor: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  vendorSelected: { borderColor: "#93C5FD", backgroundColor: colors.primarySoft },
  vendorText: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: "800" },
  helpText: { marginTop: 4, color: colors.body, fontSize: 10, lineHeight: 15 },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, color: colors.ink, backgroundColor: colors.soft, fontSize: 11 },
  textarea: { minHeight: 82, paddingTop: 12, textAlignVertical: "top" },
  sectionRow: { marginTop: 21, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  add: { flexDirection: "row", alignItems: "center", gap: 4 },
  addText: { color: colors.primary, fontSize: 10, fontWeight: "900" },
  items: { gap: 10 },
  item: { padding: 13, gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 15 },
  itemHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemNo: { color: colors.primary, fontSize: 9, fontWeight: "900" },
  two: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  deliveryCard: { marginTop: 12, padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white },
  reviewCard: { marginTop: 12, padding: 15, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white },
  reviewRow: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reviewLabel: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  reviewValue: { marginTop: 4, color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  reviewItem: { marginTop: 9, flexDirection: "row", alignItems: "center", gap: 9, padding: 10, borderRadius: 11, backgroundColor: colors.soft },
  reviewNumber: { width: 27, height: 27, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: colors.primarySoft },
  reviewNumberText: { color: colors.primary, fontSize: 9, fontWeight: "900" },
  reviewItemCopy: { flex: 1 },
  reviewItemName: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  reviewItemMeta: { marginTop: 3, color: colors.body, fontSize: 8 },
  confirmation: { marginTop: 14, flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 11, borderRadius: 11, backgroundColor: colors.primarySoft },
  confirmationText: { flex: 1, color: colors.body, fontSize: 9, lineHeight: 14 },
  actions: { marginTop: "auto", paddingTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  previous: { minHeight: 50, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.white },
  previousText: { color: colors.ink, fontSize: 10, fontWeight: "900" },
  submit: { minHeight: 50, minWidth: 145, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 13, backgroundColor: colors.primary },
  disabled: { opacity: 0.55 },
  submitText: { color: colors.white, fontSize: 11, fontWeight: "900" },
});
