import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../theme/colors";

export default function AppButton({ label, onPress, loading, disabled, icon, variant = "primary", style }) {
  const inactive = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress} style={({ pressed }) => [styles.base, styles[variant], pressed && !inactive && styles.pressed, inactive && styles.disabled, style]}>
    {loading ? <ActivityIndicator color={variant === "primary" ? colors.white : colors.primary} /> : <>{icon && <Ionicons name={icon} size={18} color={variant === "primary" ? colors.white : colors.primary} />}<Text style={[styles.label, variant !== "primary" && styles.secondaryLabel]}>{label}</Text></>}
  </Pressable>;
}
const styles = StyleSheet.create({ base:{minHeight:52,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,paddingHorizontal:20,borderRadius:radius.pill},primary:{backgroundColor:colors.primary},secondary:{borderWidth:1,borderColor:colors.borderStrong,backgroundColor:colors.white},ghost:{backgroundColor:colors.primarySoft},pressed:{opacity:.78},disabled:{opacity:.5},label:{color:colors.white,fontSize:14,fontWeight:"600"},secondaryLabel:{color:colors.primary} });
