import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme/colors";
import StatusBadge from "./StatusBadge";

export default function VendorCard({
  vendor,
  actionLabel,
  actionIcon = "arrow-forward",
  onPress,
  disabled = false,
}) {
  const status = vendor.connection_status || vendor.status || null;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.logo}>
          {vendor.logo_url ? (
            <Image source={{ uri: vendor.logo_url }} style={styles.logoImage} />
          ) : (
            <Ionicons name="business-outline" size={22} color={colors.primary} />
          )}
        </View>

        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.name}>
            {vendor.business_name || "Wholesale business"}
          </Text>
          <Text numberOfLines={1} style={styles.category}>
            {vendor.business_category ||
              vendor.shop_type ||
              "Verified wholesaler"}
          </Text>
        </View>

        {!!status && <StatusBadge status={status} />}
      </View>

      <View style={styles.meta}>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={15} color={colors.muted} />
          <Text style={styles.metaText}>
            {vendor.location || "Location not provided"}
          </Text>
        </View>

        {!!vendor.phone && (
          <View style={styles.metaRow}>
            <Ionicons name="call-outline" size={15} color={colors.muted} />
            <Text style={styles.metaText}>{vendor.phone}</Text>
          </View>
        )}
      </View>

      {!!vendor.description && (
        <Text numberOfLines={2} style={styles.description}>
          {vendor.description}
        </Text>
      )}

      {!!actionLabel && (
        <Pressable
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.action,
            disabled && styles.actionDisabled,
            pressed && !disabled && styles.actionPressed,
          ]}
        >
          <Ionicons
            name={actionIcon}
            size={16}
            color={disabled ? colors.muted : colors.white}
          />
          <Text
            style={[
              styles.actionText,
              disabled && styles.actionTextDisabled,
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  logo: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  category: {
    marginTop: 4,
    color: colors.body,
    fontSize: 9,
    fontWeight: "600",
  },
  meta: {
    marginTop: 13,
    gap: 7,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    flex: 1,
    color: colors.body,
    fontSize: 10,
  },
  description: {
    marginTop: 10,
    color: colors.body,
    fontSize: 10,
    lineHeight: 15,
  },
  action: {
    minHeight: 42,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  actionPressed: {
    backgroundColor: colors.primaryDark,
  },
  actionDisabled: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.soft,
  },
  actionText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "900",
  },
  actionTextDisabled: {
    color: colors.muted,
  },
});
