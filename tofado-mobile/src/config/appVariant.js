import { NativeModules, Platform } from "react-native";

const nativeVariant = Platform.OS === "android"
  ? NativeModules.TofadoAppConfig?.variant
  : null;
const configuredVariant = nativeVariant || process.env.EXPO_PUBLIC_APP_VARIANT;

export const APP_VARIANT = configuredVariant === "wholesaler"
  ? "wholesaler"
  : "retailer";

export const IS_WHOLESALER_APP = APP_VARIANT === "wholesaler";
export const APP_LOGO = IS_WHOLESALER_APP
  ? require('../../assets/tofado-wholesaler-icon.png')
  : require('../../assets/tofado-logo.png');
export const APP_NAME = IS_WHOLESALER_APP ? "Tofado Wholesaler" : "Tofado Retailer";
