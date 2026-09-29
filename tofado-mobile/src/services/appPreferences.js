import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "tofado_onboarding_complete_v1";

export async function hasCompletedOnboarding() {
  if (Platform.OS === "web") {
    return typeof window !== "undefined" &&
      window.localStorage.getItem(ONBOARDING_KEY) === "true";
  }
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
}

export async function completeOnboarding() {
  if (Platform.OS === "web") {
    window.localStorage.setItem(ONBOARDING_KEY, "true");
    return;
  }
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}
