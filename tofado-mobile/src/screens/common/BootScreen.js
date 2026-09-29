import { APP_LOGO } from "../../config/appVariant";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";

import { colors } from "../../theme/colors";

export default function BootScreen() {
  return (
    <View style={styles.page}>
      <Image
        source={APP_LOGO}
        resizeMode="contain"
        style={styles.logo}
      />
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.text}>Preparing your workspace…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.white,
  },
  logo: {
    width: 160,
    height: 72,
    marginBottom: 24,
  },
  text: {
    marginTop: 10,
    color: colors.body,
    fontSize: 12,
  },
});
