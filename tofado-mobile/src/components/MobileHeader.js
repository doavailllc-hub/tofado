import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export default function MobileHeader({ eyebrow, title, subtitle, onBack, actionIcon, onAction, actionLabel }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.appBar}>
        {onBack ? (
          <Pressable hitSlop={10} onPress={onBack} style={styles.circleButton}>
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
        ) : <View style={styles.spacer} />}
        {actionIcon ? (
          <Pressable hitSlop={10} onPress={onAction} style={styles.circleButton}>
            <Ionicons name={actionIcon} size={20} color={colors.primary} />
          </Pressable>
        ) : <View style={styles.spacer} />}
      </View>
      {!!eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <View style={styles.titleRow}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {!!actionLabel && (
          <Pressable onPress={onAction} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  appBar: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  circleButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.white },
  spacer: { width: 40, height: 40 },
  eyebrow: { marginTop: 7, color: colors.primary, fontSize: 10, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  titleRow: { marginTop: 5, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  copy: { flex: 1 },
  title: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { marginTop: 5, color: colors.body, fontSize: 13, lineHeight: 18 },
  textButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.primarySoft },
  textButtonLabel: { color: colors.primary, fontSize: 12, fontWeight: "600" },
});
