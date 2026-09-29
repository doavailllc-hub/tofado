import { APP_LOGO } from "../../config/appVariant";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, shadow } from "../../theme/colors";
import { IS_WHOLESALER_APP } from "../../config/appVariant";

const wholesalerSlides = [
  {
    icon: "people-outline",
    title: "Grow your retailer network",
    copy: "Review retailer requests, build trusted connections, and manage every trading relationship.",
  },
  {
    icon: "bag-check-outline",
    title: "Run orders and fulfilment",
    copy: "Receive retailer orders, confirm stock, manage deliveries, and keep every detail easy to find.",
  },
  {
    icon: "wallet-outline",
    title: "Know what is paid and due",
    copy: "Invoices, balances, and payment activity stay connected to the right partner and order.",
  },
];

const retailerSlides = [
  {
    icon: "storefront-outline",
    title: "Discover verified wholesalers",
    copy: "Browse the marketplace, compare suppliers, and connect with wholesale businesses near you.",
  },
  {
    icon: "cart-outline",
    title: "Order stock for your shop",
    copy: "Create purchase orders, track every update, and keep supplier conversations organized.",
  },
  {
    icon: "receipt-outline",
    title: "Manage invoices and payments",
    copy: "See balances, invoices, and payment activity for every wholesaler in one secure place.",
  },
];

export default function OnboardingScreen({ onComplete }) {
  const slides = IS_WHOLESALER_APP ? wholesalerSlides : retailerSlides;
  const [index, setIndex] = useState(0);
  const slide = slides[index];
  const last = index === slides.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.page}>
        <View style={styles.top}>
          <Image source={APP_LOGO} resizeMode="contain" style={styles.logo} />
          {!last && <Pressable onPress={onComplete} hitSlop={12}><Text style={styles.skip}>Skip</Text></Pressable>}
        </View>
        <View style={styles.visual}>
          <View style={styles.orbitLarge} />
          <View style={styles.orbitSmall} />
          <View style={styles.icon}><Ionicons name={slide.icon} size={54} color={colors.white} /></View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{IS_WHOLESALER_APP ? "TOFADO BUSINESS" : "TOFADO MARKETPLACE"}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.description}>{slide.copy}</Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.dots}>{slides.map((_, dot) => <View key={dot} style={[styles.dot, dot === index && styles.dotActive]} />)}</View>
          <Pressable onPress={() => last ? onComplete() : setIndex((value) => value + 1)} style={styles.button}>
            <Text style={styles.buttonText}>{last ? "Get started" : "Continue"}</Text>
            <Ionicons name="arrow-forward" size={19} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAF8FF" },
  page: { flex: 1, paddingHorizontal: 24, paddingVertical: 14 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 116, height: 42 },
  skip: { color: colors.body, fontSize: 12, fontWeight: "800" },
  visual: { flex: 1, minHeight: 270, alignItems: "center", justifyContent: "center" },
  orbitLarge: { position: "absolute", width: 260, height: 260, borderRadius: 130, backgroundColor: "#EEE7FC" },
  orbitSmall: { position: "absolute", width: 190, height: 190, borderRadius: 95, backgroundColor: "#DED0F8" },
  icon: { width: 126, height: 126, alignItems: "center", justifyContent: "center", borderRadius: 38, backgroundColor: colors.primary, ...shadow, shadowOpacity: 0.22 },
  copy: { alignItems: "center", paddingHorizontal: 8 },
  eyebrow: { color: colors.primaryDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { maxWidth: 340, marginTop: 12, color: colors.ink, fontSize: 30, lineHeight: 37, fontWeight: "900", textAlign: "center", letterSpacing: -0.8 },
  description: { maxWidth: 350, marginTop: 12, color: colors.body, fontSize: 13, lineHeight: 21, textAlign: "center" },
  footer: { marginTop: 30 },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 22 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#D2C8E5" },
  dotActive: { width: 24, backgroundColor: colors.primary },
  button: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 17, backgroundColor: colors.primary },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: "900" },
});
