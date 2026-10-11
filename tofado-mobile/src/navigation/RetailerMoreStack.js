import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RetailerMoreScreen from "../screens/retailer/RetailerMoreScreen";
import RetailerInvoicesStack from "./RetailerInvoicesStack";
import ProfileScreen from "../screens/common/ProfileScreen";
import CommerceIntelligenceScreen from "../screens/common/CommerceIntelligenceScreen";

const Stack = createNativeStackNavigator();
export default function RetailerMoreStack() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MoreHome" component={RetailerMoreScreen} />
    <Stack.Screen name="RetailerInvoices" component={RetailerInvoicesStack} />
    <Stack.Screen name="Profile" component={ProfileScreen} />
    <Stack.Screen name="CommerceIntelligence" component={CommerceIntelligenceScreen} />
  </Stack.Navigator>;
}
