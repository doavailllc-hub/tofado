import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

const map = {
  pending: [colors.orange, colors.orangeSoft],
  unpaid: [colors.orange, colors.orangeSoft],
  partial: [colors.purple, colors.purpleSoft],
  partially_paid: [colors.purple, colors.purpleSoft],
  overdue: [colors.red, colors.redSoft],
  confirmed: [colors.primary, colors.primarySoft],
  packed: [colors.purple, colors.purpleSoft],
  dispatched: ["#0369A1", "#E0F2FE"],
  delivered: [colors.green, colors.greenSoft],
  paid: [colors.green, colors.greenSoft],
  active: [colors.green, colors.greenSoft],
  cancelled: [colors.red, colors.redSoft],
  rejected: [colors.red, colors.redSoft],
  failed: [colors.red, colors.redSoft],
};

export default function StatusBadge({ status }) {
  const key = String(status || "pending").toLowerCase();
  const [textColor, background] = map[key] || [
    colors.body,
    colors.soft,
  ];

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.text, { color: textColor }]}>
        {key.replaceAll("_", " ")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 26,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  text: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
