import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme/colors";

export default function ComingSoonScreen({
  title = "Module",
  subtitle = "This module is ready for the next mobile implementation stage.",
  icon = "construct-outline",
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.page}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  icon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
  },
  title: {
    marginTop: 17,
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    maxWidth: 300,
    color: colors.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
