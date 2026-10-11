import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import MobileHeader from "../../components/MobileHeader";

const items = [
  ["Tofado Intelligence", "sparkles-outline", "CommerceIntelligence"],
  ["Retailers & requests", "people-outline", "RetailerTools"],
  ["Deliveries", "car-outline", "Deliveries"],
  ["Invoices", "receipt-outline", "WholesalerInvoices"],
  ["Payments", "wallet-outline", "WholesalerPayments"],
  ["Business profile", "business-outline", "Profile"],
];

export default function WholesalerMoreScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page}>
        <MobileHeader eyebrow="Business tools" title="More" subtitle="Partners, fulfilment, finance, and account settings." />
        <View style={styles.list}>
          {items.map(([label, icon, route]) => <Pressable key={label} style={styles.item} onPress={() => navigation.navigate(route)}><View style={styles.icon}><Ionicons name={icon} size={20} color={colors.primary} /></View><Text style={styles.label}>{label}</Text><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { padding: 20, paddingBottom: 34 },
  list: { overflow: "hidden", borderWidth: 1, borderColor: colors.border, borderRadius: 17 },
  item: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primarySoft },
  label: { flex: 1, color: colors.ink, fontSize: 11, fontWeight: "800" },
});
