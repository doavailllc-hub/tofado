import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";

export default function AdminNoticeScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.page}>
      <View style={styles.icon}>
        <Ionicons
          name="shield-checkmark-outline"
          size={30}
          color={colors.primary}
        />
      </View>
      <Text style={styles.title}>Admin mobile workspace</Text>
      <Text style={styles.copy}>
        Stage 1 targets retailer and wholesaler mobile operations. Continue
        using the Tofado web admin while the admin mobile module is developed.
      </Text>
      <Pressable style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 34,
    backgroundColor: colors.white,
  },
  icon: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.primarySoft,
  },
  title: {
    marginTop: 18,
    color: colors.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  copy: {
    marginTop: 9,
    color: colors.body,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },
  button: {
    minHeight: 46,
    marginTop: 20,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  buttonText: { color: colors.white, fontSize: 12, fontWeight: "800" },
});
