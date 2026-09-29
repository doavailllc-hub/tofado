import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export default function EmptyState({
  icon = "folder-open-outline",
  title,
  copy,
  actionLabel,
  onAction,
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!copy && <Text style={styles.copy}>{copy}</Text>}
      {!!actionLabel && (
        <Pressable style={styles.button} onPress={onAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 280, alignItems: "center", justifyContent: "center", padding: 28 },
  icon: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.primarySoft },
  title: { marginTop: 13, color: colors.ink, fontSize: 14, fontWeight: "900", textAlign: "center" },
  copy: { marginTop: 6, maxWidth: 280, color: colors.body, fontSize: 10, lineHeight: 16, textAlign: "center" },
  button: { minHeight: 42, marginTop: 14, justifyContent: "center", paddingHorizontal: 15, borderRadius: 12, backgroundColor: colors.primary },
  buttonText: { color: colors.white, fontSize: 10, fontWeight: "900" },
});
