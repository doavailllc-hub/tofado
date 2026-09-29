import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, View } from "react-native";

import { colors } from "../theme/colors";

export default function Screen({ children, scroll = false, style }) {
  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, style]}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
  },
});
