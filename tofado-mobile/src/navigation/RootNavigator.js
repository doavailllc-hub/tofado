import { View, Text, Button } from "react-native";
import { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/auth/PasswordlessLoginScreen";
import BootScreen from "../screens/common/BootScreen";
import WholesalerTabs from "./WholesalerTabs";
import OnboardingScreen from "../screens/auth/OnboardingScreen";
import CompleteBusinessProfileScreen from "../screens/auth/CompleteBusinessProfileScreen";
import WholesalerVerificationScreen from "../screens/auth/WholesalerVerificationScreen";
import WrongAppScreen from "../screens/common/WrongAppScreen";
import RetailerTabs from "./RetailerTabs";
import { APP_VARIANT, IS_WHOLESALER_APP } from "../config/appVariant";
import FindWholesalersScreen from "../screens/retailer/FindWholesalersScreen";
import RetailerStorefrontScreen from "../screens/retailer/RetailerStorefrontScreen";
import {
  completeOnboarding,
  hasCompletedOnboarding,
} from "../services/appPreferences";

const Stack = createNativeStackNavigator();

function RetailerGuestNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PublicMarketplace" component={FindWholesalersScreen} />
      <Stack.Screen name="Storefront" component={RetailerStorefrontScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, booting, sessionError, restoreSession, logout } = useAuth();
  const [onboardingReady, setOnboardingReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    hasCompletedOnboarding()
      .then(setOnboardingComplete)
      .finally(() => setOnboardingReady(true));
  }, []);

  if (booting || !onboardingReady) {
    return <BootScreen />;
  }

  if (sessionError) {
    return <View style={{ flex: 1, justifyContent: "center", padding: 24 }}><Text accessibilityRole="alert">{sessionError}</Text><Button title="Try again" onPress={restoreSession} /><Button title="Sign out" onPress={logout} /></View>;
  }

  if (!user && !onboardingComplete) {
    return <OnboardingScreen onComplete={async () => {
      await completeOnboarding();
      setOnboardingComplete(true);
    }} />;
  }

  if (!user && !IS_WHOLESALER_APP) {
    return <RetailerGuestNavigator />;
  }

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  if (user.role !== APP_VARIANT) {
    return <WrongAppScreen />;
  }

  if (
    IS_WHOLESALER_APP &&
    user.role === "wholesaler" &&
    ["draft", "pending", "rejected"].includes(user.verification_status)
  ) {
    return <WholesalerVerificationScreen />;
  }

  if (!user.profile_complete) {
    return <CompleteBusinessProfileScreen />;
  }

  return IS_WHOLESALER_APP ? <WholesalerTabs /> : <RetailerTabs />;
}
